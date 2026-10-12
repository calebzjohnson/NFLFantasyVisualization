from typing import Any

import nflreadpy as nfl
import pandas as pd

from app.cache import memoized
from app.data import depth_charts, injuries, rosters

RESERVE_STATUS = "RES"

STATUS_BY_REPORT = {
    "Out": "OUT",
    "Doubtful": "DOUBTFUL",
    "Questionable": "QUESTIONABLE",
}

# Most severe first, for the status section's ordering.
STATUS_ORDER = ("IR", "OUT", "DOUBTFUL", "QUESTIONABLE")

UNIT_ORDER = ("offense", "defense", "special_teams")

# nflverse's own pos_slot interleaves the line with the receivers (WR, WR, LT,
# LG, C, RG, RT, WR, QB, TE, RB, FB), so offense is re-sorted into this order.
OFFENSE_SLOT_ORDER = ("QB", "RB", "FB", "WR", "TE", "LT", "LG", "C", "RG", "RT")


class TeamNotFoundError(ValueError):
    """Raised when a team abbreviation has no depth chart this season."""


def _cell(value: Any) -> Any:
    return value if pd.notna(value) else None


def _offense_rank(position: str) -> int:
    return OFFENSE_SLOT_ORDER.index(position) if position in OFFENSE_SLOT_ORDER else len(
        OFFENSE_SLOT_ORDER
    )


def _player_status(season: int, team: str) -> dict[str, dict[str, Any]]:
    """gsis_id -> status/injury for one team, merging the two sources.

    Reserve wins over a weekly designation: a player can hold both, and "IR"
    is the more useful of the two to show. Name and position come from these
    frames rather than the depth chart, since a player can be on the report
    having already dropped off the chart.
    """
    statuses: dict[str, dict[str, Any]] = {}

    roster = rosters.get_season_rosters(season)
    if not roster.empty:
        reserve = roster[(roster["team"] == team) & (roster["status"] == RESERVE_STATUS)]
        for row in reserve.itertuples():
            if pd.isna(row.gsis_id):
                continue
            statuses[str(row.gsis_id)] = {
                "status": "IR",
                "injury": None,
                "practice_status": None,
                "name": _cell(row.full_name),
                "position": _cell(row.position),
            }

    report = injuries.get_season_injuries(season)
    if not report.empty:
        report = report[report["team"] == team]
    if not report.empty:
        report = report[report["week"] == report["week"].max()]
        for row in report.itertuples():
            status = STATUS_BY_REPORT.get(row.report_status)
            if status is None or pd.isna(row.gsis_id) or str(row.gsis_id) in statuses:
                continue
            statuses[str(row.gsis_id)] = {
                "status": status,
                "injury": _cell(row.report_primary_injury),
                "practice_status": _cell(row.practice_status),
                "name": _cell(row.full_name),
                "position": _cell(row.position),
            }

    return statuses


def _slots(unit_rows: pd.DataFrame, statuses: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    slots = []
    for slot, slot_rows in unit_rows.groupby("pos_slot", sort=True):
        players = [
            {
                "player_id": _cell(row.gsis_id),
                "name": _cell(row.player_name),
                "rank": int(str(row.pos_rank)),
                "status": statuses.get(str(row.gsis_id), {}).get("status"),
                "injury": statuses.get(str(row.gsis_id), {}).get("injury"),
            }
            for row in slot_rows.sort_values("pos_rank").itertuples()
        ]
        slots.append(
            {
                "slot": int(str(slot)),
                "position": str(slot_rows["pos_abb"].iloc[0]),
                "position_name": str(slot_rows["pos_name"].iloc[0]),
                "players": players,
            }
        )
    return slots


@memoized
def get_team_depth_chart(team: str) -> dict[str, Any]:
    """This team's current depth chart by unit, each player carrying his
    availability, plus the combined status section - the data behind the team
    page's Depth Chart tab.

    Reserve players keep their listed depth rank rather than being filtered
    out, so the ranks stay faithful to nflverse's own ordering.
    """
    season = nfl.get_current_season()
    charts = depth_charts.get_latest_depth_chart(season)
    if charts.empty:
        season -= 1
        charts = depth_charts.get_latest_depth_chart(season)

    team_rows = charts[charts["team"] == team] if not charts.empty else charts
    if team_rows.empty:
        raise TeamNotFoundError(f"No depth chart found for team: {team}")

    statuses = _player_status(season, team)
    units = team_rows.assign(unit=team_rows["pos_grp"].map(depth_charts.UNIT_BY_POS_GRP))
    scheme = next((grp for grp in units["pos_grp"].unique() if grp in depth_charts.SCHEMES), None)

    groups = []
    for unit in UNIT_ORDER:
        unit_rows = units[units["unit"] == unit]
        if unit_rows.empty:
            continue
        slots = _slots(unit_rows, statuses)
        if unit == "offense":
            slots.sort(key=lambda s: (_offense_rank(s["position"]), s["slot"]))
        # Each unit is headed by nflverse's own group name - the offense's
        # personnel grouping, the defense's scheme.
        groups.append(
            {"key": unit, "label": str(unit_rows["pos_grp"].iloc[0]), "slots": slots}
        )

    report = [
        {
            "player_id": gsis_id,
            "name": flags["name"],
            "position": flags["position"],
            "status": flags["status"],
            "injury": flags["injury"],
            "practice_status": flags["practice_status"],
        }
        for gsis_id, flags in statuses.items()
    ]
    report.sort(key=lambda row: (STATUS_ORDER.index(row["status"]), row["name"] or ""))

    return {"team": team, "scheme": scheme, "groups": groups, "report": report}
