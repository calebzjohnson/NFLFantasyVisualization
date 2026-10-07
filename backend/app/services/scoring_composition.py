from typing import Any

import nflreadpy as nfl
import pandas as pd

from app.cache import memoized
from app.data import team_stats

REGULAR_SEASON = "REG"

# Point values per statistical event, used to translate raw counting stats
# into "how many of this team's points came from which unit" - there's no
# per-team-game "points by category" column in nflverse, so this is built
# up from counts instead. Approximate: a handful of rare edge cases (e.g. a
# defensive 2-point conversion on a botched PAT return) aren't separately
# tracked here, so the total can fall a couple points short of the team's
# real season points_for/points_against.
TD_POINTS = 6
FG_POINTS = 3
PAT_POINTS = 1
TWO_POINT = 2

CATEGORY_LABELS = {
    "passing": "Passing",
    "rushing": "Rushing",
    "defense_st": "Defense / Special Teams",
    "kicking": "Kicking",
}


def _points_by_category(rows: pd.DataFrame) -> dict[str, int]:
    """Sums a set of team-week rows into points by unit - used both for a
    team's own games (its offense) and for its opponents' rows in those same
    games (what its defense allowed). receiving_tds is deliberately excluded
    from the passing total: a passing touchdown is already credited to
    passing_tds, and adding both would double-count it.
    """
    totals = rows.sum(numeric_only=True)

    passing = totals["passing_tds"] * TD_POINTS + totals["passing_2pt_conversions"] * TWO_POINT
    rushing = totals["rushing_tds"] * TD_POINTS + totals["rushing_2pt_conversions"] * TWO_POINT
    defense_st = (
        (totals["special_teams_tds"] + totals["def_tds"] + totals["fumble_recovery_tds"])
        * TD_POINTS
        + totals["def_2pt_made"] * TWO_POINT
        + totals["def_safeties"] * TWO_POINT
    )
    kicking = totals["fg_made"] * FG_POINTS + totals["pat_made"] * PAT_POINTS

    return {
        "passing": int(passing),
        "rushing": int(rushing),
        "defense_st": int(defense_st),
        "kicking": int(kicking),
    }


def _side_breakdown(rows: pd.DataFrame) -> dict[str, Any]:
    points = _points_by_category(rows)
    return {
        "total_points": sum(points.values()),
        "categories": [
            {"key": key, "label": label, "points": points[key]}
            for key, label in CATEGORY_LABELS.items()
        ],
    }


class TeamNotFoundError(ValueError):
    """Raised when a team abbreviation has no games in the current season."""


@memoized
def get_team_scoring_composition(team: str) -> dict[str, Any]:
    """This team's points this season, broken down by unit (passing,
    rushing, defense/special teams, kicking) - both for its own offense and
    for what its defense has allowed, the data behind the team page's
    scoring composition donut.
    """
    season = nfl.get_current_season()
    stats = team_stats.get_weekly_team_stats(season)
    if stats.empty:
        season -= 1
        stats = team_stats.get_weekly_team_stats(season)
    stats = stats[stats["season_type"] == REGULAR_SEASON]

    offense_rows = stats[stats["team"] == team]
    # Each opponent's own row in a game against this team *is* what this
    # team's defense allowed that game - no self-join needed, just the rows
    # where this team was the opponent.
    defense_rows = stats[stats["opponent_team"] == team]

    if offense_rows.empty and defense_rows.empty:
        raise TeamNotFoundError(f"No games found for team: {team}")

    return {
        "team": team,
        "offense": _side_breakdown(offense_rows),
        "defense": _side_breakdown(defense_rows),
    }
