from typing import Any

import nflreadpy as nfl
import pandas as pd

from app.cache import memoized
from app.data import pbp

REGULAR_SEASON = "REG"

# Neutral script: close enough that the score isn't dictating the call, and
# before the fourth quarter, when trailing teams abandon the run.
NEUTRAL_WP = (0.2, 0.8)
NEUTRAL_MAX_QUARTER = 3

# (key, label, group), in display order. Every rate is a share of a team's own
# plays, so higher is simply "more of this", never better or worse - there's no
# lower_is_better here.
TENDENCIES = (
    ("dropback_rate", "Dropback Rate", "Balance"),
    ("run_rate", "Run Rate", "Balance"),
    ("early_down_run_rate", "Early-Down Run Rate", "Balance"),
    ("early_down_pass_rate", "Early-Down Pass Rate", "Balance"),
    ("under_center_pass_rate", "Under-Center Pass Rate", "Formation"),
    ("shotgun_pass_rate", "Shotgun Pass Rate", "Formation"),
    ("under_center_run_rate", "Under-Center Run Rate", "Formation"),
    ("shotgun_run_rate", "Shotgun Run Rate", "Formation"),
    ("inside_run_rate", "Inside Run Rate", "Run Direction"),
    ("outside_run_rate", "Outside Run Rate", "Run Direction"),
    ("short_pass_rate", "Short Pass Rate", "Pass Depth"),
    ("deep_pass_rate", "Deep Pass Rate", "Pass Depth"),
    ("huddle_rate", "Huddle Rate", "Tempo"),
    ("no_huddle_rate", "No-Huddle Rate", "Tempo"),
    ("red_zone_pass_rate", "Red Zone Pass Rate", "Red Zone"),
    ("red_zone_run_rate", "Red Zone Run Rate", "Red Zone"),
    ("go_for_it_rate", "Go For It Rate", "Fourth Down"),
    ("kick_rate", "Kick Rate", "Fourth Down"),
    ("third_down_conversion", "Third Down Conversion", "Conversions"),
    ("fourth_down_conversion", "Fourth Down Conversion", "Conversions"),
)

RED_ZONE_YARDLINE = 20
FOURTH_DOWN_PLAYS = ("run", "pass", "punt", "field_goal")

EARLY_DOWNS = (1, 2)


class TeamNotFoundError(ValueError):
    """Raised when a team abbreviation has run no plays this season."""


def _offensive_plays(plays: pd.DataFrame) -> pd.DataFrame:
    """Run and pass snaps a team chose to call: kneels and spikes are clock
    management, not play calls, so they'd drag a team's pass rate around at
    the end of halves.
    """
    return plays[
        (plays["season_type"] == REGULAR_SEASON)
        & plays["posteam"].notna()
        & plays["play_type"].isin(["run", "pass"])
        & (plays["qb_kneel"] == 0)
        & (plays["qb_spike"] == 0)
    ]


def _rates(plays: pd.DataFrame) -> pd.DataFrame:
    """One row per team, one column per tendency, as percentages."""
    by_team = plays.groupby("posteam")
    rates = pd.DataFrame(
        {
            # Dropbacks, not pass attempts: a scramble or a sack was a called
            # pass, and counting attempts alone understates how often a team
            # chose to throw.
            "dropback_rate": by_team["qb_dropback"].mean() * 100,
            "no_huddle_rate": by_team["no_huddle"].mean() * 100,
        }
    )

    # Both sides of every split are listed rather than left to be inferred: a
    # reader shouldn't have to subtract from 100 to learn the other half.
    rates["run_rate"] = 100 - rates["dropback_rate"]
    rates["huddle_rate"] = 100 - rates["no_huddle_rate"]

    thrown = plays[plays["pass_length"].notna()]
    deep = thrown.assign(is_deep=thrown["pass_length"] == "deep")
    rates["deep_pass_rate"] = deep.groupby("posteam")["is_deep"].mean() * 100
    rates["short_pass_rate"] = 100 - rates["deep_pass_rate"]

    # Run-side tendencies. Plain run rate would just be 100 - dropback rate,
    # so these ask different questions: how committed a team is to the run
    # before it's behind the chains, and whether it runs downhill or from the
    # gun. `shotgun` is binary, so under center is simply its complement.
    early = plays[plays["down"].isin(EARLY_DOWNS)]
    early = early.assign(is_run=early["play_type"] == "run")
    rates["early_down_run_rate"] = early.groupby("posteam")["is_run"].mean() * 100
    rates["early_down_pass_rate"] = 100 - rates["early_down_run_rate"]

    # Both sides of each split are listed rather than left to be inferred: a
    # reader shouldn't have to subtract from 100 to learn how often a team is
    # in the gun.
    runs = plays[plays["play_type"] == "run"]
    rates["shotgun_run_rate"] = runs.groupby("posteam")["shotgun"].mean() * 100
    rates["under_center_run_rate"] = 100 - rates["shotgun_run_rate"]

    # Split by run and pass rather than one blended shotgun rate: a team can
    # run downhill and still throw almost everything from the gun, and the
    # combined number hides that. Under-center passing is also the closest
    # stand-in for play action, which nflverse doesn't carry.
    # run_gap is recorded for runs off left/right only - it's missing exactly
    # on middle runs, which are inside by definition. Together the two fields
    # classify 99% of carries.
    directed = runs[runs["run_gap"].notna() | (runs["run_location"] == "middle")]
    is_inside = directed["run_gap"].eq("guard") | directed["run_location"].eq("middle")
    rates["inside_run_rate"] = directed.assign(inside=is_inside).groupby("posteam")[
        "inside"
    ].mean() * 100
    rates["outside_run_rate"] = 100 - rates["inside_run_rate"]

    drops = plays[plays["qb_dropback"] == 1]
    rates["shotgun_pass_rate"] = drops.groupby("posteam")["shotgun"].mean() * 100
    rates["under_center_pass_rate"] = 100 - rates["shotgun_pass_rate"]

    return rates


