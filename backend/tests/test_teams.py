import pandas as pd
import pytest

from app.services.teams import get_current_teams


def test_get_current_teams_excludes_historical_codes(
    monkeypatch: pytest.MonkeyPatch,
    sample_teams: pd.DataFrame,
    sample_standings_schedule: pd.DataFrame,
) -> None:
    monkeypatch.setattr("app.services.teams.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.teams.get_teams", lambda: sample_teams)
    monkeypatch.setattr(
        "app.data.schedules.get_season_schedule", lambda season: sample_standings_schedule
    )

    teams = get_current_teams()

    codes = {t["team_abbr"] for t in teams}
    assert "OAK" not in codes  # in the registry, but never plays in this fixture's schedule
    assert codes == {"BUF", "MIA", "NE", "NYJ", "DAL", "NYG", "PHI", "WAS"}


def test_get_current_teams_includes_full_names(
    monkeypatch: pytest.MonkeyPatch,
    sample_teams: pd.DataFrame,
    sample_standings_schedule: pd.DataFrame,
) -> None:
    monkeypatch.setattr("app.services.teams.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.teams.get_teams", lambda: sample_teams)
    monkeypatch.setattr(
        "app.data.schedules.get_season_schedule", lambda season: sample_standings_schedule
    )

    teams = get_current_teams()
    buf = next(t for t in teams if t["team_abbr"] == "BUF")

    assert buf["team_name"] == "Buffalo Bills"


def test_get_current_teams_falls_back_when_schedule_not_published_yet(
    monkeypatch: pytest.MonkeyPatch,
    sample_teams: pd.DataFrame,
    sample_standings_schedule: pd.DataFrame,
) -> None:
    monkeypatch.setattr("app.services.teams.nfl.get_current_season", lambda: 2027)

    def fake_get_season_schedule(season: int) -> pd.DataFrame:
        if season == 2027:
            return pd.DataFrame(columns=sample_standings_schedule.columns)
        return sample_standings_schedule

    monkeypatch.setattr("app.data.schedules.get_season_schedule", fake_get_season_schedule)
    monkeypatch.setattr("app.data.teams.get_teams", lambda: sample_teams)

    teams = get_current_teams()

    assert {t["team_abbr"] for t in teams} == {
        "BUF",
        "MIA",
        "NE",
        "NYJ",
        "DAL",
        "NYG",
        "PHI",
        "WAS",
    }
