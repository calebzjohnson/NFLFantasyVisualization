import pandas as pd
import pytest

from app.services.scoring_composition import TeamNotFoundError, get_team_scoring_composition


@pytest.fixture
def sample_team_week_stats() -> pd.DataFrame:
    """Two regular-season games for team A (against B, then C), plus a
    postseason game (excluded) and a game between two other teams entirely
    (irrelevant to A either way).

    A's offense across its 2 games: 3 passing TDs, 1 rushing TD, 1 punt
    return TD, 2 FGs made, 4 PATs made, 1 rushing 2pt conversion.
    -> passing: 3*6=18, rushing: 1*6 + 1*2=8, defense_st: 1*6=6, kicking:
    2*3 + 4*1=10. Total 42.

    A's defense allows (B and C's own rows in those same 2 games): 2 passing
    TDs, 2 rushing TDs, 1 defensive TD (a pick-six against A), 3 FGs made,
    3 PATs made.
    -> passing: 2*6=12, rushing: 2*6=12, defense_st: 1*6=6, kicking:
    3*3+3*1=12. Total 42.
    """
    rows = [
        # Game 1: A vs B
        dict(season_type="REG", game_id="G1", team="A", opponent_team="B",
             passing_tds=2, rushing_tds=1, special_teams_tds=1, def_tds=0,
             fumble_recovery_tds=0, fg_made=1, pat_made=2,
             passing_2pt_conversions=0, rushing_2pt_conversions=1,
             def_2pt_made=0, def_safeties=0),
        dict(season_type="REG", game_id="G1", team="B", opponent_team="A",
             passing_tds=1, rushing_tds=1, special_teams_tds=0, def_tds=1,
             fumble_recovery_tds=0, fg_made=2, pat_made=1,
             passing_2pt_conversions=0, rushing_2pt_conversions=0,
             def_2pt_made=0, def_safeties=0),
        # Game 2: A vs C
        dict(season_type="REG", game_id="G2", team="A", opponent_team="C",
             passing_tds=1, rushing_tds=0, special_teams_tds=0, def_tds=0,
             fumble_recovery_tds=0, fg_made=1, pat_made=2,
             passing_2pt_conversions=0, rushing_2pt_conversions=0,
             def_2pt_made=0, def_safeties=0),
        dict(season_type="REG", game_id="G2", team="C", opponent_team="A",
             passing_tds=1, rushing_tds=1, special_teams_tds=0, def_tds=0,
             fumble_recovery_tds=0, fg_made=1, pat_made=2,
             passing_2pt_conversions=0, rushing_2pt_conversions=0,
             def_2pt_made=0, def_safeties=0),
        # Postseason game for A - excluded
        dict(season_type="POST", game_id="G3", team="A", opponent_team="D",
             passing_tds=5, rushing_tds=5, special_teams_tds=5, def_tds=5,
             fumble_recovery_tds=5, fg_made=5, pat_made=5,
             passing_2pt_conversions=5, rushing_2pt_conversions=5,
             def_2pt_made=5, def_safeties=5),
        # A game between two unrelated teams - excluded
        dict(season_type="REG", game_id="G4", team="E", opponent_team="F",
             passing_tds=9, rushing_tds=9, special_teams_tds=9, def_tds=9,
             fumble_recovery_tds=9, fg_made=9, pat_made=9,
             passing_2pt_conversions=9, rushing_2pt_conversions=9,
             def_2pt_made=9, def_safeties=9),
    ]
    return pd.DataFrame(rows)


def test_get_team_scoring_composition_computes_offense_and_defense(
    monkeypatch: pytest.MonkeyPatch, sample_team_week_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.services.scoring_composition.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr(
        "app.data.team_stats.get_weekly_team_stats", lambda season: sample_team_week_stats
    )

    result = get_team_scoring_composition("A")

    offense = {c["key"]: c["points"] for c in result["offense"]["categories"]}
    assert offense == {"passing": 18, "rushing": 8, "defense_st": 6, "kicking": 10}
    assert result["offense"]["total_points"] == 42

    defense = {c["key"]: c["points"] for c in result["defense"]["categories"]}
    assert defense == {"passing": 12, "rushing": 12, "defense_st": 6, "kicking": 12}
    assert result["defense"]["total_points"] == 42


def test_get_team_scoring_composition_raises_for_unknown_team(
    monkeypatch: pytest.MonkeyPatch, sample_team_week_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.services.scoring_composition.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr(
        "app.data.team_stats.get_weekly_team_stats", lambda season: sample_team_week_stats
    )

    with pytest.raises(TeamNotFoundError):
        get_team_scoring_composition("ZZ")
