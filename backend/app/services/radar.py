from typing import Any, cast

import nflreadpy as nfl
import numpy as np
import pandas as pd

from app.cache import memoized
from app.data import depth_charts, nextgen_stats, player_stats, snap_counts
from app.data import pbp as pbp_data
from app.services.extended_stats import (
    split_by_alignment,
    total_tackles,
    weekly_extras,
    with_season_extras,
)

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
# midseason would leave every chart blank for the first month. Defenders
# are measured in defensive snaps instead - roughly a quarter of a game's
# snaps each week, which keeps special-teams-only players out.
MIN_SAMPLE_PER_WEEK = {
    "QB": 6.25,
    "RB": 3.0,
    "WR": 2.0,
    "TE": 1.25,
    "EDGE": 15,
    "DL": 15,
    "LB": 15,
    "CB": 15,
    "S": 15,
    "DB": 15,
}


# Run tackles per week played needed before a player's average tackle depth
# means anything. Set from what edge rushers actually do - their median is 0.5
# a week and their 90th percentile 1.18, so a linebacker-sized floor (1.5)
# would leave the axis permanently empty rather than filling in over time.
RUN_TACKLE_MIN_PER_WEEK = 0.5

# Targets per week played before a corner's target rate is worth ranking. It
# only rules out the degenerate case - a corner thrown at twice all season
# topping an "avoidance" axis - since the median corner sees 3.25 a week.
TARGET_MIN_PER_WEEK = 1.0


def _min_sample(bucket: str, current_week: int) -> float:
    return MIN_SAMPLE_PER_WEEK[bucket] * current_week


def _current_week(season: int) -> int:
    """The latest regular-season week with any played games in the data -
    how far into the season we are, for scaling the volume floor above."""
    week_stats = player_stats.get_week_stats(season)
    reg = week_stats[week_stats["season_type"] == REGULAR_SEASON]
    return int(reg["week"].max()) if not reg.empty else 1


# YAC allowed over ball production: the other coverage axes all ask whether
# the pass was completed, and a safety's job carries on after it is.
SECONDARY_AXES = [
    ("passer_rating_allowed", "Rating Allowed"),
    ("yards_per_target_allowed", "Yards / TGT Allowed"),
    ("completion_pct_allowed", "CMP % Allowed"),
    ("yac_allowed_per_reception", "YAC Allowed"),
    ("tackles_per_100_snaps", "Tackle Rate"),
    ("missed_tackle_pct", "Missed Tackle %"),
]

PASS_RUSHER_AXES = [
    ("pressure_rate", "Pressure Rate"),
    ("sack_rate", "Sack Conversion"),
    ("qb_hits_per_100_snaps", "QB Hit Rate"),
    ("tfl_per_100_snaps", "TFL Rate"),
    ("missed_tackle_pct", "Missed Tackle %"),
    ("tackle_depth", "Tackle Depth"),
]

