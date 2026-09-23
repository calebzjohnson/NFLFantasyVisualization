from typing import Any, cast

import nflreadpy as nfl
import numpy as np
import pandas as pd

from app.data import nextgen_stats, pbp as pbp_data, player_stats, snap_counts
from app.services.players import PlayerNotFoundError

REGULAR_SEASON = "REG"

# Minimum season volume (pass attempts / carries / targets) to qualify for a
# radar profile at all, and to enter the percentile pool other players are
# compared against - keeps a two-target cameo from swinging the scale, or
# showing up as a wildly noisy small-sample profile itself.
MIN_SAMPLE = {"QB": 10, "RB": 5, "WR": 5, "TE": 5}

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


def _qb_metrics(stats: pd.DataFrame, plays: pd.DataFrame) -> pd.DataFrame:
    qb = stats[stats["position_group"] == "QB"].copy()
    qb = qb[qb["attempts"] >= MIN_SAMPLE["QB"]]

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


def _rb_metrics(stats: pd.DataFrame, ngs_rushing: pd.DataFrame, plays: pd.DataFrame) -> pd.DataFrame:
    rb = stats[stats["position_group"].isin(["RB", "FB"])].copy()
    rb = rb[rb["carries"] >= MIN_SAMPLE["RB"]]

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

    # keep="first" - a handful of pfr_id entries in the crosswalk are
    # duplicated, which would otherwise make the pfr_id -> gsis_id mapping
    # ambiguous.
    crosswalk = snap_counts.get_player_id_crosswalk()
    pfr_to_gsis = (
        crosswalk.dropna(subset=["pfr_id", "gsis_id"])
        .drop_duplicates(subset=["pfr_id"], keep="first")
        .set_index("pfr_id")["gsis_id"]
    )

    total_by_gsis_id = total_by_pfr_id.copy()
    total_by_gsis_id.index = total_by_gsis_id.index.map(pfr_to_gsis)
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
    stats: pd.DataFrame, ngs_receiving: pd.DataFrame, total_snaps: pd.Series, plays: pd.DataFrame
) -> pd.DataFrame:
    wr = stats[stats["position_group"] == "WR"].copy()
    wr = wr[wr["targets"] >= MIN_SAMPLE["WR"]]
    wr = _receiving_base_metrics(wr, ngs_receiving, _redzone_target_share(plays))

    snaps = wr["player_id"].map(total_snaps)
    wr["yards_per_snap"] = _clean(wr["receiving_yards"] / snaps)

    return wr


def _te_metrics(stats: pd.DataFrame, ngs_receiving: pd.DataFrame, plays: pd.DataFrame) -> pd.DataFrame:
    te = stats[stats["position_group"] == "TE"].copy()
    te = te[te["targets"] >= MIN_SAMPLE["TE"]]
    te = _receiving_base_metrics(te, ngs_receiving, _redzone_target_share(plays))

    te["yards_per_target"] = _clean(te["receiving_yards"] / te["targets"])

    return te


def _with_percentiles(pool: pd.DataFrame, axes: list[tuple[str, str]]) -> pd.DataFrame:
    pool = pool.copy()
    for key, _ in axes:
        pool[f"{key}_percentile"] = pool[key].rank(pct=True) * 100
    return pool


def get_player_radar(player_id: str) -> dict[str, Any]:
    """This player's 6 position-specific efficiency axes, each as a raw value
    plus a percentile rank against every other qualifying player at their
    position this season - the data behind the player page's radar chart.
    """
    season = nfl.get_current_season()
    stats = player_stats.get_season_stats(season)
    if stats.empty:
        season -= 1
        stats = player_stats.get_season_stats(season)

    player_rows = stats[stats["player_id"] == player_id]
    if player_rows.empty:
        raise PlayerNotFoundError(f"No stats found for player_id: {player_id}")

    bucket = _position_bucket(player_rows.iloc[0]["position_group"])
    if bucket is None:
        raise PlayerNotFoundError(f"No radar profile for player_id: {player_id}")
    axes = RADAR_AXES[bucket]

    if bucket == "QB":
        plays = pbp_data.get_season_pbp(season)
        pool = _qb_metrics(stats, plays)
    elif bucket == "RB":
        plays = pbp_data.get_season_pbp(season)
        ngs_rushing = nextgen_stats.get_season_nextgen_stats(season, "rushing")
        pool = _rb_metrics(stats, ngs_rushing, plays)
    elif bucket == "WR":
        plays = pbp_data.get_season_pbp(season)
        ngs_receiving = nextgen_stats.get_season_nextgen_stats(season, "receiving")
        total_snaps = _wr_total_offense_snaps(season)
        pool = _wr_metrics(stats, ngs_receiving, total_snaps, plays)
    else:
        plays = pbp_data.get_season_pbp(season)
        ngs_receiving = nextgen_stats.get_season_nextgen_stats(season, "receiving")
        pool = _te_metrics(stats, ngs_receiving, plays)

    pool = _with_percentiles(pool, axes)
    pool = pool.set_index("player_id")
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
