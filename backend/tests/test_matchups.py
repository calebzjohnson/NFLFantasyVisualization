import pandas as pd
import pytest

from app.services.matchups import GameNotFoundError, get_matchup


@pytest.fixture
def matchup_sources(
    monkeypatch: pytest.MonkeyPatch,
    sample_schedule: pd.DataFrame,
    matchup_plays: pd.DataFrame,
) -> None:
    monkeypatch.setattr("app.services.matchups.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.schedules.get_season_schedule", lambda season: sample_schedule)
    monkeypatch.setattr("app.data.pbp.get_season_pbp", lambda season: matchup_plays)


def test_a_played_game_is_broken_down(matchup_sources: None) -> None:
    matchup = get_matchup("2026_01_DAL_NYG")

    assert matchup["status"] == "final"
    assert "preview" not in matchup
    assert matchup["game"]["away_team"] == "DAL"
    assert matchup["game"]["home_score"] == 28.0


def test_an_unplayed_game_is_previewed(matchup_sources: None) -> None:
    matchup = get_matchup("2026_02_DET_BUF")

    assert matchup["status"] == "scheduled"
    assert "breakdown" not in matchup
    # Betting lines are in the schedule row and must never reach the payload.
    assert not any(
        field in matchup["game"]
        for field in ("spread_line", "total_line", "away_moneyline", "home_moneyline")
    )
    assert matchup["game"]["home_score"] is None


def test_the_preview_rates_each_team_by_season_so_far(matchup_sources: None) -> None:
    """A preview can't use the game's own plays, so both teams are rated on
    every scrimmage play they've run (or faced) in the season loaded.
    """
    teams = {team["team"]: team for team in get_matchup("2026_02_DET_BUF")["preview"]["teams"]}

    assert set(teams) == {"DET", "BUF"}
    assert teams["DET"]["offense"]["overall"] == {
        "plays": 1,
        "epa": 5.0,
        "epa_per_play": 5.0,
        "success_rate": 100.0,
    }
    assert teams["BUF"]["defense"]["overall"]["epa_per_play"] == 5.0


def test_the_preview_splits_pass_from_run(matchup_sources: None) -> None:
    """The split is the point of a matchup: a defense can be stout against
    one and not the other.
    """
    teams = {team["team"]: team for team in get_matchup("2026_02_DET_BUF")["preview"]["teams"]}

    assert teams["DET"]["offense"]["pass"]["epa_per_play"] == 5.0
    assert teams["DET"]["offense"]["run"] == {
        "plays": 0,
        "epa": None,
        "epa_per_play": None,
        "success_rate": None,
    }


def test_the_breakdown_counts_only_this_game(matchup_sources: None) -> None:
    """Week 2's play is in the same frame and must not reach week 1's game."""
    teams = {t["team"]: t for t in get_matchup("2026_01_DAL_NYG")["breakdown"]["teams"]}

    assert teams["DAL"]["offense"]["overall"]["plays"] == 2
    assert teams["DAL"]["yards"] == 30
    assert teams["NYG"]["yards"] == 5


def test_the_breakdown_counts_turnovers_and_third_downs(matchup_sources: None) -> None:
    teams = {t["team"]: t for t in get_matchup("2026_01_DAL_NYG")["breakdown"]["teams"]}

    assert teams["DAL"]["turnovers"] == 1
    assert teams["NYG"]["turnovers"] == 0
    assert (teams["NYG"]["third_down_attempts"], teams["NYG"]["third_down_conversions"]) == (1, 1)
    assert teams["DAL"]["third_down_attempts"] == 0


def test_the_breakdown_lists_every_drive_in_order(matchup_sources: None) -> None:
    """A drive's team comes from its plays, not its first row - the kickoff
    that opens a drive has no posteam.
    """
    drives = get_matchup("2026_01_DAL_NYG")["breakdown"]["drives"]

    assert [(d["drive"], d["team"], d["result"]) for d in drives] == [
        (1, "DAL", "Touchdown"),
        (2, "DAL", "Turnover"),
        (3, "NYG", "Field goal"),
    ]
    # The punt isn't a scrimmage play, but it's still a play on the drive.
    assert drives[1]["plays"] == 2


