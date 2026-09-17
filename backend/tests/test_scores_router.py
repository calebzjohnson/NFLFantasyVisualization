import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_get_scores(monkeypatch: pytest.MonkeyPatch, sample_schedule: pd.DataFrame) -> None:
    monkeypatch.setattr("app.services.scores.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.schedules.get_season_schedule", lambda season: sample_schedule)

    response = client.get("/scores")

    assert response.status_code == 200
    body = response.json()

    assert len(body) == 2
    assert all(g["week"] == 1 for g in body)
