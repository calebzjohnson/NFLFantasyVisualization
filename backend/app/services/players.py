from typing import Any, cast

import nflreadpy as nfl
import pandas as pd

from app.data import player_stats


class InvalidQueryError(ValueError):
    """Raised when a query parameter names a field that doesn't exist."""


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


def _sorted(stats: pd.DataFrame, sort: str) -> pd.DataFrame:
    descending = sort.startswith("-")
    column = sort[1:] if descending else sort
    if column not in stats.columns:
        raise InvalidQueryError(f"Unknown sort field: {column}")
    return stats.sort_values(column, ascending=not descending, na_position="last")


def _with_fields(stats: pd.DataFrame, fields: list[str]) -> pd.DataFrame:
    unknown = [field for field in fields if field not in stats.columns]
    if unknown:
        raise InvalidQueryError(f"Unknown fields: {', '.join(unknown)}")
    return stats[fields]
