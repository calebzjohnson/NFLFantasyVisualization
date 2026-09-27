import pandas as pd
import pytest

from app.services.extended_stats import PFR_COLUMNS
from app.services.players import (
    InvalidQueryError,
    PlayerNotFoundError,
    get_current_player_stats,
    get_player_bio,
    get_player_game_log,
    get_player_usage_share,
    get_weekly_player_stats,
)


@pytest.fixture
def sample_leaderboard_stats() -> pd.DataFrame:
    """Four players spanning positions, with distinct stat values - built for
    testing sort/limit/fields/position_group, not shared with other tests.
    """
    rows = [
        dict(player_id="Q1", player_display_name="Q One", position="QB", position_group="QB",
             team="DAL", passing_yards=300, rushing_yards=0),
        dict(player_id="Q2", player_display_name="Q Two", position="QB", position_group="QB",
             team="PHI", passing_yards=500, rushing_yards=0),
        dict(player_id="R1", player_display_name="R One", position="RB", position_group="RB",
             team="DAL", passing_yards=0, rushing_yards=800),
        dict(player_id="W1", player_display_name="W One", position="WR", position_group="WR",
             team="PHI", passing_yards=0, rushing_yards=0),
    ]
    return pd.DataFrame(rows)


def test_get_current_player_stats_sorts_descending(
    monkeypatch: pytest.MonkeyPatch, sample_leaderboard_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.player_stats.get_season_stats", lambda season: sample_leaderboard_stats
    )

    records = get_current_player_stats(sort="-passing_yards")

    assert [r["player_id"] for r in records] == ["Q2", "Q1", "R1", "W1"]


def test_get_current_player_stats_sorts_ascending_without_prefix(
    monkeypatch: pytest.MonkeyPatch, sample_leaderboard_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.player_stats.get_season_stats", lambda season: sample_leaderboard_stats
    )

    records = get_current_player_stats(sort="passing_yards")

    assert [r["player_id"] for r in records][:2] == ["R1", "W1"]  # both 0, tied for lowest


def test_get_current_player_stats_applies_limit_after_sort(
    monkeypatch: pytest.MonkeyPatch, sample_leaderboard_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.player_stats.get_season_stats", lambda season: sample_leaderboard_stats
    )

    records = get_current_player_stats(sort="-rushing_yards", limit=1)

    assert [r["player_id"] for r in records] == ["R1"]


def test_get_current_player_stats_filters_by_position_group(
    monkeypatch: pytest.MonkeyPatch, sample_leaderboard_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.player_stats.get_season_stats", lambda season: sample_leaderboard_stats
    )

    records = get_current_player_stats(position_group="QB")

    assert {r["player_id"] for r in records} == {"Q1", "Q2"}


def test_get_current_player_stats_projects_requested_fields_only(
    monkeypatch: pytest.MonkeyPatch, sample_leaderboard_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.player_stats.get_season_stats", lambda season: sample_leaderboard_stats
    )

    records = get_current_player_stats(fields=["player_display_name", "passing_yards"])

    assert all(set(r.keys()) == {"player_display_name", "passing_yards"} for r in records)


def test_get_current_player_stats_rejects_unknown_sort_field(
    monkeypatch: pytest.MonkeyPatch, sample_leaderboard_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.player_stats.get_season_stats", lambda season: sample_leaderboard_stats
    )

    with pytest.raises(InvalidQueryError):
        get_current_player_stats(sort="not_a_real_field")


def test_get_current_player_stats_rejects_unknown_fields(
    monkeypatch: pytest.MonkeyPatch, sample_leaderboard_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.player_stats.get_season_stats", lambda season: sample_leaderboard_stats
    )

    with pytest.raises(InvalidQueryError):
        get_current_player_stats(fields=["not_a_real_field"])


def test_get_current_player_stats_converts_nan_to_none(
    monkeypatch: pytest.MonkeyPatch, sample_season_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.player_stats.get_season_stats", lambda season: sample_season_stats
    )

    records = get_current_player_stats()

    assert len(records) == 2
    qb = next(r for r in records if r["player_id"] == "Q1")
    wr = next(r for r in records if r["player_id"] == "W1")

    assert qb["pacr"] == 1.5
    assert wr["pacr"] is None  # NaN in the source data, not 0 or a string


