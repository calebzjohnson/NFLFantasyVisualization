import pandas as pd
import pytest

from app.services.extended_stats import (
    PFR_COLUMNS,
    split_front_seven,
    split_specialists,
    weekly_extras,
    with_season_extras,
    with_weekly_extras,
)


def test_split_specialists_gives_kickers_and_punters_their_own_group() -> None:
    stats = pd.DataFrame(
        [
            dict(player_id="K1", position="K", position_group="SPEC"),
            dict(player_id="P1", position="P", position_group="SPEC"),
            dict(player_id="C1", position="C", position_group="OL"),
        ]
    )

    assert split_specialists(stats)["position_group"].tolist() == ["K", "P", "OL"]


def test_split_front_seven_buckets_by_alignment_not_listed_position() -> None:
    """The whole point of the alignment split: nflverse's own groups put 3-4
    edge rushers in LB next to off-ball linebackers, and 3-4 ends in DL next to
    true edge rushers. Depth-chart alignment separates them.
    """
    stats = pd.DataFrame(
        [
            dict(player_id="E1", position="OLB", position_group="LB"),  # 3-4 edge
            dict(player_id="I1", position="DE", position_group="DL"),  # 3-4 end, interior
            dict(player_id="L1", position="OLB", position_group="LB"),  # 4-3 off-ball
            dict(player_id="C1", position="CB", position_group="DB"),  # untouched
        ]
    )
    aligned = pd.Series({"E1": "EDGE", "I1": "DL", "L1": "LB", "C1": "EDGE"})

    assert split_front_seven(stats, aligned)["position_group"].tolist() == [
        "EDGE",
        "DL",
        "LB",
        "DB",  # outside the front seven, so its group is left alone
    ]


def test_split_front_seven_keeps_the_original_group_when_unlisted() -> None:
    """A player the depth charts don't carry keeps nflverse's group rather than
    dropping out of every bucket.
    """
    stats = pd.DataFrame([dict(player_id="D1", position="DT", position_group="DL")])

    result = split_front_seven(stats, pd.Series(dtype="object"))

    assert result["position_group"].tolist() == ["DL"]


@pytest.fixture
def sample_snaps() -> pd.DataFrame:
    """Two DAL linemen in one game (team ran 60 plays: 60/1.0 and 30/0.5
    both recover it), plus a defender whose rounded pct (0.33 of 60 = 19.8)
    shouldn't throw the team total off, and a postseason row that should be
    ignored.
    """
    rows = [
        dict(pfr_player_id="ol1", game_type="REG", week=1, team="DAL", opponent="NYG",
             offense_snaps=60, offense_pct=1.0, defense_snaps=0, defense_pct=0.0, st_snaps=0),
        dict(pfr_player_id="ol2", game_type="REG", week=1, team="DAL", opponent="NYG",
             offense_snaps=30, offense_pct=0.5, defense_snaps=0, defense_pct=0.0, st_snaps=0),
        dict(pfr_player_id="dl1", game_type="REG", week=1, team="NYG", opponent="DAL",
             offense_snaps=0, offense_pct=0.0, defense_snaps=20, defense_pct=0.33, st_snaps=3),
        dict(pfr_player_id="dl2", game_type="REG", week=1, team="NYG", opponent="DAL",
             offense_snaps=0, offense_pct=0.0, defense_snaps=60, defense_pct=1.0, st_snaps=0),
        dict(pfr_player_id="dl1", game_type="REG", week=2, team="NYG", opponent="PHI",
             offense_snaps=0, offense_pct=0.0, defense_snaps=40, defense_pct=0.8, st_snaps=0),
        dict(pfr_player_id="dl1", game_type="POST", week=19, team="NYG", opponent="PHI",
             offense_snaps=0, offense_pct=0.0, defense_snaps=50, defense_pct=1.0, st_snaps=0),
    ]
    return pd.DataFrame(rows)


@pytest.fixture
def sample_pfr() -> pd.DataFrame:
    """PFR rows for the defender only - linemen never get one."""
    rows = [
        dict(pfr_player_id="dl1", game_type="REG", week=1, def_pressures=3, def_missed_tackles=1),
        dict(pfr_player_id="dl1", game_type="REG", week=2, def_pressures=2, def_missed_tackles=0),
    ]
    return pd.DataFrame(rows).reindex(
        columns=["pfr_player_id", "game_type", "week", *PFR_COLUMNS], fill_value=0
    )


