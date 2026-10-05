from typing import cast

import nflreadpy as nfl
import pandas as pd

# Scheme plus alignment -> the functional bucket a front-seven defender
# belongs in. Neither of nflverse's own fields can express this on its own: a
# 3-4 outside linebacker (T.J. Watt) rushes off the edge while a 4-3 one
# (Demario Davis) plays off the ball, and a 3-4 end (Chris Jones) lines up
# inside while a 4-3 end (Nick Bosa) rushes off the edge.
BUCKET_BY_ALIGNMENT = {
    # Edge rushers
    ("Base 4-3 D", "LDE"): "EDGE",
    ("Base 4-3 D", "RDE"): "EDGE",
    ("Base 3-4 D", "WLB"): "EDGE",  # Will linebacker rushing from the edge
    ("Base 3-4 D", "SLB"): "EDGE",  # Sam linebacker rushing from the edge
    # Interior line
    ("Base 4-3 D", "LDT"): "DL",
    ("Base 4-3 D", "RDT"): "DL",
    ("Base 4-3 D", "NT"): "DL",
    ("Base 3-4 D", "LDE"): "DL",  # 3-4 ends play the interior (5-tech)
    ("Base 3-4 D", "RDE"): "DL",
    ("Base 3-4 D", "NT"): "DL",
    # Off-ball linebackers
    ("Base 4-3 D", "SLB"): "LB",
    ("Base 4-3 D", "WLB"): "LB",
    ("Base 4-3 D", "MLB"): "LB",
    ("Base 3-4 D", "LILB"): "LB",
    ("Base 3-4 D", "RILB"): "LB",
}


def get_latest_depth_chart(season: int) -> pd.DataFrame:
    """Every team's current depth chart - one row per player per listed slot.

    nflverse publishes a fresh snapshot several times a day and keeps them all,
    so this keeps only the newest `dt`; without that a player appears once per
    snapshot and any join against it multiplies rows.
    """
    charts = nfl.load_depth_charts(seasons=[season]).to_pandas()
    if charts.empty:
        return cast(pd.DataFrame, charts)
    return cast(pd.DataFrame, charts[charts["dt"] == charts["dt"].max()])


def get_alignment_bucket(season: int) -> "pd.Series[str]":
    """gsis_id -> "EDGE" | "DL" | "LB" for front-seven defenders, from where
    they're listed in their team's base defense. Anyone outside the front seven
    (and anyone the depth charts don't list) is absent, so callers fall back to
    nflverse's own position_group for them.

    A player listed at several slots is kept once: the slots one player holds
    always agree on the bucket (LDE and RDE, say), so any of them will do.
    """
    charts = get_latest_depth_chart(season)
    if charts.empty:
        return cast("pd.Series[str]", pd.Series(dtype="object"))

    buckets = pd.Series(
        list(zip(charts["pos_grp"], charts["pos_abb"], strict=True)), index=charts.index
    ).map(BUCKET_BY_ALIGNMENT)
    front_seven = charts.assign(bucket=buckets).dropna(subset=["bucket", "gsis_id"])
    return cast(
        "pd.Series[str]",
        front_seven.drop_duplicates(subset=["gsis_id"], keep="first").set_index("gsis_id")[
            "bucket"
        ],
    )
