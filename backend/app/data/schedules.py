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