def test_get_current_player_stats_preserves_real_values(
    monkeypatch: pytest.MonkeyPatch, sample_season_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.player_stats.get_season_stats", lambda season: sample_season_stats
    )

    records = get_current_player_stats()
    qb = next(r for r in records if r["player_id"] == "Q1")

    assert qb["player_display_name"] == "Q One"
    assert qb["position"] == "QB"
    assert qb["passing_yards"] == 2500


def test_get_current_player_stats_falls_back_to_prior_season(
    monkeypatch: pytest.MonkeyPatch, sample_season_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.services.players.nfl.get_current_season", lambda: 2026)

    def fake_get_season_stats(season: int) -> pd.DataFrame:
        return pd.DataFrame() if season == 2026 else sample_season_stats

    monkeypatch.setattr("app.data.player_stats.get_season_stats", fake_get_season_stats)

    records = get_current_player_stats()

    assert len(records) == 2


def test_get_player_game_log_filters_by_player_and_regular_season(
    monkeypatch: pytest.MonkeyPatch, sample_week_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.data.player_stats.get_week_stats", lambda season: sample_week_stats)

    records = get_player_game_log("Q1")

    assert [r["week"] for r in records] == [1, 2, 3]  # sorted, POST week 19 excluded


def test_get_player_game_log_converts_nan_to_none(
    monkeypatch: pytest.MonkeyPatch, sample_week_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.data.player_stats.get_week_stats", lambda season: sample_week_stats)

    records = get_player_game_log("Q1")

    week_2 = next(r for r in records if r["week"] == 2)
    assert week_2["pacr"] is None


def test_get_player_game_log_raises_for_unknown_player(
    monkeypatch: pytest.MonkeyPatch, sample_week_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.data.player_stats.get_week_stats", lambda season: sample_week_stats)

    with pytest.raises(PlayerNotFoundError):
        get_player_game_log("not_a_real_player")


def test_get_player_game_log_falls_back_to_prior_season(
    monkeypatch: pytest.MonkeyPatch, sample_week_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.services.players.nfl.get_current_season", lambda: 2026)

    def fake_get_week_stats(season: int) -> pd.DataFrame:
        return pd.DataFrame() if season == 2026 else sample_week_stats

    monkeypatch.setattr("app.data.player_stats.get_week_stats", fake_get_week_stats)

    records = get_player_game_log("Q1")

    assert len(records) == 3


@pytest.fixture
def sample_quiet_week_stats() -> pd.DataFrame:
    """Player Z1 has a real stat row for week 1 only - weeks 2 and 3 are
    deliberately absent, mirroring nflverse's own behavior of dropping a
    player-week entirely when he recorded no statistical events.
    """
    return pd.DataFrame(
        [
            dict(player_id="Z1", player_display_name="Z One", position="WR",
                 position_group="WR", team="DAL", week=1, season_type="REG",
                 targets=5, receptions=3),
        ]
    )


@pytest.fixture
def sample_quiet_week_snaps() -> pd.DataFrame:
    """Snap counts for the same three weeks, keyed by pfr_player_id (see
    get_pfr_to_gsis_map): week 1 confirms the real stat row, week 2 has
    real offensive snaps despite no stat row (the "played but quiet" case
    get_player_game_log should surface as a quiet-week row), and week 3 has
    zero snaps of any kind (genuinely inactive - should stay excluded, not be
    mistaken for a quiet week). A decoy row for a different player in week 2
    confirms filtering by player_id, not just by week.
    """
    rows = [
        dict(pfr_player_id="ZeeOne", week=1, team="DAL", opponent="NYG", offense_snaps=50,
             offense_pct=0.5),
        dict(pfr_player_id="ZeeOne", week=2, team="DAL", opponent="PHI", offense_snaps=10,
             offense_pct=0.2),
        dict(pfr_player_id="ZeeOne", week=3, team="DAL", opponent="WAS", offense_snaps=0,
             offense_pct=0.0),
        dict(pfr_player_id="Other", week=2, team="NYG", opponent="DAL", offense_snaps=20,
             offense_pct=0.25),
    ]
    return pd.DataFrame(rows).assign(game_type="REG", defense_snaps=0, defense_pct=0.0, st_snaps=0)


def test_get_player_game_log_includes_quiet_week_played_via_snap_counts(
    monkeypatch: pytest.MonkeyPatch,
    sample_quiet_week_stats: pd.DataFrame,
    sample_quiet_week_snaps: pd.DataFrame,
) -> None:
    monkeypatch.setattr(
        "app.data.player_stats.get_week_stats", lambda season: sample_quiet_week_stats
    )
    monkeypatch.setattr(
        "app.data.snap_counts.get_season_snap_counts", lambda season: sample_quiet_week_snaps
    )
    monkeypatch.setattr(
        "app.data.snap_counts.get_pfr_to_gsis_map",
        lambda: pd.Series({"ZeeOne": "Z1", "Other": "O1"}),
    )
    monkeypatch.setattr(
        "app.data.pfr_defense.get_season_pfr_defense",
        lambda season: pd.DataFrame(columns=["pfr_player_id", "game_type", "week", *PFR_COLUMNS]),
    )
    monkeypatch.setattr(
        "app.data.players.get_players",
        lambda: pd.DataFrame(
            [dict(gsis_id="Z1", display_name="Z One", position="WR", position_group="WR",
                  headshot=None)]
        ),
    )

    records = get_player_game_log("Z1")

    assert [r["week"] for r in records] == [1, 2]  # week 3 (0 snaps) excluded

    week_1 = next(r for r in records if r["week"] == 1)
    assert week_1["targets"] == 5  # a real stat row, untouched
    assert week_1["offense_snaps"] == 50

    week_2 = next(r for r in records if r["week"] == 2)
    assert week_2["team"] == "DAL"
    assert week_2["opponent_team"] == "PHI"
    assert week_2["player_display_name"] == "Z One"
    assert week_2["offense_snaps"] == 10
    assert week_2["targets"] is None  # synthesized - null box score, not zero-filled


def test_get_player_bio_returns_matching_player(
    monkeypatch: pytest.MonkeyPatch, sample_players_roster: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.players.get_players", lambda: sample_players_roster
    )

    bio = get_player_bio("Q1")

    assert bio["display_name"] == "Q One"
    assert bio["team"] == "DAL"
    assert bio["height_in"] == 74.0
    assert bio["draft_year"] == 2020.0


def test_get_player_bio_maps_known_status_code(
    monkeypatch: pytest.MonkeyPatch, sample_players_roster: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.players.get_players", lambda: sample_players_roster
    )

    bio = get_player_bio("Q1")

    assert bio["status"] == "Active"  # ACT mapped to a display label


def test_get_player_bio_falls_back_to_raw_status_code(
    monkeypatch: pytest.MonkeyPatch, sample_players_roster: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.players.get_players", lambda: sample_players_roster
    )

    bio = get_player_bio("W1")

    assert bio["status"] == "XYZ"  # unmapped code passed through as-is


def test_get_player_bio_converts_nan_draft_fields_to_none(
    monkeypatch: pytest.MonkeyPatch, sample_players_roster: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.players.get_players", lambda: sample_players_roster
    )

    bio = get_player_bio("W1")

    assert bio["draft_year"] is None
    assert bio["draft_team"] is None


def test_get_player_bio_raises_for_unknown_player(
    monkeypatch: pytest.MonkeyPatch, sample_players_roster: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.players.get_players", lambda: sample_players_roster
    )

    with pytest.raises(PlayerNotFoundError):
        get_player_bio("not_a_real_player")


def test_get_weekly_player_stats_filters_position_and_regular_season(
    monkeypatch: pytest.MonkeyPatch,
    sample_week_stats: pd.DataFrame,
    sample_week_schedule: pd.DataFrame,
) -> None:
    monkeypatch.setattr("app.data.player_stats.get_week_stats", lambda season: sample_week_stats)
    monkeypatch.setattr(
        "app.data.schedules.get_season_schedule", lambda season: sample_week_schedule
    )

    records = get_weekly_player_stats(position_group="QB")

    # Q1's 3 REG games only - W1 (WR) and the POST week 19 game are excluded.
    assert [r["week"] for r in records] == [1, 2, 3]
    assert all(r["player_id"] == "Q1" for r in records)


def test_get_weekly_player_stats_includes_every_player_without_a_position_filter(
    monkeypatch: pytest.MonkeyPatch,
    sample_week_stats: pd.DataFrame,
    sample_week_schedule: pd.DataFrame,
) -> None:
    monkeypatch.setattr("app.data.player_stats.get_week_stats", lambda season: sample_week_stats)
    monkeypatch.setattr(
        "app.data.schedules.get_season_schedule", lambda season: sample_week_schedule
    )

    records = get_weekly_player_stats()

    assert {r["player_id"] for r in records} == {"Q1", "W1"}


def test_get_weekly_player_stats_rejects_unknown_field(
    monkeypatch: pytest.MonkeyPatch,
    sample_week_stats: pd.DataFrame,
    sample_week_schedule: pd.DataFrame,
) -> None:
    monkeypatch.setattr("app.data.player_stats.get_week_stats", lambda season: sample_week_stats)
    monkeypatch.setattr(
        "app.data.schedules.get_season_schedule", lambda season: sample_week_schedule
    )

    with pytest.raises(InvalidQueryError):
        get_weekly_player_stats(fields=["not_a_real_field"])


def test_get_weekly_player_stats_hides_partially_played_week(
    monkeypatch: pytest.MonkeyPatch,
    sample_week_stats: pd.DataFrame,
    sample_week_schedule: pd.DataFrame,
) -> None:
    # Week 4 after Thursday night: DAL (the Thursday team) has stats, but
    # PHI/WAS haven't played yet, so week 4 is left out for everyone.
    thursday = sample_week_stats.iloc[[0]].assign(week=4, team="DAL")
    stats = pd.concat([sample_week_stats, thursday], ignore_index=True)
    schedule = pd.concat(
        [
            sample_week_schedule,
            pd.DataFrame([
                dict(game_type="REG", week=4, away_team="DAL", home_team="NYG"),
                dict(game_type="REG", week=4, away_team="PHI", home_team="WAS"),
            ]),
        ],
        ignore_index=True,
    )
    monkeypatch.setattr("app.data.player_stats.get_week_stats", lambda season: stats)
    monkeypatch.setattr("app.data.schedules.get_season_schedule", lambda season: schedule)

    records = get_weekly_player_stats(position_group="QB")

    assert [r["week"] for r in records] == [1, 2, 3]


def test_get_current_player_stats_splits_specialists_into_kickers_and_punters(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    stats = pd.DataFrame(
        [
            dict(player_id="K1", position="K", position_group="SPEC", fg_made=10),
            dict(player_id="P1", position="P", position_group="SPEC", fg_made=0),
        ]
    )
    monkeypatch.setattr("app.data.player_stats.get_season_stats", lambda season: stats)

    records = get_current_player_stats(position_group="K")

    assert [r["player_id"] for r in records] == ["K1"]


def test_get_player_usage_share_uses_team_tackle_share_for_defensive_backs(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    tackles = dict(def_tackles_with_assist=0, def_tackle_assists=0)
    season = pd.DataFrame(
        [
            dict(player_id="D1", player_display_name="D One", position_group="DB",
                 recent_team="DAL", def_tackles_solo=6, **tackles),
            dict(player_id="L1", player_display_name="L One", position_group="LB",
                 recent_team="DAL", def_tackles_solo=4, **tackles),
            dict(player_id="X1", player_display_name="X One", position_group="LB",
                 recent_team="NYG", def_tackles_solo=9, **tackles),
        ]
    )
    week = season.rename(columns={"recent_team": "team"}).assign(week=1, season_type="REG")
    monkeypatch.setattr("app.data.player_stats.get_season_stats", lambda s: season)
    monkeypatch.setattr("app.data.player_stats.get_week_stats", lambda s: week)

    usage = get_player_usage_share("D1")

    assert (usage["label"], usage["player_value"], usage["team_value"]) == ("Tackle Share", 6, 10)
    assert usage["teammates"] == [{"player_id": "L1", "name": "L One", "value": 4}]


def test_get_player_usage_share_raises_for_groups_without_a_usage_metric(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    season = pd.DataFrame([dict(player_id="C1", position_group="OL", recent_team="DAL")])
    monkeypatch.setattr("app.data.player_stats.get_season_stats", lambda s: season)

    with pytest.raises(PlayerNotFoundError):
        get_player_usage_share("C1")
