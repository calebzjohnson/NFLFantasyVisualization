from typing import Any

import nflreadpy as nfl
import pandas as pd

from app.cache import memoized
from app.data import pbp as pbp_data

REGULAR_SEASON = "REG"

# nflverse's own special_teams_play flag doesn't cover field goals (a known
# upstream quirk - kickoff/punt/extra_point are flagged, field_goal isn't,
# even though it clearly belongs here), so special teams plays are defined
# directly by play_type instead of trusting that flag.
SPECIAL_TEAMS_PLAY_TYPES = {"kickoff", "punt", "extra_point", "field_goal"}

# (raw column, display label), in the order the team radar's axes should
# appear. Every axis is defined so a higher raw value is always better -
# def_pass_epa/def_rush_epa are pre-negated (see _defense_epa_means) so an
# elite defense (low/negative EPA allowed) scales outward like every other
# axis, rather than needing a special-cased percentile direction per axis.
TEAM_RADAR_AXES: list[tuple[str, str]] = [
    ("off_pass_epa", "Off. Pass EPA/Play"),
    ("off_rush_epa", "Off. Rush EPA/Play"),
    ("off_redzone_td_pct", "RZ TD%"),
    ("def_pass_epa", "Def. Pass EPA/Play"),
    ("def_rush_epa", "Def. Rush EPA/Play"),
    ("special_teams_epa", "Special Teams EPA"),
]


def _offense_epa_means(plays: pd.DataFrame) -> pd.DataFrame:
    """Mean EPA/play for the offense, split by play type - raw volume
    doesn't matter here (a team with 20 dropbacks and one with 40 are
    equally "readable" on this axis), which is what keeps this workable
    from Week 1 on rather than needing a season-long sample first.
    """
    pass_plays = plays[(plays["pass"] == 1) & plays["epa"].notna() & plays["posteam"].notna()]
    rush_plays = plays[(plays["rush"] == 1) & plays["epa"].notna() & plays["posteam"].notna()]
    return pd.DataFrame(
        {
            "off_pass_epa": pass_plays.groupby("posteam")["epa"].mean(),
            "off_rush_epa": rush_plays.groupby("posteam")["epa"].mean(),
        }
    )


def _defense_epa_means(plays: pd.DataFrame) -> pd.DataFrame:
    """Mean EPA/play *allowed*, split by play type, sign-flipped so a low or
    negative number (good defense) becomes a high positive one - every axis
    on this radar reads "higher raw value = better", and this is the one
    case where the underlying stat's own sign runs the opposite way.
    """
    pass_plays = plays[(plays["pass"] == 1) & plays["epa"].notna() & plays["defteam"].notna()]
    rush_plays = plays[(plays["rush"] == 1) & plays["epa"].notna() & plays["defteam"].notna()]
    return pd.DataFrame(
        {
            "def_pass_epa": -pass_plays.groupby("defteam")["epa"].mean(),
            "def_rush_epa": -rush_plays.groupby("defteam")["epa"].mean(),
        }
    )


def _special_teams_epa(plays: pd.DataFrame) -> pd.Series:
    """Season-total (not mean) EPA on special teams plays, credited to the
    team that had possession (the kicking/punting team, or the return team
    on a return-friendly play). A sum rather than a mean, unlike every other
    axis here, since special teams plays are rare and swingy enough that a
    per-play rate would be dominated by noise rather than signal.
    """
    st_plays = plays[
        plays["play_type"].isin(SPECIAL_TEAMS_PLAY_TYPES)
        & plays["epa"].notna()
        & plays["posteam"].notna()
    ]
    return st_plays.groupby("posteam")["epa"].sum()


def _redzone_td_pct(plays: pd.DataFrame) -> pd.Series:
    """% of a team's own drives that both reached the red zone (at least one
    play with yardline_100 <= 20) and ended in that same team's touchdown -
    "Opp touchdown" (a pick-six or fumble-return score) is deliberately
    excluded, since that's the defense's drive result, not this offense's.
    """
    drives = plays.dropna(subset=["fixed_drive", "posteam", "game_id"])
    grouped = drives.groupby(["game_id", "fixed_drive"])

    reached_redzone = grouped["yardline_100"].apply(lambda ylines: (ylines <= 20).any())
    drive_team = grouped["posteam"].first()
    scored_td = grouped["fixed_drive_result"].first() == "Touchdown"

    redzone_drives = pd.DataFrame({"team": drive_team, "touchdown": scored_td})[reached_redzone]
    return redzone_drives.groupby("team")["touchdown"].mean() * 100


def _with_percentiles(pool: pd.DataFrame) -> pd.DataFrame:
    pool = pool.copy()
    for key, _ in TEAM_RADAR_AXES:
        pool[f"{key}_percentile"] = pool[key].rank(pct=True) * 100
    return pool


def _load_season_plays() -> tuple[pd.DataFrame, int]:
    season = nfl.get_current_season()
    plays = pbp_data.get_season_pbp(season)
    if plays.empty:
        season -= 1
        plays = pbp_data.get_season_pbp(season)
    return plays, season


def _build_team_pool(plays: pd.DataFrame) -> pd.DataFrame:
    """Every team's 6 radar axes plus percentile ranks across the league -
    the data behind both the team radar and the team-vs-league beeswarm,
    mirroring app/services/radar.py's player-level _build_pool.
    """
    plays = plays[plays["season_type"] == REGULAR_SEASON]

    pool = _offense_epa_means(plays).join(
        [
            _defense_epa_means(plays),
            _special_teams_epa(plays).rename("special_teams_epa"),
            _redzone_td_pct(plays).rename("off_redzone_td_pct"),
        ],
        how="outer",
    )
    pool = pool.reset_index(names="team")
    return _with_percentiles(pool)


def _axis_entries(row: pd.Series, axes: list[tuple[str, str]]) -> list[dict[str, Any]]:
    """One pool row's radar axes as raw value + percentile - the data behind
    both the team radar (one row) and the beeswarm (every row).
    """
    return [
        {
            "key": key,
            "label": label,
            "value": None if pd.isna(row[key]) else round(float(row[key]), 3),
            "percentile": None
            if pd.isna(row[f"{key}_percentile"])
            else round(float(row[f"{key}_percentile"]), 1),
        }
        for key, label in axes
    ]


@memoized
def get_team_radar_pool() -> dict[str, Any]:
    """Every team with its 6 radar axes - the data behind the team radar
    (which picks out its own row) and the team-vs-league beeswarm, matching
    get_position_radar_pool's shape for players.
    """
    plays, _ = _load_season_plays()
    pool = _build_team_pool(plays)

    teams = []
    for _, row in pool.iterrows():
        teams.append(
            {
                "team": row["team"],
                "axes": _axis_entries(row, TEAM_RADAR_AXES),
            }
        )

    return {
        "axes": [{"key": key, "label": label} for key, label in TEAM_RADAR_AXES],
        "teams": teams,
    }