def _situational(plays: pd.DataFrame, rates: pd.DataFrame) -> None:
    """Red zone balance and fourth-down aggression, added to `rates` in place.

    These two read the whole play-by-play rather than the called-plays subset:
    fourth downs include punts and field goals, which aren't play calls in the
    same sense but are exactly what "went for it" is measured against.
    """
    red_zone = plays[plays["yardline_100"] <= RED_ZONE_YARDLINE]
    rates["red_zone_pass_rate"] = red_zone.groupby("posteam")["qb_dropback"].mean() * 100
    rates["red_zone_run_rate"] = 100 - rates["red_zone_pass_rate"]


@memoized
def get_team_tendencies(team: str) -> dict[str, Any]:
    """How this team calls plays - how often it drops back, throws deep, runs
    on early downs, runs from under center, lines up in shotgun and goes
    no-huddle - each with its rank among the 32 teams.
    """
    season = nfl.get_current_season()
    plays = _offensive_plays(pbp.get_season_pbp(season))
    if plays.empty:
        season -= 1
        plays = _offensive_plays(pbp.get_season_pbp(season))

    if plays.empty or team not in set(plays["posteam"]):
        raise TeamNotFoundError(f"No plays found for team: {team}")

    rates = _rates(plays)
    _situational(plays, rates)

    # Fourth downs are measured against every fourth-down snap, kicks included,
    # so they come from the full play-by-play rather than the called-play set.
    full = pbp.get_season_pbp(season)
    fourth = full[
        (full["season_type"] == REGULAR_SEASON)
        & full["posteam"].notna()
        & (full["down"] == 4)
        & full["play_type"].isin(FOURTH_DOWN_PLAYS)
    ]
    went = fourth.assign(went=fourth["play_type"].isin(["run", "pass"]))
    rates["go_for_it_rate"] = went.groupby("posteam")["went"].mean() * 100
    rates["kick_rate"] = 100 - rates["go_for_it_rate"]

    # Conversions are outcomes rather than play calls, so unlike every other
    # rate here higher is better. Fourth down runs on roughly seven attempts a
    # team this early, so a single stop moves it a long way.
    for down, key in ((3, "third_down_conversion"), (4, "fourth_down_conversion")):
        prefix = "third" if down == 3 else "fourth"
        attempts = full[
            (full["season_type"] == REGULAR_SEASON)
            & full["posteam"].notna()
            & ((full[f"{prefix}_down_converted"] == 1) | (full[f"{prefix}_down_failed"] == 1))
        ]
        rates[key] = attempts.groupby("posteam")[f"{prefix}_down_converted"].mean() * 100
    tendencies = []
    for key, label, group in TENDENCIES:
        column = rates[key]
        value = column.get(team)
        if pd.isna(value):
            continue
        tendencies.append(
            {
                "key": key,
                "label": label,
                "group": group,
                "value": round(float(value), 1),
                # Rank is just placement, not judgement: throwing often isn't
                # better than running often.
                "rank": int(column.rank(ascending=False, method="min")[team]),
                "teams": int(column.notna().sum()),
                "league_average": round(float(column.mean()), 1),
            }
        )

    return {"team": team, "tendencies": tendencies}
