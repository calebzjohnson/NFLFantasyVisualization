import pandas as pd
import pytest

from app.services.players import get_current_player_stats


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
