from typing import Any, cast

import nflreadpy as nfl
import numpy as np
import pandas as pd

from app.data import nextgen_stats, pbp as pbp_data, player_stats, snap_counts
from app.services.players import PlayerNotFoundError

REGULAR_SEASON = "REG"

# Minimum volume (pass attempts / carries / targets) *per week played so
# far* to qualify for a radar profile at all, and to enter the percentile
# pool other players are compared against - keeps a two-target cameo from
# swinging the scale, or showing up as a wildly noisy small-sample profile
# itself. Scaled by the season's current week (attempts/touches/targets
# needed = rate * current_week) rather than a flat season-long number: a
# flat floor low enough to not leave the radar empty in Week 1 becomes far
# too lenient by Week 12 (a QB with 10 career attempts back in Week 1 would
# still "qualify" at midseason), while a flat floor strict enough for
# midseason would leave every chart blank for the first month.
MIN_SAMPLE_PER_WEEK = {"QB": 6.25, "RB": 3.0, "WR": 2.0, "TE": 1.25}


def _min_sample(bucket: str, current_week: int) -> float:
    return MIN_SAMPLE_PER_WEEK[bucket] * current_week


def _current_week(season: int) -> int:
    """The latest regular-season week with any played games in the data -
    how far into the season we are, for scaling the volume floor above."""
    week_stats = player_stats.get_week_stats(season)
    reg = week_stats[week_stats["season_type"] == REGULAR_SEASON]
    return int(reg["week"].max()) if not reg.empty else 1

# (raw column, display label), in the order the radar's axes should appear.
RADAR_AXES: dict[str, list[tuple[str, str]]] = {
    "QB": [
        ("epa_per_dropback", "EPA / Dropback"),
        ("success_rate", "Success Rate"),
        ("any_a", "ANY/A"),
        ("passing_cpoe", "CPOE"),
        ("yards_per_pass", "Yards / Attempt"),
        ("adot", "aDOT"),
    ],
    # 8+ man box % was dropped in favor of red zone touch share - goal-line
    # role (bell-cow vs. passing-down/receiving back) is a more direct
    # signal of a back's value than how often defenses stack the box against
    # his team, and receiving_epa_per_target already covers pass-game value.
    "RB": [
        ("rushing_epa_per_play", "Rushing EPA / Play"),
        ("success_rate", "Success Rate"),
        ("yards_per_carry", "Yards / Carry"),
        ("rush_yards_over_expected", "Rush Yards Over Expected"),
        ("receiving_epa_per_target", "Receiving EPA / Target"),
        ("redzone_touch_share", "Red Zone Touch Share"),
    ],
    # Target share was dropped in favor of red zone target share - WOPR
    # already leans heavily on target share (1.5x weight in its own
    # formula), so a standalone target-share axis mostly repeated what WOPR
    # already captured. Red zone target share isolates scoring-area usage
    # instead, a dimension none of the other 5 axes touch.
    "WR": [
        ("wopr", "WOPR"),
        ("yac_per_reception", "YAC / Reception"),
        ("receiving_epa_per_target", "Receiving EPA / Target"),
        ("avg_separation", "Avg. Separation"),
        ("yards_per_snap", "Yards / Snap"),
        ("redzone_target_share", "Red Zone Target Share"),
    ],
    # TEs split heavy blocking duties with route-running, so a snap-based
    # rate (yards_per_snap) would penalize a blocking-heavy TE for plays he
    # was never going to touch the ball on. yards_per_target sidesteps that -
    # scoped to plays where he was actually thrown to.
    "TE": [
        ("wopr", "WOPR"),
        ("yac_per_reception", "YAC / Reception"),
        ("receiving_epa_per_target", "Receiving EPA / Target"),
        ("avg_separation", "Avg. Separation"),
        ("yards_per_target", "Yards / Target"),
        ("redzone_target_share", "Red Zone Target Share"),
    ],
}


def _position_bucket(position_group: str) -> str | None:
    if position_group == "QB":
        return "QB"
    if position_group in ("RB", "FB"):
        return "RB"
    if position_group == "WR":
        return "WR"
    if position_group == "TE":
        return "TE"
    return None


