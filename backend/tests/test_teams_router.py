import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_get_teams(
    monkeypatch: pytest.MonkeyPatch,
    sample_teams: pd.DataFrame,
    sample_standings_schedule: pd.DataFrame,
) -> None:
    monkeypatch.setattr("app.services.teams.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.teams.get_teams", lambda: sample_teams)
    monkeypatch.setattr(
        "app.data.schedules.get_season_schedule", lambda season: sample_standings_schedule
    )

    response = client.get("/teams")

    assert response.status_code == 200
    body = response.json()

    codes = {t["team_abbr"] for t in body}
    assert "OAK" not in codes
    assert len(body) == 8


def test_get_team_efficiency(monkeypatch: pytest.MonkeyPatch, sample_pbp: pd.DataFrame) -> None:
    monkeypatch.setattr("app.services.team_efficiency.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.pbp.get_season_pbp", lambda season: sample_pbp)

    response = client.get("/teams/efficiency")

    assert response.status_code == 200
    body = {t["team"]: t for t in response.json()}

    assert body["A"]["offensive_epa_per_play"] == pytest.approx(0.25)
    assert body["A"]["defensive_epa_per_play"] == pytest.approx(0.3)


def test_get_team_depth_chart(depth_chart_sources: None) -> None:
    response = client.get("/teams/DAL/depth-chart")

    assert response.status_code == 200
    body = response.json()

    assert body["scheme"] == "Base 4-3 D"
    assert [group["label"] for group in body["groups"]] == [
        "3WR 1TE",
        "Base 4-3 D",
        "Special Teams",
    ]
    offense = body["groups"][0]
    quarterbacks = next(slot for slot in offense["slots"] if slot["position"] == "QB")
    assert [player["name"] for player in quarterbacks["players"]] == ["Q One", "Q Two"]
    assert [row["status"] for row in body["report"]] == [
        "IR",
        "IR",
        "PUP",
        "SUSPENDED",
        "EXEMPT",
        "OUT",
        "QUESTIONABLE",
    ]


def test_get_team_depth_chart_unknown_team(depth_chart_sources: None) -> None:
    response = client.get("/teams/XYZ/depth-chart")

    assert response.status_code == 404
