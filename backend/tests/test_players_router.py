import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_get_players(monkeypatch: pytest.MonkeyPatch, sample_season_stats: pd.DataFrame) -> None:
    monkeypatch.setattr(
        "app.data.player_stats.get_season_stats", lambda season: sample_season_stats
    )

    response = client.get("/players")

    assert response.status_code == 200
    body = response.json()

    assert len(body) == 2
    wr = next(r for r in body if r["player_id"] == "W1")
    assert wr["pacr"] is None  # NaN must survive real JSON serialization as null


def test_get_players_with_sort_limit_and_fields(
    monkeypatch: pytest.MonkeyPatch, sample_season_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.player_stats.get_season_stats", lambda season: sample_season_stats
    )

    response = client.get(
        "/players?sort=-passing_yards&limit=1&fields=player_display_name,passing_yards"
    )

    assert response.status_code == 200
    body = response.json()

    assert body == [{"player_display_name": "Q One", "passing_yards": 2500}]


def test_get_players_rejects_unknown_field_with_400(
    monkeypatch: pytest.MonkeyPatch, sample_season_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.player_stats.get_season_stats", lambda season: sample_season_stats
    )

    response = client.get("/players?fields=not_a_real_field")

    assert response.status_code == 400


def test_get_weekly_players(monkeypatch: pytest.MonkeyPatch, sample_week_stats: pd.DataFrame) -> None:
    monkeypatch.setattr("app.data.player_stats.get_week_stats", lambda season: sample_week_stats)

    response = client.get("/players/weekly?position_group=QB&fields=player_id,week")

    assert response.status_code == 200
    body = response.json()
    assert [r["week"] for r in body] == [1, 2, 3]
    assert all(r["player_id"] == "Q1" for r in body)


def test_get_player_games(monkeypatch: pytest.MonkeyPatch, sample_week_stats: pd.DataFrame) -> None:
    monkeypatch.setattr("app.data.player_stats.get_week_stats", lambda season: sample_week_stats)

    response = client.get("/players/Q1/games")

    assert response.status_code == 200
    body = response.json()
    assert [g["week"] for g in body] == [1, 2, 3]


def test_get_player_games_returns_404_for_unknown_player(
    monkeypatch: pytest.MonkeyPatch, sample_week_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.data.player_stats.get_week_stats", lambda season: sample_week_stats)

    response = client.get("/players/not_a_real_player/games")

    assert response.status_code == 404


def test_get_player_bio(
    monkeypatch: pytest.MonkeyPatch, sample_players_roster: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.data.players.get_players", lambda: sample_players_roster)

    response = client.get("/players/Q1/bio")

    assert response.status_code == 200
    body = response.json()
    assert body["display_name"] == "Q One"
    assert body["status"] == "Active"


def test_get_player_bio_returns_404_for_unknown_player(
    monkeypatch: pytest.MonkeyPatch, sample_players_roster: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.data.players.get_players", lambda: sample_players_roster)

    response = client.get("/players/not_a_real_player/bio")

    assert response.status_code == 404
