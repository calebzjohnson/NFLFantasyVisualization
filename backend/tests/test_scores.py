from datetime import UTC, date, datetime

import pandas as pd
import pytest

from app.services.scores import _default_week, get_week_scores


def test_get_week_scores_returns_unplayed_games_too(
    monkeypatch: pytest.MonkeyPatch, sample_schedule: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.services.scores.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.schedules.get_season_schedule", lambda season: sample_schedule)

    games = get_week_scores(week=2)

    # Week 2's game hasn't been played (NaN scores) but must still show up.
    assert len(games) == 1
    assert games[0]["status"] == "scheduled"
    assert games[0]["home_score"] is None


def test_get_week_scores_marks_played_games_final(
    monkeypatch: pytest.MonkeyPatch, sample_schedule: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.services.scores.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.schedules.get_season_schedule", lambda season: sample_schedule)

    games = get_week_scores(week=1)

    assert len(games) == 2
    assert all(g["status"] == "final" for g in games)


def test_get_week_scores_converts_nan_to_none(
    monkeypatch: pytest.MonkeyPatch, sample_schedule: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.services.scores.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.schedules.get_season_schedule", lambda season: sample_schedule)

    games = get_week_scores(week=1)
    dome_game = next(g for g in games if g["home_team"] == "LA")

    assert dome_game["temp"] is None


def test_get_week_scores_defaults_to_current_fantasy_week(
    monkeypatch: pytest.MonkeyPatch, sample_schedule: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.services.scores.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.schedules.get_season_schedule", lambda season: sample_schedule)

    # Wednesday after week 1's last game (Monday 2026-09-14) -> week 2 is current.
    games = get_week_scores(today=date(2026, 9, 16))

    assert all(g["week"] == 2 for g in games)


def test_get_week_scores_falls_back_when_no_games_played(
    monkeypatch: pytest.MonkeyPatch, sample_schedule: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.services.scores.nfl.get_current_season", lambda: 2027)

    def fake_get_season_schedule(season: int) -> pd.DataFrame:
        if season == 2027:
            return pd.DataFrame(columns=sample_schedule.columns)
        return sample_schedule

    monkeypatch.setattr("app.data.schedules.get_season_schedule", fake_get_season_schedule)

    games = get_week_scores(week=1)

    assert len(games) == 2


def test_default_week_stays_on_last_week_through_tuesday(sample_schedule: pd.DataFrame) -> None:
    # Week 1's last game is Monday 2026-09-14.
    assert _default_week(sample_schedule, date(2026, 9, 14)) == 1  # Monday itself
    assert _default_week(sample_schedule, date(2026, 9, 15)) == 1  # Tuesday


def test_default_week_flips_on_wednesday(sample_schedule: pd.DataFrame) -> None:
    assert _default_week(sample_schedule, date(2026, 9, 16)) == 2  # Wednesday
    assert _default_week(sample_schedule, date(2026, 9, 17)) == 2  # Thursday


def test_default_week_clamps_to_the_latest_week_in_the_schedule(
    sample_schedule: pd.DataFrame,
) -> None:
    # Wednesday after week 2's last game (2026-09-21) would be week 3, but
    # the fixture only has data through week 2 - must not overshoot.
    assert _default_week(sample_schedule, date(2026, 9, 23)) == 2


def test_default_week_uses_eastern_time_not_utc(
    monkeypatch: pytest.MonkeyPatch, sample_schedule: pd.DataFrame
) -> None:
    # 2026-09-16 02:00 UTC is already Wednesday in UTC, but it's still
    # 2026-09-15 22:00 EDT - Tuesday evening in Eastern time. If the code
    # used UTC (or a UTC-based server's local time) instead of Eastern, it
    # would flip to week 2 several hours too early.
    fixed_utc_instant = datetime(2026, 9, 16, 2, 0, tzinfo=UTC)

    class FakeDatetime:
        @classmethod
        def now(cls, tz: object = None) -> datetime:
            return fixed_utc_instant.astimezone(tz)  # type: ignore[arg-type]

    monkeypatch.setattr("app.services.scores.datetime", FakeDatetime)

    assert _default_week(sample_schedule) == 1  # still Tuesday in Eastern
