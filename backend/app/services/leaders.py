import nflreadpy as nfl
import pandas as pd

from app.data import weekly
from app.schemas import LeaderCategory, LeaderRow

REGULAR_SEASON = "REG"

# (display position, metric label, weekly_data column(s) to sum, unit, position codes included)
StatCategory = tuple[str, str, tuple[str, ...], str, frozenset[str]]

STAT_CATEGORIES: list[StatCategory] = [
    ("QB", "Passing Yards", ("passing_yards",), "yds", frozenset({"QB"})),
    ("RB", "Rushing Yards", ("rushing_yards",), "yds", frozenset({"RB"})),
    ("WR", "Receiving Yards", ("receiving_yards",), "yds", frozenset({"WR"})),
    ("TE", "Receiving Yards", ("receiving_yards",), "yds", frozenset({"TE"})),
    ("DL", "Sacks", ("def_sacks",), "sacks", frozenset({"DE", "DT", "NT", "DL"})),
    (
        "LB",
        "Tackles",
        ("def_tackles_solo", "def_tackles_with_assist"),
        "tkl",
        frozenset({"OLB", "MLB", "ILB", "LB"}),
    ),
    ("CB", "Interceptions", ("def_interceptions",), "int", frozenset({"CB"})),
    ("S", "Interceptions", ("def_interceptions",), "int", frozenset({"S", "SAF", "FS", "SS"})),
    # OL has no individual-player metric in nflverse's public data (pressure/blocking
    # grades aren't tracked per player anywhere outside proprietary charting services).
]


def _position_leaders(
    weekly_data: pd.DataFrame, positions: frozenset[str], stat_cols: tuple[str, ...], limit: int
) -> list[LeaderRow]:
    rows = weekly_data[
        (weekly_data["season_type"] == REGULAR_SEASON) & (weekly_data["position"].isin(positions))
    ].copy()
    rows["_value"] = rows[list(stat_cols)].sum(axis=1)
    rows = rows.sort_values("week")

    totals = rows.groupby(["player_id", "player_display_name"], as_index=False).agg(
        total=("_value", "sum"),
        team=("team", "last"),
    )
    top = totals.sort_values("total", ascending=False).head(limit)

    players = top["player_display_name"].tolist()
    teams = top["team"].tolist()
    values = top["total"].tolist()

    return [
        LeaderRow(rank=rank, player=str(player), team=str(team), value=float(value))
        for rank, (player, team, value) in enumerate(
            zip(players, teams, values, strict=True), start=1
        )
    ]


def get_current_leaders(limit: int = 5) -> list[LeaderCategory]:
    season = nfl.get_current_season()
    weekly_data = weekly.get_weekly_data(season)
    if weekly_data.empty:
        weekly_data = weekly.get_weekly_data(season - 1)

    return [
        LeaderCategory(
            position=position,
            metric=metric,
            unit=unit,
            rows=_position_leaders(weekly_data, positions, stat_cols, limit),
        )
        for position, metric, stat_cols, unit, positions in STAT_CATEGORIES
    ]
