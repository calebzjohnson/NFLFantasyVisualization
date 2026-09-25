from typing import Any, cast

import nflreadpy as nfl

from app.data import schedules, team_stats, teams

REGULAR_SEASON = "REG"

# Per-game columns the Teams page reads from each team's own row: its offense,
# plus the plays its defense made.
OWN_COLUMNS = [
    "completions",
    "attempts",
    "passing_yards",
    "passing_tds",
    "passing_interceptions",
    "sacks_suffered",
    "sack_yards_lost",
    "carries",
    "rushing_yards",
    "rushing_tds",
    "fumbles_lost_total",
    "def_sacks",
    "def_interceptions",
    "fumble_recovery_opp",
]
# Offensive columns read from the opponent's row in the same game, returned
# with an "_allowed" suffix - what this team's defense gave up.
ALLOWED_COLUMNS = [
    "passing_yards",
    "sack_yards_lost",
    "rushing_yards",
    "passing_tds",
    "rushing_tds",
]


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


def get_team_game_stats() -> list[dict[str, Any]]:
    """One row per team per played regular-season game this season: the
    team's own OWN_COLUMNS, the opponent's ALLOWED_COLUMNS (suffixed
    "_allowed"), and the final score as points_for/points_against. nflverse's
    team stats have no points column, so scores come from the schedule.
    """
    season = nfl.get_current_season()
    stats = team_stats.get_weekly_team_stats(season)
    if stats.empty:
        season -= 1
        stats = team_stats.get_weekly_team_stats(season)
    stats = stats[stats["season_type"] == REGULAR_SEASON]

    # Each game has one row per team; relabel the opponent's row so a join on
    # (game_id, opponent_team) pairs a team with what it allowed that game.
    allowed = stats[["game_id", "team", *ALLOWED_COLUMNS]].rename(
        columns={"team": "opponent_team", **{c: f"{c}_allowed" for c in ALLOWED_COLUMNS}}
    )
    games = stats[["game_id", "week", "team", "opponent_team", *OWN_COLUMNS]].merge(
        allowed, on=["game_id", "opponent_team"]
    )
    scores = schedules.get_team_game_log(season)[["team", "week", "points_for", "points_against"]]
    games = games.merge(scores, on=["team", "week"]).sort_values(["week", "team"], kind="stable")

    records = games.astype(object).where(games.notna(), None).to_dict(orient="records")
    return cast(list[dict[str, Any]], records)