def _success_rate(plays: pd.DataFrame, play_type: str, id_column: str) -> pd.Series:
    """Fraction of a player's own dropbacks/rushes with positive EPA, indexed
    by that player's gsis_id - the play-level equivalent of a season EPA
    total, since "success" isn't a column nflverse pre-aggregates for us.
    """
    scoped = plays[
        (plays["season_type"] == REGULAR_SEASON)
        & (plays["play_type"] == play_type)
        & plays["epa"].notna()
        & plays[id_column].notna()
    ]
    return cast(pd.Series, scoped.groupby(id_column)["epa"].apply(lambda epa: (epa > 0).mean()) * 100)


def _clean(series: pd.Series) -> pd.Series:
    return series.replace([np.inf, -np.inf], np.nan)


def _qb_metrics(stats: pd.DataFrame, plays: pd.DataFrame, current_week: int) -> pd.DataFrame:
    qb = stats[stats["position_group"] == "QB"].copy()
    qb = qb[qb["attempts"] >= _min_sample("QB", current_week)]

    dropbacks = qb["attempts"] + qb["sacks_suffered"]
    qb["epa_per_dropback"] = _clean(qb["passing_epa"] / dropbacks)
    # sack_yards_lost is stored as a negative number of yards, so it's added
    # (not subtracted) to net it against the passing production.
    qb["any_a"] = _clean(
        (
            qb["passing_yards"]
            + 20 * qb["passing_tds"]
            - 45 * qb["passing_interceptions"]
            + qb["sack_yards_lost"]
        )
        / dropbacks
    )
    qb["yards_per_pass"] = _clean(qb["passing_yards"] / qb["attempts"])
    qb["adot"] = _clean(qb["passing_air_yards"] / qb["attempts"])
    # passing_cpoe is already a season rate straight from nflverse.

    success = _success_rate(plays, "pass", "passer_player_id")
    qb["success_rate"] = qb["player_id"].map(success)

    return qb


def _rb_metrics(
    stats: pd.DataFrame, ngs_rushing: pd.DataFrame, plays: pd.DataFrame, current_week: int
) -> pd.DataFrame:
    rb = stats[stats["position_group"].isin(["RB", "FB"])].copy()
    rb = rb[rb["carries"] >= _min_sample("RB", current_week)]

    rb["rushing_epa_per_play"] = _clean(rb["rushing_epa"] / rb["carries"])
    rb["yards_per_carry"] = _clean(rb["rushing_yards"] / rb["carries"])
    rb["receiving_epa_per_target"] = _clean(rb["receiving_epa"] / rb["targets"])

    success = _success_rate(plays, "run", "rusher_player_id")
    rb["success_rate"] = rb["player_id"].map(success)

    ngs = ngs_rushing.set_index("player_gsis_id")
    rb["rush_yards_over_expected"] = rb["player_id"].map(ngs["rush_yards_over_expected"])

    touch_share = _redzone_touch_share(plays)
    rb["redzone_touch_share"] = rb["player_id"].map(touch_share)

    return rb


def _redzone_touch_share(plays: pd.DataFrame) -> pd.Series:
    """(Player red zone carries + receptions) / (team red zone carries +
    receptions), indexed by gsis_id - a bell-cow/goal-line role signal that
    covers both rushing and receiving touches, not just carries.
    """
    red_zone = plays[(plays["season_type"] == REGULAR_SEASON) & (plays["yardline_100"] <= 20)]

    runs = red_zone[(red_zone["play_type"] == "run") & red_zone["rusher_player_id"].notna()]
    catches = red_zone[
        (red_zone["play_type"] == "pass")
        & (red_zone["complete_pass"] == 1)
        & red_zone["receiver_player_id"].notna()
    ]

    player_touches = runs.groupby("rusher_player_id").size().add(
        catches.groupby("receiver_player_id").size(), fill_value=0
    )
    team_touches = runs.groupby("posteam").size().add(catches.groupby("posteam").size(), fill_value=0)
    player_team = (
        pd.concat(
            [
                runs.groupby("rusher_player_id")["posteam"].first(),
                catches.groupby("receiver_player_id")["posteam"].first(),
            ]
        )
        .groupby(level=0)
        .first()
    )

    return cast(pd.Series, player_touches / player_team.map(team_touches) * 100)


