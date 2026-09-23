from typing import Any, cast

import nflreadpy as nfl
import pandas as pd

from app.data import player_stats
from app.data import players as players_data


class InvalidQueryError(ValueError):
    """Raised when a query parameter names a field that doesn't exist."""


class PlayerNotFoundError(ValueError):
    """Raised when a player_id doesn't match anything nflverse has."""


# nflverse roster status codes -> display labels. Codes without an entry here
# fall back to the raw code, so an unmapped one degrades instead of erroring.
STATUS_LABELS = {
    "ACT": "Active",
    "RES": "Reserve",
    "CUT": "Released",
    "DEV": "Practice Squad",
    "PUP": "PUP",
    "NWT": "Not With Team",
    "SUS": "Suspended",
    "RET": "Retired",
}


def get_current_player_stats(
    sort: str | None = None,
    limit: int | None = None,
    fields: list[str] | None = None,
    position_group: str | None = None,
) -> list[dict[str, Any]]:
    season = nfl.get_current_season()
    stats = player_stats.get_season_stats(season)
    if stats.empty:
        stats = player_stats.get_season_stats(season - 1)

    if position_group is not None:
        stats = stats[stats["position_group"] == position_group]

    if sort is not None:
        stats = _sorted(stats, sort)

    if limit is not None:
        stats = stats.head(limit)

    if fields is not None:
        stats = _with_fields(stats, fields)

    # NaN isn't valid JSON; convert missing values (e.g. a WR's passer rating)
    # to None so they serialize as null instead of breaking the response.
    records = stats.astype(object).where(stats.notna(), None).to_dict(orient="records")
    return cast(list[dict[str, Any]], records)


def get_weekly_player_stats(
    position_group: str | None = None,
    fields: list[str] | None = None,
) -> list[dict[str, Any]]:
    """One row per player per regular-season game this season, for every
    player at a position (not just one) - backs the trending-players chart,
    which needs to compare week-by-week movement across a whole position.
    """
    season = nfl.get_current_season()
    stats = player_stats.get_week_stats(season)
    if stats.empty:
        stats = player_stats.get_week_stats(season - 1)

    stats = stats[stats["season_type"] == "REG"]

    if position_group is not None:
        stats = stats[stats["position_group"] == position_group]

    stats = stats.sort_values("week", kind="stable")

    if fields is not None:
        stats = _with_fields(stats, fields)

    records = stats.astype(object).where(stats.notna(), None).to_dict(orient="records")
    return cast(list[dict[str, Any]], records)


def get_player_game_log(player_id: str) -> list[dict[str, Any]]:
    """Regular-season game-by-game stats for one player, current season,
    oldest week first. Falls back to the prior season if the current one
    hasn't started yet, matching get_current_player_stats.
    """
    season = nfl.get_current_season()
    stats = player_stats.get_week_stats(season)
    if stats.empty:
        stats = player_stats.get_week_stats(season - 1)

    games = stats[(stats["player_id"] == player_id) & (stats["season_type"] == "REG")]
    if games.empty:
        raise PlayerNotFoundError(f"No games found for player_id: {player_id}")

    games = games.sort_values("week", kind="stable")

    records = games.astype(object).where(games.notna(), None).to_dict(orient="records")
    return cast(list[dict[str, Any]], records)


def get_player_bio(player_id: str) -> dict[str, Any]:
    """Bio/roster info for one player - name, team, position, physical
    measurables, draft info, and status - for the page header bar.
    """
    roster = players_data.get_players()
    match = roster[roster["gsis_id"] == player_id]
    if match.empty:
        raise PlayerNotFoundError(f"No player found for player_id: {player_id}")

    player = match.iloc[0]
    player = player.where(player.notna(), None)

    return {
        "player_id": player_id,
        "display_name": player["display_name"],
        "position": player["position"],
        "team": player["latest_team"],
        "jersey_number": player["jersey_number"],
        "height_in": player["height"],
        "weight_lb": player["weight"],
        "birth_date": player["birth_date"],
        "college": player["college_name"],
        "status": STATUS_LABELS.get(player["status"], player["status"]),
        "draft_year": player["draft_year"],
        "draft_round": player["draft_round"],
        "draft_pick": player["draft_pick"],
        "draft_team": player["draft_team"],
        "headshot_url": player["headshot"],
    }


def _sorted(stats: pd.DataFrame, sort: str) -> pd.DataFrame:
    descending = sort.startswith("-")
    column = sort[1:] if descending else sort
    if column not in stats.columns:
        raise InvalidQueryError(f"Unknown sort field: {column}")
    # kind="stable" so players tied on the sort field keep a consistent,
    # deterministic relative order instead of one that can vary between
    # runs/platforms (the default "quicksort" isn't stable).
    return stats.sort_values(
        column, ascending=not descending, na_position="last", kind="stable"
    )


def _with_fields(stats: pd.DataFrame, fields: list[str]) -> pd.DataFrame:
    unknown = [field for field in fields if field not in stats.columns]
    if unknown:
        raise InvalidQueryError(f"Unknown fields: {', '.join(unknown)}")
    return stats[fields]