# (raw column, display label), in the order the radar's axes should appear.
RADAR_AXES: dict[str, list[tuple[str, str]]] = {
    "QB": [
        ("epa_per_dropback", "EPA / Dropback"),
        ("success_rate", "Success Rate"),
        ("any_a", "ANY/A"),
        ("passing_cpoe", "CPOE"),
        ("adot", "aDOT"),
        ("qb_rushing_epa_per_play", "Rush EPA / Play"),
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
        ("receiving_epa_per_target", "EPA / TGT"),
        ("redzone_touch_share", "RZ Touch Share"),
    ],
    # Target share was dropped in favor of red zone target share - WOPR
    # already leans heavily on target share (1.5x weight in its own
    # formula), so a standalone target-share axis mostly repeated what WOPR
    # already captured. Red zone target share isolates scoring-area usage
    # instead, a dimension none of the other 5 axes touch.
    "WR": [
        ("wopr", "WOPR"),
        ("yac_per_reception", "YAC / REC"),
        ("receiving_epa_per_target", "EPA / TGT"),
        ("avg_separation", "Avg. Separation"),
        ("yards_per_snap", "Yards / Snap"),
        ("redzone_target_share", "RZ TGT Share"),
    ],
    # TEs split heavy blocking duties with route-running, so a snap-based
    # rate (yards_per_snap) would penalize a blocking-heavy TE for plays he
    # was never going to touch the ball on. yards_per_target sidesteps that -
    # scoped to plays where he was actually thrown to.
    "TE": [
        ("wopr", "WOPR"),
        ("yac_per_reception", "YAC / REC"),
        ("receiving_epa_per_target", "EPA / TGT"),
        ("avg_separation", "Avg. Separation"),
        ("yards_per_target", "Yards / TGT"),
        ("redzone_target_share", "RZ TGT Share"),
    ],
    # Edge rushers and interior linemen do the same two jobs in different
    # proportions, so they share axes and are told apart by their pools: an
    # interior lineman's pressure rate is read against other interior linemen.
    "EDGE": PASS_RUSHER_AXES,
    "DL": PASS_RUSHER_AXES,
    # Tackle depth over pressure rate: off-ball linebackers rarely rush, so
    # pressure measures something most of them don't do, while nearly every
    # run funnels through them.
    "LB": [
        ("tackles_per_100_snaps", "Tackle Rate"),
        ("tfl_per_100_snaps", "TFL Rate"),
        ("tackle_depth", "Tackle Depth"),
        ("yards_per_target_allowed", "Yards / TGT Allowed"),
        ("passer_rating_allowed", "Rating Allowed"),
        ("missed_tackle_pct", "Missed Tackle %"),
    ],
    # Corners live on coverage, so the chart is five coverage axes plus the
    # open-field tackling they can't avoid. Target rate is ranked inverted as
    # an avoidance signal, though it tracks coverage quality only weakly.
    "CB": [
        ("target_rate", "Target Rate"),
        ("yards_per_target_allowed", "Yards / TGT Allowed"),
        ("passer_rating_allowed", "Rating Allowed"),
        ("pass_defended_rate", "PD Rate"),
        ("missed_tackle_pct", "Missed Tackle %"),
        ("completion_pct_allowed", "CMP % Allowed"),
    ],
    "S": SECONDARY_AXES,
    "DB": SECONDARY_AXES,
}

# Axes where a smaller raw value is the better result - ranked in reverse so
# a high percentile always means "better than his peers," on every axis.
LOWER_IS_BETTER = frozenset(
    {
        "missed_tackle_pct",
        "yards_per_target_allowed",
        "passer_rating_allowed",
        "completion_pct_allowed",
        # Meeting the ball carrier at or behind the line beats catching him
        # five yards downfield.
        "tackle_depth",
        # Quarterbacks throwing away from a corner is the avoidance signal.
        "target_rate",
        # Dropping the catch immediately beats letting it run.
        "yac_allowed_per_reception",
    }
)


def _position_bucket(position_group: str) -> str | None:
    if position_group == "QB":
        return "QB"
    if position_group in ("RB", "FB"):
        return "RB"
    if position_group == "WR":
        return "WR"
    if position_group in ("TE", "EDGE", "DL", "LB", "CB", "S", "DB"):
        return position_group
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
    success_rate = scoped.groupby(id_column)["epa"].apply(lambda epa: (epa > 0).mean())
    return success_rate * 100


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
    qb["adot"] = _clean(qb["passing_air_yards"] / qb["attempts"])
    # passing_cpoe is already a season rate straight from nflverse.

    success = _success_rate(plays, "pass", "passer_player_id")
    qb["success_rate"] = qb["player_id"].map(success)

    # Deliberately left null (not 0) for a pure pocket passer with zero rush
    # attempts - there's no rushing sample to average over, the same
    # "mathematically undefined" case as receiving_epa_per_target at 0
    # targets, not a real, known zero.
    qb["qb_rushing_epa_per_play"] = qb["player_id"].map(_qb_rushing_epa_per_play(plays))

    return qb


def _qb_rushing_epa_per_play(plays: pd.DataFrame) -> pd.Series:
    """Mean EPA on this QB's own rushing attempts - scrambles and designed
    runs alike, since play_type doesn't distinguish the two - indexed by
    gsis_id. Built from play-by-play rather than the season stats table's
    rushing_epa column, matching every other play-level axis in this module.
    """
    scoped = plays[
        (plays["season_type"] == REGULAR_SEASON)
        & (plays["play_type"] == "run")
        & plays["epa"].notna()
        & plays["rusher_player_id"].notna()
    ]
    return scoped.groupby("rusher_player_id")["epa"].mean()


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
    # A player with zero red zone touches doesn't appear in touch_share at
    # all (it's built from a groupby over red zone plays), so a plain .map()
    # would wrongly read as "no data" (null) instead of a real, known 0%.
    rb["redzone_touch_share"] = rb["player_id"].map(touch_share).fillna(0)

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

    player_touches = (
        runs.groupby("rusher_player_id")
        .size()
        .add(catches.groupby("receiver_player_id").size(), fill_value=0)
    )
    team_touches = (
        runs.groupby("posteam").size().add(catches.groupby("posteam").size(), fill_value=0)
    )
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
    pfr_to_gsis = snap_counts.get_pfr_to_gsis_map().to_dict()
    total_by_gsis_id.index = total_by_gsis_id.index.map(pfr_to_gsis)
    return total_by_gsis_id[total_by_gsis_id.index.notna()]


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

    return player_targets / player_team.map(team_targets) * 100


