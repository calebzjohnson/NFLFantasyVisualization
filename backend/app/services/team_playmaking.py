from typing import Any, cast

import nflreadpy as nfl
import pandas as pd

from app.cache import memoized
from app.data import pbp, player_stats
from app.data import players as players_data
from app.services.extended_stats import total_tackles
from app.services.players import (
    _usage_amount,
    _usage_pool,
    _usage_weekly,
    headshot_by_id,
)

REGULAR_SEASON = "REG"
RED_ZONE_YARDLINE = 20
LEADERS_SHOWN = 5

# Season-total columns behind the leaders row. Tackles are computed rather than
# read: total_tackles is the site's definition everywhere else.
LEADER_METRICS = (
    ("receiving_yards", "Receiving Yards"),
    ("rushing_yards", "Rushing Yards"),
    ("def_sacks", "Sacks"),
    ("tackles", "Tackles"),
    ("def_interceptions", "Interceptions"),
)


class TeamNotFoundError(ValueError):
    """Raised when a team abbreviation has no players this season."""


def _usage_section(team: str, season: int, stats: pd.DataFrame, metric: str) -> dict[str, Any]:
    """The same payload /players/{id}/usage returns, with no focus player."""
    team_stats = stats[stats["recent_team"] == team]
    pool = _usage_pool(team_stats, metric)
    pool = pool.assign(usage_amount=_usage_amount(pool, metric))
    ranked = pool[pool["usage_amount"] > 0].sort_values("usage_amount", ascending=False)

    return {
        "player_id": None,
        "team": team,
        "metric": metric,
        "label": "Backfield Split" if metric == "touches" else "Target Split",
        "player_value": 0,
        "team_value": int(pool["usage_amount"].sum()),
        "teammates": [
            {
                "player_id": row.player_id,
                "name": row.player_display_name,
                "value": int(str(row.usage_amount)),
            }
            for row in ranked.itertuples()
        ],
        "weekly": _usage_weekly(team, season, None, metric),
    }


def _roster_names() -> dict[str, str]:
    """gsis_id -> display name. Play-by-play abbreviates ("K.Walker"), so names
    come from the roster to match the rest of the page.
    """
    roster = players_data.get_players()
    return cast(
        dict[str, str],
        roster.dropna(subset=["gsis_id", "display_name"])
        .set_index("gsis_id")["display_name"]
        .to_dict(),
    )


def _red_zone(team: str, season: int, headshots: dict[str, str]) -> dict[str, Any]:
    """Red zone touches by player: carries plus receptions inside the 20.

    Counts, not percentages - the browser divides, the same way usage does.
    """
    plays = pbp.get_season_pbp(season)
    red_zone = plays[
        (plays["season_type"] == REGULAR_SEASON)
        & (plays["yardline_100"] <= RED_ZONE_YARDLINE)
        & (plays["posteam"] == team)
    ]
    runs = red_zone[(red_zone["play_type"] == "run") & red_zone["rusher_player_id"].notna()]
    catches = red_zone[
        (red_zone["play_type"] == "pass")
        & (red_zone["complete_pass"] == 1)
        & red_zone["receiver_player_id"].notna()
    ]

    touches = (
        runs.groupby("rusher_player_id")
        .size()
        .add(catches.groupby("receiver_player_id").size(), fill_value=0)
        .sort_values(ascending=False)
    )
    name_by_id = _roster_names()

    players = [
        {
            "player_id": str(player_id),
            "name": name_by_id.get(str(player_id)),
            "headshot_url": headshots.get(str(player_id)),
            "touches": int(count),
        }
        for player_id, count in touches.items()
    ]
    return {"total": int(touches.sum()), "players": players}


def _leaders(stats: pd.DataFrame, team: str, headshots: dict[str, str]) -> list[dict[str, Any]]:
    """Top five in each stat, skipping anyone on zero. Ties keep their source
    order rather than being broken: this early most defensive counts are 1s,
    and inventing an order would claim a ranking the data doesn't support.
    """
    rows = stats[stats["recent_team"] == team]
    team_stats = rows.assign(tackles=total_tackles(rows))

    leaders = []
    for key, label in LEADER_METRICS:
        recorded = team_stats[team_stats[key] > 0]
        top = recorded.nlargest(LEADERS_SHOWN, key, keep="first")
        leaders.append(
            {
                "key": key,
                "label": label,
                "players": [
                    {
                        "player_id": row.player_id,
                        "name": row.player_display_name,
                        "headshot_url": headshots.get(str(row.player_id)),
                        "value": float(getattr(row, key)),
                    }
                    for row in top.itertuples()
                ],
            }
        )
    return leaders


@memoized
def get_team_playmaking(team: str) -> dict[str, Any]:
    """How this team spreads the ball around and who produces with it - the
    backfield's touches, the pass catchers' targets, red zone touches, and
    season leaders. The data behind the team page's Playmaking tab.
    """
    season = nfl.get_current_season()
    stats = player_stats.get_season_stats(season)
    if stats.empty:
        season -= 1
        stats = player_stats.get_season_stats(season)

    if stats.empty or team not in set(stats["recent_team"]):
        raise TeamNotFoundError(f"No players found for team: {team}")

    headshots = headshot_by_id()
    return {
        "team": team,
        "touches": _usage_section(team, season, stats, "touches"),
        "targets": _usage_section(team, season, stats, "targets"),
        "red_zone": _red_zone(team, season, headshots),
        "leaders": _leaders(stats, team, headshots),
    }
