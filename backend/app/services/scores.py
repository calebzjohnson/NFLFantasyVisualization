from datetime import date, datetime, timedelta
from typing import Any, cast
from zoneinfo import ZoneInfo

import nflreadpy as nfl
import pandas as pd

from app.data import schedules

# NFL/fantasy weeks are anchored to Eastern time regardless of what
# timezone the server itself runs in (e.g. a UTC-based host would otherwise
# roll over to "Wednesday" several hours too early).
EASTERN = ZoneInfo("America/New_York")


def get_week_scores(week: int | None = None, today: date | None = None) -> list[dict[str, Any]]:
    """Returns every game (regular season or postseason, played or not) for
    the given week of the current season. Defaults to the current fantasy
    week, so a week's games show up as soon as they're scheduled, not only
    once they've finished.
    """
    season = nfl.get_current_season()
    schedule = schedules.get_season_schedule(season)
    if schedule.empty:
        season -= 1
        schedule = schedules.get_season_schedule(season)

    if week is None:
        week = _default_week(schedule, today)

    games = schedule[schedule["week"] == week].copy()
    games["status"] = games["home_score"].notna().map({True: "final", False: "scheduled"})

    records = games.astype(object).where(games.notna(), None).to_dict(orient="records")
    return cast(list[dict[str, Any]], records)


def _default_week(schedule: pd.DataFrame, today: date | None = None) -> int:
    """The "current" week for scoreboard purposes, following the fantasy
    football convention: a week stays current through Tuesday (the day
    after Monday Night Football), then flips to the next week on Wednesday
    - regardless of whether that week's games have actually been played.
    """
    today = today or datetime.now(EASTERN).date()
    game_days = pd.to_datetime(schedule["gameday"]).dt.date
    last_day_by_week = game_days.groupby(schedule["week"]).max().sort_index()

    weeks = [int(w) for w in last_day_by_week.index]
    week = weeks[0]
    for candidate_week, last_day in zip(weeks, last_day_by_week, strict=True):
        if today >= _next_wednesday_after(last_day):
            week = candidate_week + 1
    return min(week, max(weeks))


def _next_wednesday_after(day: date) -> date:
    candidate = day + timedelta(days=1)
    while candidate.weekday() != 2:  # Monday=0, ..., Wednesday=2
        candidate += timedelta(days=1)
    return candidate
