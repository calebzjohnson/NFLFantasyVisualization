import pytest

from app.services import team_tendencies


def rate(team: str, key: str) -> dict[str, float]:
    chart = team_tendencies.get_team_tendencies(team)
    return next(t for t in chart["tendencies"] if t["key"] == key)


def test_covers_both_sides_of_the_play_call(tendency_plays: None) -> None:
    keys = [t["key"] for t in team_tendencies.get_team_tendencies("DAL")["tendencies"]]

    # Grouped: Balance, then Formation, then Style.
    assert keys == [
        "dropback_rate",
        "run_rate",
        "early_down_run_rate",
        "early_down_pass_rate",
        "under_center_pass_rate",
        "shotgun_pass_rate",
        "under_center_run_rate",
        "shotgun_run_rate",
        "inside_run_rate",
        "outside_run_rate",
        "short_pass_rate",
        "deep_pass_rate",
        "huddle_rate",
        "no_huddle_rate",
        "red_zone_pass_rate",
        "red_zone_run_rate",
        "go_for_it_rate",
        "kick_rate",
        "third_down_conversion",
        "fourth_down_conversion",
    ]
    groups = [t["group"] for t in team_tendencies.get_team_tendencies("DAL")["tendencies"]]
    assert groups == (
        ["Balance"] * 4
        + ["Formation"] * 4
        + ["Run Direction"] * 2
        + ["Pass Depth"] * 2
        + ["Tempo"] * 2
        + ["Red Zone"] * 2
        + ["Fourth Down"] * 2
        + ["Conversions"] * 2
    )


def test_dropback_rate_ignores_kneels_and_spikes(tendency_plays: None) -> None:
    """DAL calls 6 dropbacks and 4 runs; the kneel and spike aren't play calls."""
    assert rate("DAL", "dropback_rate")["value"] == 60.0


def test_ignores_the_postseason(tendency_plays: None) -> None:
    """A deep postseason throw would lift this above 1 of 6 if it counted."""
    assert rate("DAL", "deep_pass_rate")["value"] == pytest.approx(16.7, abs=0.1)


def test_splits_under_center_by_run_and_pass(tendency_plays: None) -> None:
    """One of DAL's four runs is from the gun, so three are under center; four
    of its six dropbacks are. Both sides of each split are listed so nothing
    has to be inferred by subtracting from 100.
    """
    assert rate("DAL", "under_center_run_rate")["value"] == 75.0
    assert rate("DAL", "shotgun_run_rate")["value"] == 25.0
    assert rate("DAL", "under_center_pass_rate")["value"] == pytest.approx(33.3, abs=0.1)
    assert rate("DAL", "shotgun_pass_rate")["value"] == pytest.approx(66.7, abs=0.1)


def test_ranks_against_the_rest_of_the_league(tendency_plays: None) -> None:
    """DAL drops back more than NYG, and runs less on early downs."""
    assert rate("DAL", "dropback_rate")["rank"] == 1
    assert rate("NYG", "dropback_rate")["rank"] == 2
    assert rate("DAL", "early_down_run_rate")["rank"] == 2
    assert rate("DAL", "dropback_rate")["teams"] == 2


def test_reports_the_league_average(tendency_plays: None) -> None:
    """DAL 60%, NYG 20%."""
    assert rate("DAL", "dropback_rate")["league_average"] == 40.0


def test_every_split_shows_both_sides(tendency_plays: None) -> None:
    """Nothing has to be worked out by subtracting from 100."""
    for a, b in [
        ("dropback_rate", "run_rate"),
        ("early_down_run_rate", "early_down_pass_rate"),
        ("under_center_pass_rate", "shotgun_pass_rate"),
        ("deep_pass_rate", "short_pass_rate"),
        ("inside_run_rate", "outside_run_rate"),
        ("red_zone_pass_rate", "red_zone_run_rate"),
        ("go_for_it_rate", "kick_rate"),
        ("no_huddle_rate", "huddle_rate"),
    ]:
        assert rate("DAL", a)["value"] + rate("DAL", b)["value"] == pytest.approx(100, abs=0.2)


def test_red_zone_and_fourth_down_come_from_their_own_slices(tendency_plays: None) -> None:
    """DAL's one red zone snap was a throw, and it went for it on one of its
    two fourth downs. Punts count against going for it but aren't play calls,
    so they're excluded from every other rate.
    """
    assert rate("DAL", "red_zone_pass_rate")["value"] == 100.0
    assert rate("DAL", "go_for_it_rate")["value"] == 50.0
    assert rate("NYG", "go_for_it_rate")["value"] == 0.0


def test_conversions_are_outcomes_not_play_calls(tendency_plays: None) -> None:
    """DAL converted one of two third downs and its only fourth down. Unlike
    every other rate here, higher is better.
    """
    assert rate("DAL", "third_down_conversion")["value"] == 50.0
    assert rate("DAL", "fourth_down_conversion")["value"] == 100.0


def test_unknown_team_raises(tendency_plays: None) -> None:
    with pytest.raises(team_tendencies.TeamNotFoundError, match="XYZ"):
        team_tendencies.get_team_tendencies("XYZ")
