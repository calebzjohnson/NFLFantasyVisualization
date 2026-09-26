from typing import cast

import nflreadpy as nfl
import pandas as pd

REGULAR_SEASON = "REG"


def get_season_schedule(season: int) -> pd.DataFrame:
    """Returns one row per game for the given season, from nflverse.

    nflreadpy caches fetched data in memory (24h by default), so repeated
    calls for the same season don't re-hit the network.
    """
    schedule = nfl.load_schedules(seasons=[season])
    return cast(pd.DataFrame, schedule.to_pandas())


def get_played_games(season: int) -> pd.DataFrame:
    """Returns regular-season games from the given season that have a final score."""
    schedule = get_season_schedule(season)
    return schedule[(schedule["game_type"] == REGULAR_SEASON) & schedule["home_score"].notna()]


def get_team_game_log(season: int) -> pd.DataFrame:
    """One row per team per played regular-season game (melted from the
    home/away columns in get_played_games). Columns: team, opponent,
    points_for, points_against, week, win, loss, tie.
    """
    played = get_played_games(season)

    home = played[["week", "home_team", "away_team", "home_score", "away_score"]].rename(
        columns={
            "home_team": "team",
            "away_team": "opponent",
            "home_score": "points_for",
            "away_score": "points_against",
        }
    )
    away = played[["week", "away_team", "home_team", "away_score", "home_score"]].rename(
        columns={
            "away_team": "team",
            "home_team": "opponent",
            "away_score": "points_for",
            "home_score": "points_against",
        }
    )
    game_log = pd.concat([home, away], ignore_index=True)

    game_log["win"] = game_log["points_for"] > game_log["points_against"]
    game_log["loss"] = game_log["points_for"] < game_log["points_against"]
    game_log["tie"] = game_log["points_for"] == game_log["points_against"]

    return game_log


def last_complete_week(stats: pd.DataFrame, schedule: pd.DataFrame) -> int:
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
