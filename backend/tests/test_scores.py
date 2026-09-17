import pandas as pd
import pytest

from app.services.scores import get_last_completed_week_scores


def test_get_last_completed_week_scores_picks_the_completed_week(
    monkeypatch: pytest.MonkeyPatch, sample_schedule: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.services.scores.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.schedules.get_season_schedule", lambda season: sample_schedule)

    games = get_last_completed_week_scores()

    # Week 1 is complete (2 games); week 2 hasn't been played yet, so it's excluded.
    assert len(games) == 2
    assert all(g["week"] == 1 for g in games)


def test_get_last_completed_week_scores_converts_nan_to_none(
    monkeypatch: pytest.MonkeyPatch, sample_schedule: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.services.scores.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.schedules.get_season_schedule", lambda season: sample_schedule)

    games = get_last_completed_week_scores()
    dome_game = next(g for g in games if g["home_team"] == "LA")

    assert dome_game["temp"] is None


def test_get_last_completed_week_scores_falls_back_when_no_games_played(
    monkeypatch: pytest.MonkeyPatch, sample_schedule: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.services.scores.nfl.get_current_season", lambda: 2027)

    def fake_get_season_schedule(season: int) -> pd.DataFrame:
        if season == 2027:
            return pd.DataFrame(columns=sample_schedule.columns)  # new season, nothing played yet
        return sample_schedule

    monkeypatch.setattr("app.data.schedules.get_season_schedule", fake_get_season_schedule)

    games = get_last_completed_week_scores()

    assert len(games) == 2
    assert all(g["week"] == 1 for g in games)
