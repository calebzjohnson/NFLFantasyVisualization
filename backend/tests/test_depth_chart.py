from typing import Any

import pytest

from app.services import depth_chart


def unit(team: str, key: str) -> dict[str, Any]:
    chart = depth_chart.get_team_depth_chart(team)
    return next(group for group in chart["groups"] if group["key"] == key)


def slot(team: str, key: str, position: str) -> dict[str, Any]:
    return next(s for s in unit(team, key)["slots"] if s["position"] == position)


def test_groups_units_in_order_and_heads_each_with_its_nflverse_name(
    depth_chart_sources: None,
) -> None:
    chart = depth_chart.get_team_depth_chart("DAL")

    assert chart["team"] == "DAL"
    assert chart["scheme"] == "Base 4-3 D"
    assert [group["key"] for group in chart["groups"]] == ["offense", "defense", "special_teams"]
    assert {group["key"]: group["label"] for group in chart["groups"]} == {
        "offense": "3WR 1TE",
        "defense": "Base 4-3 D",
        "special_teams": "Special Teams",
    }


def test_orders_offense_backfield_then_receivers_then_the_line(depth_chart_sources: None) -> None:
    """nflverse's pos_slot would give WR, QB, TE here; display order is fixed."""
    offense = unit("DAL", "offense")

    assert [s["position"] for s in offense["slots"]] == ["QB", "WR", "TE"]


def test_orders_players_within_a_slot_by_depth(depth_chart_sources: None) -> None:
    quarterbacks = slot("DAL", "offense", "QB")

    assert quarterbacks["position_name"] == "Quarterback"
    assert [(p["name"], p["rank"]) for p in quarterbacks["players"]] == [("Q One", 1), ("Q Two", 2)]


def test_reads_only_the_newest_snapshot(depth_chart_sources: None) -> None:
    names = [p["name"] for p in slot("DAL", "offense", "QB")["players"]]

    assert "Q Gone" not in names


def test_reserve_wins_over_a_weekly_designation(depth_chart_sources: None) -> None:
    """Q Two is on reserve and also Questionable; reserve is the useful one."""
    assert slot("DAL", "offense", "QB")["players"][1] == {
        "player_id": "Q2",
        "name": "Q Two",
        "rank": 2,
        "status": "RESERVE",
        "injury": "Shoulder",
    }


def test_keeps_reserve_players_at_their_listed_depth(depth_chart_sources: None) -> None:
    players = slot("DAL", "offense", "TE")["players"]

    assert [(p["name"], p["rank"], p["status"]) for p in players] == [("T One", 2, "RESERVE")]


def test_names_only_the_reserve_codes_nflverse_pins_down(depth_chart_sources: None) -> None:
    """R04 and R40 resolve; an undocumented code stays a generic "Reserve"
    rather than claiming the player is hurt."""
    rows = depth_chart.get_team_depth_chart("DAL")["report"]
    report = {row["name"]: row["status"] for row in rows}

    assert report["P One"] == "PUP"
    assert report["S One"] == "SUSPENDED"
    assert report["Q Two"] == "RESERVE"


def test_backfills_a_reserve_cause_from_an_earlier_week(depth_chart_sources: None) -> None:
    """T One went on reserve after being reported out with an Achilles in week
    2; he's absent from week 3's report, so only the lookback can name it."""
    rows = depth_chart.get_team_depth_chart("DAL")["report"]
    report = {row["name"]: row["injury"] for row in rows}

    assert report["T One"] == "Achilles"
    # P One has never been reported on, so nothing can name his cause.
    assert report["P One"] is None


def test_flags_a_weekly_designation_from_the_latest_week_only(depth_chart_sources: None) -> None:
    """W One was Out in week 2 and Questionable in week 3; week 3 is current."""
    receiver = slot("DAL", "offense", "WR")["players"][0]

    assert receiver["status"] == "QUESTIONABLE"
    assert receiver["injury"] == "Knee"


def test_leaves_practice_only_rows_unflagged(depth_chart_sources: None) -> None:
    """D One appears on the report with practice detail but no designation."""
    report = depth_chart.get_team_depth_chart("DAL")["report"]

    assert unit("DAL", "defense")["slots"][0]["players"][0]["status"] is None
    assert "D1" not in [row["player_id"] for row in report]


def test_report_lists_every_flagged_player_most_severe_first(depth_chart_sources: None) -> None:
    report = depth_chart.get_team_depth_chart("DAL")["report"]

    assert [(row["name"], row["status"]) for row in report] == [
        ("Q Two", "RESERVE"),
        ("T One", "RESERVE"),
        ("P One", "PUP"),
        ("S One", "SUSPENDED"),
        ("X Nine", "OUT"),
        ("W One", "QUESTIONABLE"),
    ]


def test_report_includes_a_player_who_dropped_off_the_chart(depth_chart_sources: None) -> None:
    """X Nine is Out but holds no depth slot, so only the report can show him."""
    chart = depth_chart.get_team_depth_chart("DAL")
    listed = {
        player["player_id"]
        for group in chart["groups"]
        for s in group["slots"]
        for player in s["players"]
    }

    assert "X9" not in listed
    assert next(row for row in chart["report"] if row["player_id"] == "X9") == {
        "player_id": "X9",
        "name": "X Nine",
        "position": "CB",
        "status": "OUT",
        "injury": "Ankle",
        "practice_status": "Did Not Participate",
    }


def test_ignores_other_teams(depth_chart_sources: None) -> None:
    chart = depth_chart.get_team_depth_chart("DAL")
    names = [
        player["name"]
        for group in chart["groups"]
        for s in group["slots"]
        for player in s["players"]
    ]

    assert "Q Nine" not in names


def test_unknown_team_raises(depth_chart_sources: None) -> None:
    with pytest.raises(depth_chart.TeamNotFoundError, match="XYZ"):
        depth_chart.get_team_depth_chart("XYZ")