def _receiving_base_metrics(
    receivers: pd.DataFrame, ngs_receiving: pd.DataFrame, redzone_share: pd.Series
) -> pd.DataFrame:
    """The 4 axes shared between the WR and TE profiles."""
    receivers = receivers.copy()
    # wopr is already a season rate straight from nflverse.
    receivers["yac_per_reception"] = _clean(
        receivers["receiving_yards_after_catch"] / receivers["receptions"]
    )
    receivers["receiving_epa_per_target"] = _clean(
        receivers["receiving_epa"] / receivers["targets"]
    )

    ngs = ngs_receiving.set_index("player_gsis_id")
    receivers["avg_separation"] = receivers["player_id"].map(ngs["avg_separation"])

    # A player with zero red zone targets doesn't appear in redzone_share at
    # all (it's built from a groupby over red zone plays), so a plain .map()
    # would wrongly read as "no data" (null) instead of a real, known 0%.
    receivers["redzone_target_share"] = receivers["player_id"].map(redzone_share).fillna(0)

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


def _passer_rating(
    cmp: pd.Series, att: pd.Series, yards: pd.Series, td: pd.Series, ints: pd.Series
) -> pd.Series:
    """Standard NFL passer rating (the same formula as the frontend's
    passerRating), vectorized - null at 0 attempts, where it's undefined.
    """
    att = att.where(att > 0)
    parts = [
        (cmp / att - 0.3) * 5,
        (yards / att - 3) * 0.25,
        td / att * 20,
        2.375 - ints / att * 25,
    ]
    return cast(pd.Series, sum(part.clip(0, 2.375) for part in parts) / 6 * 100)


def _run_tackle_depth(plays: pd.DataFrame) -> pd.DataFrame:
    """Mean yards gained on the designed runs a player helped tackle, with the
    count behind it, indexed by gsis_id. 0 means he met the back at the line;
    negative means behind it.

    play_type "run" covers scrambles as well as designed runs, so those are
    dropped - a defender chasing down a scrambling quarterback says nothing
    about how he holds up against the run. All four tackle credits count, the
    same way total_tackles does.
    """
    runs = plays[
        (plays["season_type"] == REGULAR_SEASON)
        & (plays["play_type"] == "run")
        & (plays["qb_scramble"] == 0)
        & (plays["two_point_attempt"] == 0)
        & plays["yards_gained"].notna()
    ]
    slots = [
        "solo_tackle_1_player_id",
        "solo_tackle_2_player_id",
        "tackle_with_assist_1_player_id",
        "tackle_with_assist_2_player_id",
    ]
    credited = pd.concat(
        [runs[[slot, "yards_gained"]].rename(columns={slot: "player_id"}) for slot in slots]
    ).dropna(subset=["player_id"])
    return cast(
        pd.DataFrame,
        credited.groupby("player_id")["yards_gained"].agg(depth="mean", tackles="size"),
    )