@pytest.fixture
def patched_sources(
    monkeypatch: pytest.MonkeyPatch, sample_snaps: pd.DataFrame, sample_pfr: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.data.snap_counts.get_season_snap_counts", lambda season: sample_snaps)
    monkeypatch.setattr("app.data.pfr_defense.get_season_pfr_defense", lambda season: sample_pfr)
    monkeypatch.setattr(
        "app.data.snap_counts.get_pfr_to_gsis_map",
        lambda: pd.Series({"ol1": "OL1", "ol2": "OL2", "dl1": "DL1", "dl2": "DL2"}),
    )
    monkeypatch.setattr(
        "app.data.players.get_players",
        lambda: pd.DataFrame(
            [
                dict(gsis_id="OL1", display_name="O One", position="C", position_group="OL",
                     headshot="ol1.png"),
                dict(gsis_id="OL2", display_name="O Two", position="G", position_group="OL",
                     headshot=None),
                dict(gsis_id="DL1", display_name="D One", position="DE", position_group="DL",
                     headshot=None),
                dict(gsis_id="DL2", display_name="D Two", position="DT", position_group="DL",
                     headshot=None),
            ]
        ),
    )


@pytest.mark.usefixtures("patched_sources")
def test_weekly_extras_recovers_team_snaps_and_snap_share() -> None:
    extras = weekly_extras(2026).set_index(["player_id", "week"])

    assert extras.loc[("OL2", 1), "offense_team_snaps"] == 60
    assert extras.loc[("OL2", 1), "offense_snap_pct"] == 50
    assert extras.loc[("DL1", 1), "defense_team_snaps"] == 60  # not thrown off by 0.33
    assert ("DL1", 19) not in extras.index  # postseason excluded


@pytest.mark.usefixtures("patched_sources")
def test_weekly_extras_zero_fills_pfr_stats_for_players_without_a_pfr_row() -> None:
    extras = weekly_extras(2026).set_index(["player_id", "week"])

    assert extras.loc[("DL1", 1), "def_pressures"] == 3
    assert extras.loc[("OL1", 1), "def_pressures"] == 0


@pytest.mark.usefixtures("patched_sources")
def test_with_weekly_extras_adds_quiet_weeks_with_identity_fields() -> None:
    stats = pd.DataFrame(
        [dict(player_id="OL1", player_display_name="O One", position="C", position_group="OL",
              week=1, season_type="REG", team="DAL", penalties=1)]
    )

    rows = with_weekly_extras(stats, weekly_extras(2026)).set_index(["player_id", "week"])

    assert rows.loc[("OL1", 1), "penalties"] == 1
    assert rows.loc[("OL1", 1), "offense_snaps"] == 60
    quiet = rows.loc[("OL2", 1)]
    assert quiet["player_display_name"] == "O Two"
    assert quiet["team"] == "DAL"
    assert quiet["opponent_team"] == "NYG"
    assert pd.isna(quiet["penalties"])


@pytest.mark.usefixtures("patched_sources")
def test_with_season_extras_sums_games_and_adds_players_with_no_stat_row() -> None:
    stats = pd.DataFrame(
        [dict(player_id="DL1", player_display_name="D One", position_group="DL",
              recent_team="NYG", def_sacks=1)]
    )

    rows = with_season_extras(stats, weekly_extras(2026)).set_index("player_id")

    assert rows.loc["DL1", "defense_snaps"] == 60  # 20 + 40, POST excluded
    # 60 of the team's 60 + 50 (40 snaps at 0.8) = 110 snaps in the games he played
    assert rows.loc["DL1", "defense_snap_pct"] == pytest.approx(60 / 110 * 100)
    assert rows.loc["DL1", "def_pressures"] == 5
    assert rows.loc["DL2", "player_display_name"] == "D Two"
    assert rows.loc["DL2", "recent_team"] == "NYG"
    assert rows.loc["OL1", "headshot_url"] == "ol1.png"
