from typing import Any, cast

import nflreadpy as nfl

from app.data import schedules, teams


def get_current_teams() -> list[dict[str, Any]]:
    """Returns nflverse's team registry, filtered to teams that actually
    appear in the current season's schedule.

    get_teams() includes historical/relocated franchise codes (OAK, SD,
    STL, etc.) with no reliable flag distinguishing them from current teams
    (a retired code's logo even points at the current franchise's logo), so
    filtering against real schedule data is the only way to get exactly the
    32 current teams.
    """
    season = nfl.get_current_season()
    current_codes = _team_codes_in_schedule(season)
    if not current_codes:
        season -= 1
        current_codes = _team_codes_in_schedule(season)

    all_teams = teams.get_teams()
    current = all_teams[all_teams["team_abbr"].isin(current_codes)]

    records = current.astype(object).where(current.notna(), None).to_dict(orient="records")
    return cast(list[dict[str, Any]], records)


def _team_codes_in_schedule(season: int) -> set[str]:
    schedule = schedules.get_season_schedule(season)
    return set(schedule["home_team"]) | set(schedule["away_team"])