def _defense_metrics(
    stats: pd.DataFrame, bucket: str, season: int, current_week: int, plays: pd.DataFrame
) -> pd.DataFrame:
    """Every EDGE/DL/LB/DB radar axis for the qualifying players in this
    bucket. Rates are per 100 defensive snaps, since defenders have no
    "attempts" to divide by the way passers, runners, and receivers do.
    """
    # Extras first, then the bucket filter - see with_season_extras.
    defense = with_season_extras(stats, weekly_extras(season))
    defense = split_by_alignment(defense, depth_charts.get_alignment_bucket(season))
    defense = defense[defense["position_group"] == bucket]
    defense = defense[defense["defense_snaps"] >= _min_sample(bucket, current_week)].copy()

    snaps = defense["defense_snaps"]
    tackles = total_tackles(defense)
    targets = defense["def_targets"]

    defense["pressure_rate"] = _clean(defense["def_pressures"] / snaps * 100)
    # Null (not 0) with no pressures - there's nothing to convert yet.
    defense["sack_rate"] = _clean(defense["def_sacks"] / defense["def_pressures"] * 100)
    defense["tfl_per_100_snaps"] = _clean(defense["def_tackles_for_loss"] / snaps * 100)
    defense["tackles_per_100_snaps"] = _clean(tackles / snaps * 100)
    defense["qb_hits_per_100_snaps"] = _clean(defense["def_qb_hits"] / snaps * 100)

    # Null, not a substitute stat, below the run-tackle floor: an average over
    # two or three tackles is noise, and swapping in a different measurement
    # for those players would rank two unlike quantities on one axis.
    depth = _run_tackle_depth(plays)
    run_tackles = defense["player_id"].map(depth["tackles"]).fillna(0)
    defense["tackle_depth"] = defense["player_id"].map(depth["depth"])
    defense.loc[run_tackles < RUN_TACKLE_MIN_PER_WEEK * current_week, "tackle_depth"] = np.nan
    defense["missed_tackle_pct"] = _clean(
        defense["def_missed_tackles"] / (tackles + defense["def_missed_tackles"]) * 100
    )
    # Recomputed from summed coverage counts, not averaged from PFR's weekly
    # rating - PFR leaves that blank for many linebacker weeks.
    defense["passer_rating_allowed"] = _passer_rating(
        defense["def_completions_allowed"],
        targets,
        defense["def_yards_allowed"],
        defense["def_receiving_td_allowed"],
        defense["def_interceptions"],
    )
    defense["yards_per_target_allowed"] = _clean(defense["def_yards_allowed"] / targets)
    defense["completion_pct_allowed"] = _clean(defense["def_completions_allowed"] / targets * 100)
    # Passes defended already includes interceptions (every INT play credits
    # the intercepting player with a pass defended), so it isn't added again.
    defense["ball_production"] = _clean(defense["def_pass_defended"] / targets * 100)
    defense["yac_allowed_per_reception"] = _clean(
        defense["def_yards_after_catch"] / defense["def_completions_allowed"]
    )
    defense["pass_defended_rate"] = _clean(defense["def_pass_defended"] / snaps * 100)

    defense["target_rate"] = _clean(targets / snaps * 100)
    defense.loc[targets.fillna(0) < TARGET_MIN_PER_WEEK * current_week, "target_rate"] = np.nan

    return defense


def _with_percentiles(pool: pd.DataFrame, axes: list[tuple[str, str]]) -> pd.DataFrame:
    pool = pool.copy()
    for key, _ in axes:
        ascending = key not in LOWER_IS_BETTER
        pool[f"{key}_percentile"] = pool[key].rank(pct=True, ascending=ascending) * 100
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
    percentile ranks - the shared computation behind the player radar and
    the full-league beeswarm.
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
    elif bucket == "TE":
        plays = pbp_data.get_season_pbp(season)
        ngs_receiving = nextgen_stats.get_season_nextgen_stats(season, "receiving")
        pool = _te_metrics(stats, ngs_receiving, plays, current_week)
    else:
        plays = pbp_data.get_season_pbp(season)
        pool = _defense_metrics(stats, bucket, season, current_week, plays)

    return _with_percentiles(pool, RADAR_AXES[bucket])


def _axis_entries(row: pd.Series, axes: list[tuple[str, str]]) -> list[dict[str, Any]]:
    """One pool row's radar axes as raw value + percentile - the data behind
    both the player radar (one row) and the beeswarm (every row).
    """
    return [
        {
            "key": key,
            "label": label,
            "value": None if pd.isna(row[key]) else round(float(row[key]), 2),
            "percentile": None
            if pd.isna(row[f"{key}_percentile"])
            else round(float(row[f"{key}_percentile"]), 1),
        }
        for key, label in axes
    ]


@memoized
def get_position_radar_pool(position: str) -> dict[str, Any]:
    """Every qualifying player at this position with their 6 radar axes -
    the data behind the player page's radar (which picks out its own row)
    and league-comparison beeswarm (a dot per player on each axis). A player
    missing from the pool hasn't hit the minimum season volume yet.
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
                "axes": _axis_entries(row, axes),
            }
        )

    return {
        "position": bucket,
        "axes": [{"key": key, "label": label} for key, label in axes],
        "players": players,
    }
