import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_get_leaders(monkeypatch: pytest.MonkeyPatch, sample_weekly_data: pd.DataFrame) -> None:
    monkeypatch.setattr("app.data.weekly.get_weekly_data", lambda season: sample_weekly_data)

    response = client.get("/leaders")

    assert response.status_code == 200
    body = response.json()
    assert [category["position"] for category in body] == [
        "QB", "RB", "WR", "TE", "DL", "LB", "CB", "S",
    ]

    qb = next(category for category in body if category["position"] == "QB")
    assert qb["metric"] == "Passing Yards"
    assert qb["unit"] == "yds"
    assert qb["rows"][0] == {"rank": 1, "player": "Q One", "team": "DAL", "value": 550}
