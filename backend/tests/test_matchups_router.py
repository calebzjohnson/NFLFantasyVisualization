import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.fixture
def matchup_sources(
    monkeypatch: pytest.MonkeyPatch,
    sample_schedule: pd.DataFrame,
    matchup_plays: pd.DataFrame,
) -> None:
    monkeypatch.setattr("app.services.matchups.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.schedules.get_season_schedule", lambda season: sample_schedule)
    monkeypatch.setattr("app.data.pbp.get_season_pbp", lambda season: matchup_plays)


def test_get_matchup_returns_a_breakdown(matchup_sources: None) -> None:
    response = client.get("/matchups/2026_01_DAL_NYG")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "final"
    assert len(body["breakdown"]["drives"]) == 3


def test_get_matchup_returns_a_preview(matchup_sources: None) -> None:
    response = client.get("/matchups/2026_02_DET_BUF")

    assert response.status_code == 200
    assert response.json()["status"] == "scheduled"


def test_get_matchup_404s_for_an_unknown_game(matchup_sources: None) -> None:
    response = client.get("/matchups/2026_01_NOT_REAL")

    assert response.status_code == 404
