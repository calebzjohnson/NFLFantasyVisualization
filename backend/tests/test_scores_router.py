import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_get_scores_for_a_specific_week(
    monkeypatch: pytest.MonkeyPatch, sample_schedule: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.services.scores.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.schedules.get_season_schedule", lambda season: sample_schedule)

    response = client.get("/scores?week=1")

    assert response.status_code == 200
    body = response.json()

    assert len(body) == 2
    assert all(g["week"] == 1 and g["status"] == "final" for g in body)


def test_get_scores_includes_unplayed_games(
    monkeypatch: pytest.MonkeyPatch, sample_schedule: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.services.scores.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.schedules.get_season_schedule", lambda season: sample_schedule)

    response = client.get("/scores?week=2")

    assert response.status_code == 200
    body = response.json()

    assert len(body) == 1
    assert body[0]["status"] == "scheduled"
    assert body[0]["home_score"] is None
