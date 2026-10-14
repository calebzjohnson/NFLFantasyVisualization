from typing import Any

import pytest

from app.services import team_playmaking


def chart(key: str) -> dict[str, Any]:
    return team_playmaking.get_team_playmaking("DAL")[key]


def leaders(key: str) -> list[tuple[str, float]]:
    groups = team_playmaking.get_team_playmaking("DAL")["leaders"]
    section = next(group for group in groups if group["key"] == key)
    return [(player["name"], player["value"]) for player in section["players"]]


def test_touch_share_counts_only_the_backfield(playmaking_sources: None) -> None:
    """W One has 8 receptions but isn't a back, so he's out of this pool."""
    touches = chart("touches")

    assert touches["team_value"] == 12
    assert [(t["name"], t["value"]) for t in touches["teammates"]] == [("R One", 10), ("R Two", 2)]


def test_target_share_covers_every_pass_catcher(playmaking_sources: None) -> None:
    targets = chart("targets")

    assert targets["team_value"] == 22
    assert [(t["name"], t["value"]) for t in targets["teammates"]] == [
        ("W One", 12),
        ("T One", 8),
        ("R One", 2),
    ]


def test_usage_sections_carry_no_focus_player(playmaking_sources: None) -> None:
    """The chart is shared with the player page, which singles one player out."""
    for key in ("touches", "targets"):
        assert chart(key)["player_id"] is None
        assert chart(key)["player_value"] == 0


def test_usage_sections_keep_the_weekly_breakdown(playmaking_sources: None) -> None:
    weekly = chart("touches")["weekly"]

    assert [week["week"] for week in weekly] == [1]
    assert {player["name"] for player in weekly[0]["players"]} == {"R One", "R Two"}


def test_red_zone_counts_carries_and_catches_inside_the_twenty(playmaking_sources: None) -> None:
    """R One has two carries inside the 20 plus a completion. The carry from
    the 45, the incompletion, and the postseason play are all excluded.
    """
    red_zone = team_playmaking.get_team_playmaking("DAL")["red_zone"]

    assert red_zone["total"] == 3
    assert [(p["name"], p["touches"]) for p in red_zone["players"]] == [("R One", 3)]


def test_red_zone_names_players_from_the_roster(playmaking_sources: None) -> None:
    """Play-by-play abbreviates names; the rest of the page doesn't."""
    red_zone = team_playmaking.get_team_playmaking("DAL")["red_zone"]

    assert red_zone["players"][0]["name"] == "R One"
    assert red_zone["players"][0]["headshot_url"] == "https://example.com/R1.png"


def test_leaders_cover_both_sides_of_the_ball(playmaking_sources: None) -> None:
    keys = [group["key"] for group in team_playmaking.get_team_playmaking("DAL")["leaders"]]

    assert keys == [
        "receiving_yards",
        "rushing_yards",
        "def_sacks",
        "tackles",
        "def_interceptions",
    ]


def test_leaders_rank_within_the_team(playmaking_sources: None) -> None:
    """X One has more receiving yards than anyone here, but plays for NYG."""
    assert leaders("receiving_yards")[0] == ("W One", 140.0)
    assert "X One" not in [name for name, _ in leaders("receiving_yards")]
    assert leaders("rushing_yards")[0] == ("R One", 120.0)


def test_tackles_use_the_site_wide_definition(playmaking_sources: None) -> None:
    """D One is 20 solo + 5 assists; a solo-only count would read 20."""
    assert leaders("tackles")[0] == ("D One", 25.0)


def test_tied_leaders_keep_their_source_order(playmaking_sources: None) -> None:
    """Both have one sack and one interception this early; nothing invents a
    winner between them.
    """
    assert [name for name, _ in leaders("def_sacks")[:2]] == ["D One", "D Two"]
    assert [value for _, value in leaders("def_interceptions")[:2]] == [1.0, 1.0]


def test_unknown_team_raises(playmaking_sources: None) -> None:
    with pytest.raises(team_playmaking.TeamNotFoundError, match="XYZ"):
        team_playmaking.get_team_playmaking("XYZ")
