from typing import Any, cast

import nflreadpy as nfl
import pandas as pd

from app.cache import memoized
from app.data import schedules, team_stats, teams
from app.services import tiebreakers

DIVISION_ORDER = [
    "AFC East",
    "AFC North",
    "AFC South",
    "AFC West",
    "NFC East",
    "NFC North",
    "NFC South",
    "NFC West",
]


@memoized
def get_current_standings() -> list[dict[str, Any]]:
    season = nfl.get_current_season()
    game_log = schedules.get_team_game_log(season)
    if game_log.empty:
        season -= 1
        game_log = schedules.get_team_game_log(season)

    weekly_team_stats = team_stats.get_weekly_team_stats(season)
    records, orders = _division_orders(game_log, weekly_team_stats)

    # Places going into the newest week, for the standings' movement arrows.
    # Empty before a second week has been played, so no team gets one.
    latest_week = game_log["week"].max()
    earlier_games = game_log[game_log["week"] < latest_week]
    previous_place: dict[str, int] = {}
    if not earlier_games.empty:
        earlier_stats = weekly_team_stats[weekly_team_stats["week"] < latest_week]
        _, previous_orders = _division_orders(earlier_games, earlier_stats)
        for previous_order in previous_orders.values():
            previous_place.update({team: place for place, team in enumerate(previous_order, 1)})

    standings = []
    for division, order in orders.items():
        ordered = records.set_index("team").loc[order].reset_index()
        ordered = ordered.drop(columns=["team_division", "team_conf"])
        rows = ordered.astype(object).where(ordered.notna(), None).to_dict(orient="records")
        for row in rows:
            row["previous_place"] = previous_place.get(row["team"])
        standings.append({"division": division, "teams": rows})

    return cast(list[dict[str, Any]], standings)


def _division_orders(
    game_log: pd.DataFrame, weekly_team_stats: pd.DataFrame
) -> tuple[pd.DataFrame, dict[str, list[str]]]:
    """Every team's record, plus each division's teams in tiebreaker order."""
    records = _with_team_info(_team_records(game_log))
    ctx = tiebreakers.TiebreakContext(
        game_log=game_log, team_records=records, weekly_team_stats=weekly_team_stats
    )
    orders = {
        division: _resolve_division_order(records[records["team_division"] == division], ctx)
        for division in DIVISION_ORDER
    }
    return records, orders


def _resolve_division_order(
    division_records: pd.DataFrame, ctx: tiebreakers.TiebreakContext
) -> list[str]:
    order: list[str] = []
    for win_pct in sorted(division_records["win_pct"].unique(), reverse=True):
        tied_group = division_records.loc[division_records["win_pct"] == win_pct, "team"].tolist()
        for bucket in tiebreakers.resolve_tie(tied_group, ctx):
            order.extend(bucket)
    return order


def _team_records(game_log: pd.DataFrame) -> pd.DataFrame:
    records = game_log.groupby("team", as_index=False).agg(
        wins=("win", "sum"),
        losses=("loss", "sum"),
        ties=("tie", "sum"),
        points_for=("points_for", "sum"),
        points_against=("points_against", "sum"),
    )
    games_played = records["wins"] + records["losses"] + records["ties"]
    records["win_pct"] = (records["wins"] + 0.5 * records["ties"]) / games_played
    return records


def _with_team_info(records: pd.DataFrame) -> pd.DataFrame:
    team_info = teams.get_teams()[["team_abbr", "team_division", "team_conf"]]
    return records.merge(team_info, left_on="team", right_on="team_abbr", how="inner").drop(
        columns=["team_abbr"]
    )