def test_win_probability_counts_up_from_kickoff(matchup_sources: None) -> None:
    """Stored as seconds remaining, plotted as seconds elapsed."""
    wp = get_matchup("2026_01_DAL_NYG")["breakdown"]["win_probability"]

    assert [point["elapsed"] for point in wp] == [0, 100, 1800, 1900, 2700]
    assert wp[0]["home_wp"] == 50.0
    assert wp[-1]["home_wp"] == 80.0


def test_an_unknown_game_is_rejected(matchup_sources: None) -> None:
    with pytest.raises(GameNotFoundError):
        get_matchup("2026_01_NOT_REAL")


def test_the_breakdown_scores_each_quarter(matchup_sources: None) -> None:
    """Each quarter's points are the running score at its end less the one
    before, so the quarters add up to the final score.
    """
    line = get_matchup("2026_01_DAL_NYG")["breakdown"]["line_score"]

    assert line == [
        {"quarter": 1, "away": 7, "home": 0},
        {"quarter": 2, "away": 0, "home": 3},
        {"quarter": 3, "away": 0, "home": 7},
    ]
    assert sum(quarter["home"] for quarter in line) == 10


@pytest.fixture
def with_week_stats(
    monkeypatch: pytest.MonkeyPatch, matchup_week_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.data.player_stats.get_week_stats", lambda season: matchup_week_stats)
    monkeypatch.setattr(
        "app.data.pfr_defense.get_season_pfr_defense", lambda season: pd.DataFrame()
    )


def test_the_breakdown_names_a_leader_a_side(
    matchup_sources: None, with_week_stats: None
) -> None:
    """Each category carries one leader per team, so the two sit side by side."""
    breakdown = get_matchup("2026_01_DAL_NYG")["breakdown"]
    leaders = {row["label"]: row for row in breakdown["leaders"]}

    pass_yards = leaders["Passing Yards"]["leaders"]
    assert [(one["name"], one["value"]) for one in pass_yards] == [
        ("Q One", 300.0),
        ("Q Two", 250.0),
    ]
    assert leaders["Tackles"]["leaders"][1]["name"] == "L One"


def test_a_category_nobody_figured_in_is_dropped(
    matchup_sources: None, with_week_stats: None
) -> None:
    """Nobody ran the ball, so there's no Rush Yards row to show a 0-yard
    "leader" in. Pressures are absent too, since PFR has nothing for it.
    """
    labels = [row["label"] for row in get_matchup("2026_01_DAL_NYG")["breakdown"]["leaders"]]

    assert "Rushing Yards" not in labels
    assert "Pressures" not in labels
    assert "Passing Yards" in labels


def test_a_leader_is_only_sought_within_its_own_team(
    matchup_sources: None, with_week_stats: None
) -> None:
    """A side with nobody in a category gets None rather than the other
    team's player.
    """
    breakdown = get_matchup("2026_01_DAL_NYG")["breakdown"]
    leaders = {row["label"]: row for row in breakdown["leaders"]}

    assert leaders["Receiving Yards"]["leaders"][0]["name"] == "W One"
    assert leaders["Receiving Yards"]["leaders"][1] is None


def test_the_box_score_sections_each_team(matchup_sources: None, with_week_stats: None) -> None:
    """A player lands in a section only once he has a number in it, so the
    quarterback isn't listed among the receivers.
    """
    breakdown = get_matchup("2026_01_DAL_NYG")["breakdown"]
    box = {team["team"]: team for team in breakdown["box_score"]}

    assert [p["name"] for p in box["DAL"]["passing"]] == ["Q One"]
    assert [p["name"] for p in box["DAL"]["receiving"]] == ["W One"]
    assert box["DAL"]["defense"] == []
    assert box["DAL"]["passing"][0]["attempts"] == 30


def test_the_box_score_leaves_out_another_week(
    matchup_sources: None, with_week_stats: None
) -> None:
    breakdown = get_matchup("2026_01_DAL_NYG")["breakdown"]
    box = {team["team"]: team for team in breakdown["box_score"]}

    assert [p["name"] for p in box["DAL"]["passing"]] == ["Q One"]


def test_the_box_score_counts_a_full_game_of_possession(
    matchup_sources: None, with_week_stats: None
) -> None:
    """Time of possession is the drive clock summed once per drive, not once
    per play on it.
    """
    teams = {t["team"]: t for t in get_matchup("2026_01_DAL_NYG")["breakdown"]["teams"]}

    assert teams["DAL"]["time_of_possession"] == 150
    assert teams["DAL"]["penalties"] == 0
