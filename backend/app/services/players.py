from typing import Any, cast

import nflreadpy as nfl
import pandas as pd

from app.data import pbp as pbp_data
from app.data import player_stats, schedules, snap_counts
from app.data import players as players_data

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


def _last_complete_week(stats: pd.DataFrame, schedule: pd.DataFrame) -> int:
    """The latest regular-season week whose stats are fully in: every team
    scheduled that week has rows in `stats`. nflverse loads a week's stats
    one game day at a time (Thursday, then Sunday, then Monday), so the
    newest week is often partial. Weeks before the newest one are always
    treated as complete, since a later week having stats means they're over
    (and canceled games are removed from nflverse's schedule, so they can't
    hold a week open). Teams on bye aren't on that week's schedule, so they
    aren't required.
    """
    if stats.empty:
        return 0
    latest = int(stats["week"].max())
    games = schedule[(schedule["game_type"] == REGULAR_SEASON) & (schedule["week"] == latest)]
    scheduled = set(games["home_team"]) | set(games["away_team"])
    reported = set(stats.loc[stats["week"] == latest, "team"])
    return latest if scheduled <= reported else latest - 1


def get_weekly_player_stats(
    position_group: str | None = None,
    fields: list[str] | None = None,
) -> list[dict[str, Any]]:
    """One row per player per regular-season game this season, for every
    player at a position (not just one) - backs the trending-players chart,
    which needs to compare week-by-week movement across a whole position.

    Only completed weeks are returned (see _last_complete_week), so players
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
    stats = stats[stats["week"] <= _last_complete_week(stats, schedule)]

    if position_group is not None:
        stats = stats[stats["position_group"] == position_group]

    stats = stats.sort_values("week", kind="stable")

    if fields is not None:
        stats = _with_fields(stats, fields)

    records = stats.astype(object).where(stats.notna(), None).to_dict(orient="records")
    return cast(list[dict[str, Any]], records)
def _snap_weeks(player_id: str, season: int) -> pd.DataFrame:
    """This player's weekly snap-count rows (team, opponent), indexed by
    week - confirms which weeks he actually played. nflverse's stat pipeline
    only emits a row for a player-week when he had some statistical event (a
    target, a carry, ...), silently dropping weeks where he played but
    recorded nothing; snap counts are participation-based, so they still
    have a row for those weeks.
    """
    snaps = snap_counts.get_season_snap_counts(season)
    snaps = snaps[snaps["game_type"] == REGULAR_SEASON]
    snaps = snaps.assign(gsis_id=snaps["pfr_player_id"].map(snap_counts.get_pfr_to_gsis_map()))
    mine = snaps[(snaps["gsis_id"] == player_id) & (snaps["offense_snaps"] > 0)]
    return mine.set_index("week")[["team", "opponent"]]


def get_player_game_log(player_id: str) -> list[dict[str, Any]]:
    """Regular-season game-by-game stats for one player, current season,
    oldest week first. Falls back to the prior season if the current one
    hasn't started yet, matching get_current_player_stats.

    Includes a zero-stat row for any week he's confirmed to have played
    (via snap counts) but recorded no statistical events - without this, a
    scoreless week would just be missing from the table entirely rather than
    showing as a real, played-but-quiet week.
    """
    season = nfl.get_current_season()
    stats = player_stats.get_week_stats(season)
    if stats.empty:
        season -= 1
        stats = player_stats.get_week_stats(season)

    games = stats[(stats["player_id"] == player_id) & (stats["season_type"] == "REG")]
    stat_weeks = {int(week) for week in games["week"]}

    snap_rows = _snap_weeks(player_id, season)
    missing_weeks = [week for week in snap_rows.index if int(week) not in stat_weeks]

    if games.empty and not missing_weeks:
        raise PlayerNotFoundError(f"No games found for player_id: {player_id}")

    games = games.sort_values("week", kind="stable")
    records = games.astype(object).where(games.notna(), None).to_dict(orient="records")

    for week in missing_weeks:
        row = snap_rows.loc[week]
        records.append(
            {
                "player_id": player_id,
                "week": int(week),
                "season_type": "REG",
                "team": row["team"],
                "opponent_team": row["opponent"],
            }
        )
    records.sort(key=lambda record: record["week"])

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
# touchdown split into "this QB was involved" vs. not.
USAGE_METRIC_BY_POSITION_GROUP = {
    "RB": ("touches", "Touch Share vs Backfield"),
    "FB": ("touches", "Touch Share vs Backfield"),
    "WR": ("targets", "Target Share"),
    "TE": ("targets", "Target Share"),
}


def _usage_amount(stats: pd.DataFrame, metric: str) -> pd.Series:
    if metric == "touches":
        return stats["carries"] + stats["receptions"]
    return stats["targets"]


def _usage_pool(team_stats: pd.DataFrame, metric: str) -> pd.DataFrame:
    if metric == "touches":
        return team_stats[team_stats["position_group"].isin(["RB", "FB"])]
    return team_stats


def _weekly_breakdown(player_by_week: pd.Series, team_by_week: pd.Series) -> list[dict[str, Any]]:
    weeks = sorted(team_by_week.index)
    return [
        {
            "week": int(week),
            "player_value": int(player_by_week.get(week, 0)),
            "team_value": int(team_by_week.get(week, 0)),
        }
        for week in weeks
    ]


def _qb_td_involvement(player_id: str, team: str, season: int) -> dict[str, Any]:
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

    weekly = _weekly_breakdown(
        touchdowns[involved].groupby("week").size(), touchdowns.groupby("week").size()
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
        "weekly": weekly,
    }


def _usage_weekly(team: str, season: int, player_id: str, metric: str) -> list[dict[str, Any]]:
    week_stats = player_stats.get_week_stats(season)
    if week_stats.empty:
        week_stats = player_stats.get_week_stats(season - 1)
    is_regular_season = week_stats["season_type"] == REGULAR_SEASON
    week_stats = week_stats[is_regular_season & (week_stats["team"] == team)]

    pool = _usage_pool(week_stats, metric)
    pool = pool.assign(usage_amount=_usage_amount(pool, metric))

    player_by_week = pool[pool["player_id"] == player_id].groupby("week")["usage_amount"].sum()
    team_by_week = pool.groupby("week")["usage_amount"].sum()
    return _weekly_breakdown(player_by_week, team_by_week)


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
        return _qb_td_involvement(player_id, player["recent_team"], season)

    metric, label = USAGE_METRIC_BY_POSITION_GROUP.get(
        player["position_group"], ("touches", "Touch Share")
    )
    team_stats = stats[stats["recent_team"] == player["recent_team"]]
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
    return stats.sort_values(
        column, ascending=not descending, na_position="last", kind="stable"
    )


def _with_fields(stats: pd.DataFrame, fields: list[str]) -> pd.DataFrame:
    unknown = [field for field in fields if field not in stats.columns]
    if unknown:
        raise InvalidQueryError(f"Unknown fields: {', '.join(unknown)}")
    return stats[fields]
