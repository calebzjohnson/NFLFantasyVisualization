import pandas as pd
import pytest


@pytest.fixture
def sample_weekly_data() -> pd.DataFrame:
    """A small, hand-built stand-in for weekly.get_weekly_data(season).

    Covers: normal ranking, a player traded mid-season (R3: DAL -> PHI, whose
    team should show as their most recent one), and a postseason row that
    must be excluded from regular-season totals.
    """
    rows = [
        # QBs
        dict(player_id="Q1", player_display_name="Q One", position="QB", team="DAL",
             week=1, season_type="REG", passing_yards=300, rushing_yards=0, receiving_yards=0),
        dict(player_id="Q1", player_display_name="Q One", position="QB", team="DAL",
             week=2, season_type="REG", passing_yards=250, rushing_yards=0, receiving_yards=0),
        dict(player_id="Q2", player_display_name="Q Two", position="QB", team="PHI",
             week=1, season_type="REG", passing_yards=200, rushing_yards=0, receiving_yards=0),
        dict(player_id="Q2", player_display_name="Q Two", position="QB", team="PHI",
             week=2, season_type="REG", passing_yards=300, rushing_yards=0, receiving_yards=0),
        # RBs (R2 outranks R1 on total despite lower week-1 total)
        dict(player_id="R1", player_display_name="R One", position="RB", team="DAL",
             week=1, season_type="REG", passing_yards=0, rushing_yards=100, receiving_yards=0),
        dict(player_id="R1", player_display_name="R One", position="RB", team="DAL",
             week=2, season_type="REG", passing_yards=0, rushing_yards=80, receiving_yards=0),
        dict(player_id="R2", player_display_name="R Two", position="RB", team="PHI",
             week=1, season_type="REG", passing_yards=0, rushing_yards=90, receiving_yards=0),
        dict(player_id="R2", player_display_name="R Two", position="RB", team="PHI",
             week=2, season_type="REG", passing_yards=0, rushing_yards=95, receiving_yards=0),
        # R3 traded DAL (week 1) -> PHI (week 2): team should show as PHI, total across both
        dict(player_id="R3", player_display_name="R Three", position="RB", team="DAL",
             week=1, season_type="REG", passing_yards=0, rushing_yards=10, receiving_yards=0),
        dict(player_id="R3", player_display_name="R Three", position="RB", team="PHI",
             week=2, season_type="REG", passing_yards=0, rushing_yards=5, receiving_yards=0),
        # WRs
        dict(player_id="W1", player_display_name="W One", position="WR", team="DAL",
             week=1, season_type="REG", passing_yards=0, rushing_yards=0, receiving_yards=70),
        dict(player_id="W1", player_display_name="W One", position="WR", team="DAL",
             week=2, season_type="REG", passing_yards=0, rushing_yards=0, receiving_yards=60),
        dict(player_id="W2", player_display_name="W Two", position="WR", team="PHI",
             week=1, season_type="REG", passing_yards=0, rushing_yards=0, receiving_yards=50),
        dict(player_id="W2", player_display_name="W Two", position="WR", team="PHI",
             week=2, season_type="REG", passing_yards=0, rushing_yards=0, receiving_yards=90),
        # TEs
        dict(player_id="T1", player_display_name="T One", position="TE", team="DAL",
             week=1, season_type="REG", passing_yards=0, rushing_yards=0, receiving_yards=30),
        dict(player_id="T1", player_display_name="T One", position="TE", team="DAL",
             week=2, season_type="REG", passing_yards=0, rushing_yards=0, receiving_yards=40),
        dict(player_id="T2", player_display_name="T Two", position="TE", team="PHI",
             week=1, season_type="REG", passing_yards=0, rushing_yards=0, receiving_yards=45),
        dict(player_id="T2", player_display_name="T Two", position="TE", team="PHI",
             week=2, season_type="REG", passing_yards=0, rushing_yards=0, receiving_yards=35),
        # DL (sacks)
        dict(player_id="D1", player_display_name="D One", position="DE", team="DAL",
             week=1, season_type="REG", def_sacks=2.0),
        dict(player_id="D1", player_display_name="D One", position="DE", team="DAL",
             week=2, season_type="REG", def_sacks=1.5),
        dict(player_id="D2", player_display_name="D Two", position="DT", team="PHI",
             week=1, season_type="REG", def_sacks=1.0),
        dict(player_id="D2", player_display_name="D Two", position="DT", team="PHI",
             week=2, season_type="REG", def_sacks=1.0),
        # LB (tackles = solo + assist; L1 outranks L2 on combined total)
        dict(player_id="L1", player_display_name="L One", position="MLB", team="DAL",
             week=1, season_type="REG", def_tackles_solo=5, def_tackles_with_assist=2),
        dict(player_id="L1", player_display_name="L One", position="MLB", team="DAL",
             week=2, season_type="REG", def_tackles_solo=4, def_tackles_with_assist=1),
        dict(player_id="L2", player_display_name="L Two", position="OLB", team="PHI",
             week=1, season_type="REG", def_tackles_solo=3, def_tackles_with_assist=3),
        dict(player_id="L2", player_display_name="L Two", position="OLB", team="PHI",
             week=2, season_type="REG", def_tackles_solo=4, def_tackles_with_assist=0),
        # CB (interceptions)
        dict(player_id="C1", player_display_name="C One", position="CB", team="DAL",
             week=1, season_type="REG", def_interceptions=1),
        dict(player_id="C1", player_display_name="C One", position="CB", team="DAL",
             week=2, season_type="REG", def_interceptions=1),
        dict(player_id="C2", player_display_name="C Two", position="CB", team="PHI",
             week=1, season_type="REG", def_interceptions=1),
        dict(player_id="C2", player_display_name="C Two", position="CB", team="PHI",
             week=2, season_type="REG", def_interceptions=0),
        # S (interceptions) - mix of "S" and "SAF" position codes, both should count
        dict(player_id="S1", player_display_name="S One", position="S", team="DAL",
             week=1, season_type="REG", def_interceptions=0),
        dict(player_id="S1", player_display_name="S One", position="S", team="DAL",
             week=2, season_type="REG", def_interceptions=2),
        dict(player_id="S2", player_display_name="S Two", position="SAF", team="PHI",
             week=1, season_type="REG", def_interceptions=1),
        dict(player_id="S2", player_display_name="S Two", position="SAF", team="PHI",
             week=2, season_type="REG", def_interceptions=0),
        # Postseason row that must not count toward regular-season totals
        dict(player_id="Q1", player_display_name="Q One", position="QB", team="DAL",
             week=19, season_type="POST", passing_yards=999, rushing_yards=0, receiving_yards=0),
    ]
    return pd.DataFrame(rows)