def _wr_total_offense_snaps(season: int) -> pd.Series:
    """Each player's total offensive snaps this season, indexed by gsis_id.

    PFR snap counts don't split pass-play snaps from run-play snaps, so this
    (and the "yards per snap" axis built from it) is really yards per
    offensive snap, not per pass-play snap specifically - the closest
    route-independent proxy this data actually supports.
    """
    snaps = snap_counts.get_season_snap_counts(season)
    snaps = snaps[snaps["game_type"] == REGULAR_SEASON]
    total_by_pfr_id = snaps.groupby("pfr_player_id")["offense_snaps"].sum()

    total_by_gsis_id = total_by_pfr_id.copy()
    total_by_gsis_id.index = total_by_gsis_id.index.map(snap_counts.get_pfr_to_gsis_map())
    return cast(pd.Series, total_by_gsis_id[total_by_gsis_id.index.notna()])


def _redzone_target_share(plays: pd.DataFrame) -> pd.Series:
    """Each player's share of their own team's red zone targets (plays
    starting inside the opponent's 20, yardline_100 <= 20) this season,
    indexed by gsis_id.
    """
    red_zone = plays[
        (plays["season_type"] == REGULAR_SEASON)
        & (plays["play_type"] == "pass")
        & (plays["yardline_100"] <= 20)
        & plays["receiver_player_id"].notna()
    ]
    player_targets = red_zone.groupby("receiver_player_id").size()
    team_targets = red_zone.groupby("posteam").size()
    player_team = red_zone.groupby("receiver_player_id")["posteam"].first()

    return cast(pd.Series, player_targets / player_team.map(team_targets) * 100)


def _receiving_base_metrics(
    receivers: pd.DataFrame, ngs_receiving: pd.DataFrame, redzone_share: pd.Series
) -> pd.DataFrame:
    """The 4 axes shared between the WR and TE profiles."""
    receivers = receivers.copy()
    # wopr is already a season rate straight from nflverse.
    receivers["yac_per_reception"] = _clean(
        receivers["receiving_yards_after_catch"] / receivers["receptions"]
    )
    receivers["receiving_epa_per_target"] = _clean(receivers["receiving_epa"] / receivers["targets"])

    ngs = ngs_receiving.set_index("player_gsis_id")
    receivers["avg_separation"] = receivers["player_id"].map(ngs["avg_separation"])

    receivers["redzone_target_share"] = receivers["player_id"].map(redzone_share)

    return receivers


def _wr_metrics(
    stats: pd.DataFrame,
    ngs_receiving: pd.DataFrame,
    total_snaps: pd.Series,
    plays: pd.DataFrame,
    current_week: int,
) -> pd.DataFrame:
    wr = stats[stats["position_group"] == "WR"].copy()
    wr = wr[wr["targets"] >= _min_sample("WR", current_week)]
    wr = _receiving_base_metrics(wr, ngs_receiving, _redzone_target_share(plays))

    snaps = wr["player_id"].map(total_snaps)
    wr["yards_per_snap"] = _clean(wr["receiving_yards"] / snaps)

    return wr


def _te_metrics(
    stats: pd.DataFrame, ngs_receiving: pd.DataFrame, plays: pd.DataFrame, current_week: int
) -> pd.DataFrame:
    te = stats[stats["position_group"] == "TE"].copy()
    te = te[te["targets"] >= _min_sample("TE", current_week)]
    te = _receiving_base_metrics(te, ngs_receiving, _redzone_target_share(plays))

    te["yards_per_target"] = _clean(te["receiving_yards"] / te["targets"])

    return te


def _with_percentiles(pool: pd.DataFrame, axes: list[tuple[str, str]]) -> pd.DataFrame:
    pool = pool.copy()
    for key, _ in axes:
        pool[f"{key}_percentile"] = pool[key].rank(pct=True) * 100
    return pool


