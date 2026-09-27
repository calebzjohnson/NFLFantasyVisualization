"""Columns the defensive and offensive line position groups need that
nflverse's player_stats doesn't carry: snap counts (and snap share) plus Pro
Football Reference's advanced defense (pressures, missed tackles, coverage
allowed). Merged onto player_stats rows under their own column names, so the
/players endpoints serve them like any other stat field.
"""

import pandas as pd

from app.data import pfr_defense, snap_counts
from app.data import players as players_data

REGULAR_SEASON = "REG"

# Position groups whose /players responses get these extra columns. Offense
# skips them - its stats don't use them, and the quiet-week rows below would
# shift its trending/median numbers.
EXTENDED_GROUPS = frozenset({"DL", "LB", "DB", "OL"})

PFR_COLUMNS = [
    "def_pressures",
    "def_times_hurried",
    "def_missed_tackles",
    "def_targets",
    "def_completions_allowed",
    "def_yards_allowed",
    "def_receiving_td_allowed",
]
SNAP_COLUMNS = [
    "offense_snaps",
    "defense_snaps",
    "st_snaps",
    "offense_team_snaps",
    "defense_team_snaps",
]
# Game keys shared by player_stats weekly rows and the extras - player-week
# is unique within a regular season, and postseason weeks (19+) never
# collide with it.
KEYS = ["player_id", "week"]


def split_specialists(stats: pd.DataFrame) -> pd.DataFrame:
    """nflverse lumps kickers, punters, and long snappers into one "SPEC"
    position_group; the site treats kickers and punters as their own groups,
    so SPEC rows take their position ("K", "P", "LS") as their group instead.
    """
    if stats.empty:
        return stats
    spec = stats["position_group"] == "SPEC"
    return stats.assign(position_group=stats["position_group"].where(~spec, stats["position"]))


def total_tackles(stats: pd.DataFrame) -> pd.Series:
    """Solo tackles plus assisted-tackle credits - the same total PFR
    reports as combined tackles.
    """
    return (
        stats["def_tackles_solo"] + stats["def_tackles_with_assist"] + stats["def_tackle_assists"]
    )


def _with_snap_pct(frame: pd.DataFrame) -> pd.DataFrame:
    """Snap share as a percentage, from snaps / team snaps rather than PFR's
    own per-game percentage - the same formula then works for one game and
    for a season total (summed snaps over summed team snaps).
    """
    return frame.assign(
        offense_snap_pct=frame["offense_snaps"] / frame["offense_team_snaps"] * 100,
        defense_snap_pct=frame["defense_snaps"] / frame["defense_team_snaps"] * 100,
    )


def weekly_extras(season: int) -> pd.DataFrame:
    """One row per player per regular-season game he was on the field for,
    keyed by gsis player_id + week: snap counts, team snap totals, snap
    share, and PFR's advanced defense (0 for players PFR has no row for,
    e.g. offensive linemen).
    """
    pfr_to_gsis = snap_counts.get_pfr_to_gsis_map()

    snaps = snap_counts.get_season_snap_counts(season)
    snaps = snaps[snaps["game_type"] == REGULAR_SEASON]
    snaps = snaps.assign(player_id=snaps["pfr_player_id"].map(pfr_to_gsis)).dropna(
        subset=["player_id"]
    )
    for side in ("offense", "defense"):
        # Every player's snaps / pct recovers the same team total for that
        # game; the median shrugs off PFR's rounding of pct to 2 decimals.
        team_total = (snaps[f"{side}_snaps"] / snaps[f"{side}_pct"]).where(snaps[f"{side}_pct"] > 0)
        snaps[f"{side}_team_snaps"] = (
            team_total.groupby([snaps["week"], snaps["team"]]).transform("median").round()
        )

    pfr = pfr_defense.get_season_pfr_defense(season)
    pfr = pfr[pfr["game_type"] == REGULAR_SEASON]
    pfr = pfr.assign(player_id=pfr["pfr_player_id"].map(pfr_to_gsis)).dropna(subset=["player_id"])

    extras = snaps[[*KEYS, "team", "opponent", *SNAP_COLUMNS]].merge(
        pfr[[*KEYS, *PFR_COLUMNS]].drop_duplicates(subset=KEYS), on=KEYS, how="left"
    )
    extras[PFR_COLUMNS] = extras[PFR_COLUMNS].fillna(0)
    return _with_snap_pct(extras.drop_duplicates(subset=KEYS))


def _on_field(extras: pd.DataFrame) -> pd.DataFrame:
    return extras[extras[["offense_snaps", "defense_snaps", "st_snaps"]].sum(axis=1) > 0]


def _identity(player_ids: pd.Series) -> pd.DataFrame:
    """Name/position/headshot columns from the player registry, for rows
    added below that have no player_stats row to take them from. Players the
    registry doesn't know are dropped rather than shown nameless.
    """
    roster = players_data.get_players().drop_duplicates("gsis_id").set_index("gsis_id")
    rows = pd.DataFrame(
        {
            "player_id": player_ids,
            "player_display_name": player_ids.map(roster["display_name"]),
            "position": player_ids.map(roster["position"]),
            "position_group": player_ids.map(roster["position_group"]),
            "headshot_url": player_ids.map(roster["headshot"]),
        }
    )
    return split_specialists(rows.dropna(subset=["player_display_name"]))


def with_weekly_extras(stats: pd.DataFrame, extras: pd.DataFrame) -> pd.DataFrame:
    """Weekly player_stats rows with the extras merged on, plus a row for
    every game a player was on the field but recorded no box-score event -
    nflverse drops those player-weeks entirely, which would leave most of an
    offensive lineman's games missing. Those added rows carry identity
    fields and extras only; their box-score columns are null.
    """
    on_field = _on_field(extras)
    have = pd.MultiIndex.from_frame(stats[KEYS])
    quiet = on_field[~pd.MultiIndex.from_frame(on_field[KEYS]).isin(have)]

    if not quiet.empty:
        quiet_rows = _identity(quiet["player_id"]).assign(
            week=quiet["week"],
            season_type=REGULAR_SEASON,
            team=quiet["team"],
            opponent_team=quiet["opponent"],
        )
        stats = pd.concat([stats, quiet_rows], ignore_index=True)

    extra_columns = [*SNAP_COLUMNS, "offense_snap_pct", "defense_snap_pct", *PFR_COLUMNS]
    return stats.merge(extras[[*KEYS, *extra_columns]], on=KEYS, how="left")


def with_season_extras(stats: pd.DataFrame, extras: pd.DataFrame) -> pd.DataFrame:
    """Season player_stats rows with the extras summed per player merged on,
    plus a row for every player who was on the field this season without a
    single box-score event (common for offensive linemen early on). Snap
    share is over the games he was on the field for, matching how the weekly
    numbers read.

    Added rows come from every position in `extras` - filter by position
    group after this, or pass only the extras you want added.
    """
    on_field = _on_field(extras)
    quiet = on_field[~on_field["player_id"].isin(stats["player_id"])]

    if not quiet.empty:
        latest = quiet.sort_values("week").drop_duplicates("player_id", keep="last")
        quiet_rows = _identity(latest["player_id"]).assign(recent_team=latest["team"])
        stats = pd.concat([stats, quiet_rows], ignore_index=True)

    totals = _with_snap_pct(extras.groupby("player_id")[[*SNAP_COLUMNS, *PFR_COLUMNS]].sum())
    return stats.merge(totals, left_on="player_id", right_index=True, how="left")
