import pandas as pd
import pytest

from app.services.standings import get_current_standings


def test_get_current_standings_groups_by_division(
    monkeypatch: pytest.MonkeyPatch,
    sample_standings_schedule: pd.DataFrame,
    sample_teams: pd.DataFrame,
    sample_weekly_team_stats: pd.DataFrame,
) -> None:
    monkeypatch.setattr("app.services.standings.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr(
        "app.data.schedules.get_season_schedule", lambda season: sample_standings_schedule
    )
    monkeypatch.setattr("app.data.teams.get_teams", lambda: sample_teams)
    monkeypatch.setattr(
        "app.data.team_stats.get_weekly_team_stats", lambda season: sample_weekly_team_stats
    )

    standings = get_current_standings()

    # All 8 divisions are always present, even ones with no teams in this fixture.
    assert len(standings) == 8
    afc_south = next(d for d in standings if d["division"] == "AFC South")
    assert afc_south["teams"] == []


def test_get_current_standings_sorts_by_win_pct_within_division(
    monkeypatch: pytest.MonkeyPatch,
    sample_standings_schedule: pd.DataFrame,
    sample_teams: pd.DataFrame,
    sample_weekly_team_stats: pd.DataFrame,
) -> None:
    monkeypatch.setattr("app.services.standings.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr(
        "app.data.schedules.get_season_schedule", lambda season: sample_standings_schedule
    )
    monkeypatch.setattr("app.data.teams.get_teams", lambda: sample_teams)
    monkeypatch.setattr(
        "app.data.team_stats.get_weekly_team_stats", lambda season: sample_weekly_team_stats
    )

    standings = get_current_standings()
    afc_east = next(d for d in standings if d["division"] == "AFC East")

    # BUF: 2-0-0 (1.0) > NYJ: 0-0-1 (.5) > NE: 0-1-1 (.25) > MIA: 0-1-0 (0.0)
    assert [t["team"] for t in afc_east["teams"]] == ["BUF", "NYJ", "NE", "MIA"]


def test_get_current_standings_computes_records_and_points(
    monkeypatch: pytest.MonkeyPatch,
    sample_standings_schedule: pd.DataFrame,
    sample_teams: pd.DataFrame,
    sample_weekly_team_stats: pd.DataFrame,
) -> None:
    monkeypatch.setattr("app.services.standings.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr(
        "app.data.schedules.get_season_schedule", lambda season: sample_standings_schedule
    )
    monkeypatch.setattr("app.data.teams.get_teams", lambda: sample_teams)
    monkeypatch.setattr(
        "app.data.team_stats.get_weekly_team_stats", lambda season: sample_weekly_team_stats
    )

    standings = get_current_standings()
    afc_east = next(d for d in standings if d["division"] == "AFC East")

    buf = next(t for t in afc_east["teams"] if t["team"] == "BUF")
    assert (buf["wins"], buf["losses"], buf["ties"]) == (2, 0, 0)
    assert buf["points_for"] == 44  # 24 + 20
    assert buf["points_against"] == 25  # 10 + 15
    assert buf["win_pct"] == 1.0

    ne = next(t for t in afc_east["teams"] if t["team"] == "NE")
    assert (ne["wins"], ne["losses"], ne["ties"]) == (0, 1, 1)
    assert ne["win_pct"] == 0.25


def test_get_current_standings_resolves_real_ties_with_nfl_tiebreakers(
    monkeypatch: pytest.MonkeyPatch,
    sample_standings_schedule: pd.DataFrame,
    sample_teams: pd.DataFrame,
    sample_weekly_team_stats: pd.DataFrame,
) -> None:
    # NFC East: DAL and PHI are both 1-0 (undefeated, distinct opponents), as
    # are NYG and WAS (both 0-1). Head-to-head, division record, common
    # games, conference record, strength of victory/schedule all tie for
    # both pairs (no games in common), so it comes down to combined points
    # ranking within the conference: PHI (30 for / 10 against) outranks DAL
    # (28 for / 20 against); NYG (20/28) outranks WAS (10/30) the same way.
    monkeypatch.setattr("app.services.standings.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr(
        "app.data.schedules.get_season_schedule", lambda season: sample_standings_schedule
    )
    monkeypatch.setattr("app.data.teams.get_teams", lambda: sample_teams)
    monkeypatch.setattr(
        "app.data.team_stats.get_weekly_team_stats", lambda season: sample_weekly_team_stats
    )

    standings = get_current_standings()
    nfc_east = next(d for d in standings if d["division"] == "NFC East")

    assert [t["team"] for t in nfc_east["teams"]] == ["PHI", "DAL", "NYG", "WAS"]


def test_get_current_standings_falls_back_when_no_games_played(
    monkeypatch: pytest.MonkeyPatch,
    sample_standings_schedule: pd.DataFrame,
    sample_teams: pd.DataFrame,
    sample_weekly_team_stats: pd.DataFrame,
) -> None:
    monkeypatch.setattr("app.services.standings.nfl.get_current_season", lambda: 2027)

    def fake_get_season_schedule(season: int) -> pd.DataFrame:
        if season == 2027:
            return pd.DataFrame(columns=sample_standings_schedule.columns)
        return sample_standings_schedule

    monkeypatch.setattr("app.data.schedules.get_season_schedule", fake_get_season_schedule)
    monkeypatch.setattr("app.data.teams.get_teams", lambda: sample_teams)
    monkeypatch.setattr(
        "app.data.team_stats.get_weekly_team_stats", lambda season: sample_weekly_team_stats
    )

    standings = get_current_standings()
    afc_east = next(d for d in standings if d["division"] == "AFC East")

    assert len(afc_east["teams"]) == 4