class InvalidPositionError(ValueError):
    """Raised when a position string isn't one of RADAR_AXES' buckets."""


def _load_season_stats() -> tuple[pd.DataFrame, int]:
    season = nfl.get_current_season()
    stats = player_stats.get_season_stats(season)
    if stats.empty:
        season -= 1
        stats = player_stats.get_season_stats(season)
    return stats, season


def _build_pool(bucket: str, stats: pd.DataFrame, season: int) -> pd.DataFrame:
    """Every qualifying player at this position, with their 6 radar axes and
    percentile ranks - the shared computation behind both a single player's
    radar chart and the full-league beeswarm.
    """
    current_week = _current_week(season)

    if bucket == "QB":
        plays = pbp_data.get_season_pbp(season)
        pool = _qb_metrics(stats, plays, current_week)
    elif bucket == "RB":
        plays = pbp_data.get_season_pbp(season)
        ngs_rushing = nextgen_stats.get_season_nextgen_stats(season, "rushing")
        pool = _rb_metrics(stats, ngs_rushing, plays, current_week)
    elif bucket == "WR":
        plays = pbp_data.get_season_pbp(season)
        ngs_receiving = nextgen_stats.get_season_nextgen_stats(season, "receiving")
        total_snaps = _wr_total_offense_snaps(season)
        pool = _wr_metrics(stats, ngs_receiving, total_snaps, plays, current_week)
    else:
        plays = pbp_data.get_season_pbp(season)
        ngs_receiving = nextgen_stats.get_season_nextgen_stats(season, "receiving")
        pool = _te_metrics(stats, ngs_receiving, plays, current_week)

    return _with_percentiles(pool, RADAR_AXES[bucket])


def get_player_radar(player_id: str) -> dict[str, Any]:
    """This player's 6 position-specific efficiency axes, each as a raw value
    plus a percentile rank against every other qualifying player at their
    position this season - the data behind the player page's radar chart.
    """
    stats, season = _load_season_stats()

    player_rows = stats[stats["player_id"] == player_id]
    if player_rows.empty:
        raise PlayerNotFoundError(f"No stats found for player_id: {player_id}")

    bucket = _position_bucket(player_rows.iloc[0]["position_group"])
    if bucket is None:
        raise PlayerNotFoundError(f"No radar profile for player_id: {player_id}")
    axes = RADAR_AXES[bucket]

    pool = _build_pool(bucket, stats, season).set_index("player_id")
    if player_id not in pool.index:
        raise PlayerNotFoundError(
            f"Not enough season volume for a radar profile: {player_id}"
        )
    row = pool.loc[player_id]

    return {
        "player_id": player_id,
        "position": bucket,
        "axes": [
            {
                "key": key,
                "label": label,
                "value": None if pd.isna(row[key]) else round(float(row[key]), 2),
                "percentile": None
                if pd.isna(row[f"{key}_percentile"])
                else round(float(row[f"{key}_percentile"]), 1),
            }
            for key, label in axes
        ],
    }


def get_position_radar_pool(position: str) -> dict[str, Any]:
    """Every qualifying player at this position with their 6 radar axes -
    the data behind the player page's league-comparison beeswarm, where
    every player at the position gets a dot on each axis.
    """
    bucket = _position_bucket(position)
    if bucket is None:
        raise InvalidPositionError(f"No radar profile for position: {position}")
    axes = RADAR_AXES[bucket]

    stats, season = _load_season_stats()
    pool = _build_pool(bucket, stats, season)

    players = []
    for _, row in pool.iterrows():
        players.append(
            {
                "player_id": row["player_id"],
                "name": row["player_display_name"],
                "team": row["recent_team"],
                "axes": [
                    {
                        "key": key,
                        "percentile": None
                        if pd.isna(row[f"{key}_percentile"])
                        else round(float(row[f"{key}_percentile"]), 1),
                    }
                    for key, _ in axes
                ],
            }
        )

    return {
        "position": bucket,
        "axes": [{"key": key, "label": label} for key, label in axes],
        "players": players,
    }
