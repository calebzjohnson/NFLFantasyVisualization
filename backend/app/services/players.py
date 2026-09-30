from typing import Any, cast

import nflreadpy as nfl
import pandas as pd

from app.data import pbp as pbp_data
from app.data import player_stats, schedules
from app.data import players as players_data
from app.services.extended_stats import (
    EXTENDED_GROUPS,
    split_specialists,
    total_tackles,
    weekly_extras,
    with_season_extras,
    with_weekly_extras,
)

REGULAR_SEASON = "REG"


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
        season -= 1
        stats = player_stats.get_season_stats(season)

    if position_group is not None:
        stats = split_specialists(stats)
        if position_group in EXTENDED_GROUPS:
            stats = with_season_extras(stats, weekly_extras(season))
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

    Only completed weeks are returned (see schedules.last_complete_week), so players
    whose teams already played this week (e.g. on Thursday night) aren't
    compared against players whose games haven't happened yet.
    """
    season = nfl.get_current_season()
    stats = player_stats.get_week_stats(season)
    if stats.empty:
        season -= 1
        stats = player_stats.get_week_stats(season)

    stats = stats[stats["season_type"] == "REG"]
    # Before the position filter: completeness is judged across every team.
    schedule = schedules.get_season_schedule(season)
    last_week = schedules.last_complete_week(stats, schedule)

    if position_group is not None:
        stats = split_specialists(stats)
        # Every group, not just EXTENDED_GROUPS: the trending chart needs snap
        # share to tell a full game from one cut short by injury, and a week
        # played without a box-score event is a real game for a trend.
        stats = with_weekly_extras(stats, weekly_extras(season))
        stats = stats[stats["position_group"] == position_group]

    stats = stats[stats["week"] <= last_week]

    stats = stats.sort_values("week", kind="stable")

    if fields is not None:
        stats = _with_fields(stats, fields)

    records = stats.astype(object).where(stats.notna(), None).to_dict(orient="records")
    return cast(list[dict[str, Any]], records)


def get_player_game_log(player_id: str) -> list[dict[str, Any]]:
    """Regular-season game-by-game stats for one player, current season,
    oldest week first. Falls back to the prior season if the current one
    hasn't started yet, matching get_current_player_stats.

    Includes a row for any week he's confirmed to have played (via snap
    counts) but recorded no statistical events - without this, a quiet week
    would just be missing from the table rather than showing as a real,
    played-but-quiet week. Rows carry snap counts and PFR's advanced defense
    too (see extended_stats), for the defensive and offensive line logs.
    """
    season = nfl.get_current_season()
    stats = player_stats.get_week_stats(season)
    if stats.empty:
        season -= 1
        stats = player_stats.get_week_stats(season)

    extras = weekly_extras(season)
    games = with_weekly_extras(
        stats[stats["player_id"] == player_id], extras[extras["player_id"] == player_id]
    )
    games = games[games["season_type"] == REGULAR_SEASON]
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


# position_group -> which "share" a market-share donut should show.
# Targets are framed as this player vs. the rest of the whole team (not just
# their position group), since offensive snaps overlap across positions -
# e.g. three WRs can be on the field at once, so shares within a position
# group don't sum to a clean 100%. Touches don't have that problem within the
# backfield specifically (one ball-carrier at a time), so those are pooled
# across just the team's RBs/FBs instead. QBs get a different shape entirely
# (see get_player_usage_share) - not a share of one stat, but every team
# touchdown split into "this QB was involved" vs. not. Defenders are framed
# against the whole team too - pressures for linemen (their main job), tackles
# for linebackers and defensive backs. Groups not listed here (OL, K, P) have
# no usage donut.
USAGE_METRIC_BY_POSITION_GROUP = {
    "RB": ("touches", "Touch Share vs Backfield"),
    "FB": ("touches", "Touch Share vs Backfield"),
    "WR": ("targets", "Target Share"),
    "TE": ("targets", "Target Share"),
    "DL": ("pressures", "Pressure Share"),
    "LB": ("tackles", "Tackle Share"),
    "DB": ("tackles", "Tackle Share"),
}


def _usage_amount(stats: pd.DataFrame, metric: str) -> pd.Series:
    if metric == "touches":
        return stats["carries"] + stats["receptions"]
    if metric == "tackles":
        return total_tackles(stats).fillna(0)
    if metric == "pressures":
        return stats["def_pressures"].fillna(0)
    return stats["targets"]


def _usage_pool(team_stats: pd.DataFrame, metric: str) -> pd.DataFrame:
    if metric == "touches":
        return team_stats[team_stats["position_group"].isin(["RB", "FB"])]
    return team_stats


def _headshot_by_id() -> dict[str, str]:
    """gsis_id -> headshot URL, from the standing roster table (not
    season-scoped) - a single shared lookup so every weekly-usage code path
    (season-stats-based pools and play-by-play-based TD involvement alike)
    sources headshots the same way.
    """
    roster = players_data.get_players()
    return cast(
        dict[str, str],
        roster.dropna(subset=["gsis_id", "headshot"]).set_index("gsis_id")["headshot"].to_dict(),
    )


def _weekly_player_lines(
    weekly_totals: "pd.Series[int]",
    season_totals: "pd.Series[int]",
    name_by_id: dict[str, str],
    headshot_by_id: dict[str, str],
    focus_player_id: str,
) -> list[dict[str, Any]]:
    """Every week's amount broken out by player - one line per player in the
    pool (the focus player included), ordered by season total descending so
    the chart's legend/line order is stable and meaningful. weekly_totals
    and season_totals are both indexed by player_id (weekly_totals
    additionally by week).
    """
    all_ids = [focus_player_id, *season_totals.drop(index=focus_player_id, errors="ignore")
               .sort_values(ascending=False).index]

    weeks = sorted({week for week, _ in weekly_totals.index})
    rows = []
    for week in weeks:
        team_value = int(weekly_totals.xs(week, level=0).sum())
        players = [
            {
                "player_id": player_id,
                "name": name_by_id.get(player_id, player_id),
                "headshot_url": headshot_by_id.get(player_id),
                "value": int(weekly_totals.get((week, player_id), 0)),
            }
            for player_id in all_ids
        ]
        rows.append({"week": int(week), "team_value": team_value, "players": players})
    return rows


def _qb_td_weekly(
    touchdowns: pd.DataFrame,
    involved: "pd.Series[bool]",
    player_id: str,
    player_name: str,
    headshot_by_id: dict[str, str],
) -> list[dict[str, Any]]:
    """Every week's touchdowns split into just 2 lines - this QB's own
    involvement vs. every other touchdown lumped together - unlike the other
    usage metrics, which get one line per individual player.
    """
    weeks = sorted(touchdowns["week"].unique())
    involved_by_week = touchdowns[involved].groupby("week").size()
    team_by_week = touchdowns.groupby("week").size()
    rows = []
    for week in weeks:
        team_value = int(team_by_week.get(week, 0))
        involved_value = int(involved_by_week.get(week, 0))
        rows.append(
            {
                "week": int(week),
                "team_value": team_value,
                "players": [
                    {
                        "player_id": player_id,
                        "name": player_name,
                        "headshot_url": headshot_by_id.get(player_id),
                        "value": involved_value,
                    },
                    {
                        "player_id": None,
                        "name": "Other",
                        "headshot_url": None,
                        "value": team_value - involved_value,
                    },
                ],
            }
        )
    return rows


def _qb_td_involvement(player_id: str, player_name: str, team: str, season: int) -> dict[str, Any]:
    """Every one of the team's touchdowns this season, split into "this QB
    threw or ran it in" vs. not - determined play-by-play (who was the passer
    or rusher on each scoring play), not by summing season stat columns. A
    season total can't tell "his passing TDs" apart from "TDs the team's
    receivers happened to catch," since those are the same scores counted two
    different ways; only the play-level passer/rusher IDs can.
    """
    plays = pbp_data.get_season_pbp(season)
    if plays.empty:
        plays = pbp_data.get_season_pbp(season - 1)

    touchdowns = plays[
        (plays["season_type"] == REGULAR_SEASON)
        & (plays["posteam"] == team)
        & ((plays["pass_touchdown"] == 1) | (plays["rush_touchdown"] == 1))
    ]

    involved = (touchdowns["passer_player_id"] == player_id) | (
        touchdowns["rusher_player_id"] == player_id
    )
    not_involved = touchdowns[~involved]

    # Who actually scored the touchdowns this QB wasn't involved in - the
    # receiver on a pass TD, the ball-carrier on a rush TD.
    scorer_ids = not_involved["receiver_player_id"].where(
        not_involved["pass_touchdown"] == 1, not_involved["rusher_player_id"]
    )
    scorer_names = not_involved["receiver_player_name"].where(
        not_involved["pass_touchdown"] == 1, not_involved["rusher_player_name"]
    )
    breakdown = (
        pd.DataFrame({"player_id": scorer_ids, "name": scorer_names})
        .groupby(["player_id", "name"])
        .size()
        .reset_index(name="count")
        .sort_values("count", ascending=False, kind="stable")
    )

    return {
        "player_id": player_id,
        "team": team,
        "metric": "td_involvement",
        "label": "TD Involvement",
        "player_value": int(involved.sum()),
        "team_value": int(len(touchdowns)),
        "teammates": [
            {"player_id": row["player_id"], "name": row["name"], "value": int(row["count"])}
            for _, row in breakdown.iterrows()
        ],
        "weekly": _qb_td_weekly(touchdowns, involved, player_id, player_name, _headshot_by_id()),
    }


def _usage_weekly(team: str, season: int, player_id: str, metric: str) -> list[dict[str, Any]]:
    week_stats = player_stats.get_week_stats(season)
    if week_stats.empty:
        week_stats = player_stats.get_week_stats(season - 1)
    is_regular_season = week_stats["season_type"] == REGULAR_SEASON
    week_stats = week_stats[is_regular_season & (week_stats["team"] == team)]
    if metric == "pressures":
        extras = weekly_extras(season)
        week_stats = with_weekly_extras(week_stats, extras[extras["team"] == team])

    pool = _usage_pool(week_stats, metric)
    pool = pool.assign(usage_amount=_usage_amount(pool, metric))

    weekly_totals = pool.groupby(["week", "player_id"])["usage_amount"].sum()
    season_totals = pool.groupby("player_id")["usage_amount"].sum()
    name_by_id = cast(
        dict[str, str],
        pool.drop_duplicates("player_id").set_index("player_id")["player_display_name"].to_dict(),
    )

    return _weekly_player_lines(
        weekly_totals, season_totals, name_by_id, _headshot_by_id(), player_id
    )


def get_player_usage_share(player_id: str) -> dict[str, Any]:
    """This player's share of touches/targets (whichever applies to their
    position) vs. the rest of the relevant pool, or - for a QB - their
    involvement in the team's touchdowns. For a market-share donut on the
    player page.
    """
    season = nfl.get_current_season()
    stats = player_stats.get_season_stats(season)
    if stats.empty:
        season -= 1
        stats = player_stats.get_season_stats(season)

    player_rows = stats[stats["player_id"] == player_id]
    if player_rows.empty:
        raise PlayerNotFoundError(f"No stats found for player_id: {player_id}")
    player = player_rows.iloc[0]

    if player["position_group"] == "QB":
        return _qb_td_involvement(
            player_id, player["player_display_name"], player["recent_team"], season
        )

    usage = USAGE_METRIC_BY_POSITION_GROUP.get(player["position_group"])
    if usage is None:
        raise PlayerNotFoundError(f"No usage profile for player_id: {player_id}")
    metric, label = usage

    team_stats = stats[stats["recent_team"] == player["recent_team"]]
    if metric == "pressures":
        extras = weekly_extras(season)
        team_stats = with_season_extras(team_stats, extras[extras["team"] == player["recent_team"]])
        player_rows = team_stats[team_stats["player_id"] == player_id]
    pool = _usage_pool(team_stats, metric)
    pool = pool.assign(usage_amount=_usage_amount(pool, metric))

    # Everyone else in the pool with a non-zero amount, largest first - the
    # breakdown shown when hovering the "rest of team" donut slice.
    teammates = pool[(pool["player_id"] != player_id) & (pool["usage_amount"] > 0)].sort_values(
        "usage_amount", ascending=False, kind="stable"
    )

    return {
        "player_id": player_id,
        "team": player["recent_team"],
        "metric": metric,
        "label": label,
        "player_value": int(_usage_amount(player_rows, metric).iloc[0]),
        "team_value": int(pool["usage_amount"].sum()),
        "teammates": [
            {
                "player_id": row["player_id"],
                "name": row["player_display_name"],
                "value": int(row["usage_amount"]),
            }
            for _, row in teammates.iterrows()
        ],
        "weekly": _usage_weekly(player["recent_team"], season, player_id, metric),
    }


def _sorted(stats: pd.DataFrame, sort: str) -> pd.DataFrame:
    descending = sort.startswith("-")
    column = sort[1:] if descending else sort
    if column not in stats.columns:
        raise InvalidQueryError(f"Unknown sort field: {column}")
    # kind="stable" so players tied on the sort field keep a consistent,
    # deterministic relative order instead of one that can vary between
    # runs/platforms (the default "quicksort" isn't stable).
    return stats.sort_values(column, ascending=not descending, na_position="last", kind="stable")


def _with_fields(stats: pd.DataFrame, fields: list[str]) -> pd.DataFrame:
    unknown = [field for field in fields if field not in stats.columns]
    if unknown:
        raise InvalidQueryError(f"Unknown fields: {', '.join(unknown)}")
    return stats[fields]
