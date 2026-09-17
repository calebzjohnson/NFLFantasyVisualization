import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_get_standings(
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

    response = client.get("/standings")

    assert response.status_code == 200
    body = response.json()

    afc_east = next(d for d in body if d["division"] == "AFC East")
    assert [t["team"] for t in afc_east["teams"]] == ["BUF", "NYJ", "NE", "MIA"]
