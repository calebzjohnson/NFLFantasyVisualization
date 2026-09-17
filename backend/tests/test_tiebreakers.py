import pandas as pd

from app.services.tiebreakers import (
    TiebreakContext,
    combined_rank_conference,
    common_games,
    conference_record,
    division_record,
    head_to_head,
    net_points_all,
    net_points_common,
    net_touchdowns,
    resolve_tie,
    strength_of_schedule,
    strength_of_victory,
)


def _game_log(rows: list[tuple[str, str, float, float]]) -> pd.DataFrame:
    df = pd.DataFrame(rows, columns=["team", "opponent", "points_for", "points_against"])
    df["win"] = df["points_for"] > df["points_against"]
    df["loss"] = df["points_for"] < df["points_against"]
    df["tie"] = df["points_for"] == df["points_against"]
    return df


def _records(rows: list[dict[str, object]]) -> pd.DataFrame:
    return pd.DataFrame(rows)


def _ctx(
    game_log: pd.DataFrame,
    team_records: pd.DataFrame,
    weekly_team_stats: pd.DataFrame | None = None,
) -> TiebreakContext:
    if weekly_team_stats is None:
        weekly_team_stats = pd.DataFrame(
            columns=[
                "game_id", "team", "opponent_team", "passing_tds", "rushing_tds",
                "special_teams_tds", "def_tds", "fumble_recovery_tds", "pt_return_tds",
            ]
        )
    return TiebreakContext(
        game_log=game_log, team_records=team_records, weekly_team_stats=weekly_team_stats
    )


def test_head_to_head_picks_the_winner() -> None:
    game_log = _game_log([("A", "B", 20, 10), ("B", "A", 10, 20)])
    result = head_to_head(["A", "B"], _ctx(game_log, _records([])))
    assert result == {"A": 1.0, "B": 0.0}


def test_division_record_ignores_out_of_division_games() -> None:
    # A lost its only game, but it was out-of-division, so its division
    # record is a clean slate (0 games -> 0.0), not a loss.
    game_log = _game_log([("A", "C", 10, 20), ("B", "D", 20, 10)])
    records = _records(
        [
            {"team": "A", "team_division": "AFC East"},
            {"team": "B", "team_division": "AFC East"},
            {"team": "C", "team_division": "AFC North"},
            {"team": "D", "team_division": "AFC East"},
        ]
    )
    result = division_record(["A", "B"], _ctx(game_log, records))
    assert result == {"A": 0.0, "B": 1.0}


def test_common_games_ignores_non_shared_opponents() -> None:
    # A beat their common opponent (Y); B lost to it. A's other win (over X,
    # not common) and B's other win (over Z, not common) must not count.
    game_log = _game_log(
        [("A", "Y", 20, 10), ("A", "X", 5, 15), ("B", "Y", 10, 20), ("B", "Z", 30, 0)]
    )
    result = common_games(["A", "B"], _ctx(game_log, _records([])))
    assert result == {"A": 1.0, "B": 0.0}


def test_conference_record_ignores_out_of_conference_games() -> None:
    game_log = _game_log([("A", "C", 10, 20), ("B", "D", 20, 10)])
    records = _records(
        [
            {"team": "A", "team_conf": "AFC"},
            {"team": "B", "team_conf": "AFC"},
            {"team": "C", "team_conf": "NFC"},
            {"team": "D", "team_conf": "AFC"},
        ]
    )
    result = conference_record(["A", "B"], _ctx(game_log, records))
    assert result == {"A": 0.0, "B": 1.0}


def test_strength_of_victory_only_counts_beaten_opponents() -> None:
    # A beat W (a strong 3-1 team) and lost to L (a winless 0-4 team).
    game_log = _game_log([("A", "W", 20, 10), ("A", "L", 10, 20)])
    records = _records(
        [
            {"team": "W", "wins": 3, "losses": 1, "ties": 0},
            {"team": "L", "wins": 0, "losses": 4, "ties": 0},
        ]
    )
    sov = strength_of_victory(["A"], _ctx(game_log, records))
    sos = strength_of_schedule(["A"], _ctx(game_log, records))

    assert sov["A"] == 0.75  # only W (3-1, .750) counted; L (the loss) excluded
    assert sos["A"] == 3 / 8  # W (3-1) + L (0-4) combined: 3 wins / 8 games


def test_combined_rank_conference_uses_min_rank_for_ties() -> None:
    # Q and R are tied on points_for (30 each); points_against breaks it.
    records = _records(
        [
            {"team": "P", "team_conf": "AFC", "points_for": 40, "points_against": 10},
            {"team": "Q", "team_conf": "AFC", "points_for": 30, "points_against": 20},
            {"team": "R", "team_conf": "AFC", "points_for": 30, "points_against": 15},
            {"team": "S", "team_conf": "AFC", "points_for": 10, "points_against": 30},
        ]
    )
    result = combined_rank_conference(["Q", "R"], _ctx(_game_log([]), records))
    assert result["R"] > result["Q"]  # R's better points_against wins the tie


def test_net_points_common_vs_net_points_all_differ() -> None:
    # Common opponent is Y. A won the common game but lost badly elsewhere;
    # B lost the common game but won big elsewhere. Common-games and
    # all-games net points should disagree about who's ahead.
    game_log = _game_log(
        [("A", "Y", 20, 10), ("A", "X", 5, 15), ("B", "Y", 10, 20), ("B", "Z", 30, 0)]
    )
    records = _records(
        [
            {"team": "A", "points_for": 25, "points_against": 25},
            {"team": "B", "points_for": 40, "points_against": 20},
        ]
    )
    ctx = _ctx(game_log, records)

    common = net_points_common(["A", "B"], ctx)
    overall = net_points_all(["A", "B"], ctx)

    assert common == {"A": 10, "B": -10}
    assert overall == {"A": 0, "B": 20}


def test_net_touchdowns_excludes_receiving_tds_and_sums_across_games() -> None:
    weekly_stats = pd.DataFrame(
        [
            # Game 1: A scores 3 TDs (2 passing + 1 rushing; receiving_tds
            # mirrors passing_tds and must not be double-counted), B scores 1.
            dict(game_id="G1", team="A", opponent_team="B", passing_tds=2, rushing_tds=1,
                 receiving_tds=2, special_teams_tds=0, def_tds=0, fumble_recovery_tds=0,
                 pt_return_tds=0),
            dict(game_id="G1", team="B", opponent_team="A", passing_tds=1, rushing_tds=0,
                 receiving_tds=1, special_teams_tds=0, def_tds=0, fumble_recovery_tds=0,
                 pt_return_tds=0),
            # Game 2: A scores 1, C scores 2.
            dict(game_id="G2", team="A", opponent_team="C", passing_tds=0, rushing_tds=1,
                 receiving_tds=0, special_teams_tds=0, def_tds=0, fumble_recovery_tds=0,
                 pt_return_tds=0),
            dict(game_id="G2", team="C", opponent_team="A", passing_tds=2, rushing_tds=0,
                 receiving_tds=2, special_teams_tds=0, def_tds=0, fumble_recovery_tds=0,
                 pt_return_tds=0),
        ]
    )
    result = net_touchdowns(["A"], _ctx(_game_log([]), _records([]), weekly_stats))
    # Game 1: 3 - 1 = +2. Game 2: 1 - 2 = -1. Season total: +1.
    assert result == {"A": 1.0}


def test_resolve_tie_two_teams_settled_by_head_to_head() -> None:
    game_log = _game_log([("A", "B", 20, 10), ("B", "A", 10, 20)])
    records = _records(
        [
            {"team": "A", "team_division": "X", "team_conf": "AFC", "wins": 0, "losses": 0,
             "ties": 0, "points_for": 0, "points_against": 0},
            {"team": "B", "team_division": "X", "team_conf": "AFC", "wins": 0, "losses": 0,
             "ties": 0, "points_for": 0, "points_against": 0},
        ]
    )
    result = resolve_tie(["A", "B"], _ctx(game_log, records))
    assert result == [["A"], ["B"]]


def test_resolve_tie_falls_through_to_division_record_when_head_to_head_ties() -> None:
    # A and B never played each other, so head-to-head can't distinguish
    # them; division record (A wins its division game, B loses its) should.
    game_log = _game_log([("A", "C", 20, 10), ("B", "D", 10, 20)])
    records = _records(
        [
            {"team": "A", "team_division": "X", "team_conf": "AFC", "wins": 0, "losses": 0,
             "ties": 0, "points_for": 0, "points_against": 0},
            {"team": "B", "team_division": "X", "team_conf": "AFC", "wins": 0, "losses": 0,
             "ties": 0, "points_for": 0, "points_against": 0},
            {"team": "C", "team_division": "X", "team_conf": "AFC", "wins": 0, "losses": 0,
             "ties": 0, "points_for": 0, "points_against": 0},
            {"team": "D", "team_division": "X", "team_conf": "AFC", "wins": 0, "losses": 0,
             "ties": 0, "points_for": 0, "points_against": 0},
        ]
    )
    result = resolve_tie(["A", "B"], _ctx(game_log, records))
    assert result == [["A"], ["B"]]


def test_resolve_tie_restarts_at_step_one_for_a_reduced_subgroup() -> None:
    # A beats both B and C (splits the 3-way tie into A vs {B, C}). B and C
    # never played each other, so head-to-head - retried from scratch for
    # just the {B, C} subgroup - ties again; division record then splits them.
    game_log = _game_log(
        [
            ("A", "B", 20, 10), ("B", "A", 10, 20),
            ("A", "C", 20, 10), ("C", "A", 10, 20),
            ("B", "X", 20, 10),  # B's division win
            ("C", "Y", 10, 20),  # C's division loss
        ]
    )
    records = _records(
        [
            {"team": t, "team_division": "AFC East" if t != "Y" else "AFC East",
             "team_conf": "AFC", "wins": 0, "losses": 0, "ties": 0, "points_for": 0,
             "points_against": 0}
            for t in ["A", "B", "C", "X", "Y"]
        ]
    )
    result = resolve_tie(["A", "B", "C"], _ctx(game_log, records))
    assert result == [["A"], ["B"], ["C"]]


def test_resolve_tie_leaves_teams_grouped_when_every_criterion_ties() -> None:
    # No games, no stats, identical in every respect - nothing can split them.
    records = _records(
        [
            {"team": "A", "team_division": "X", "team_conf": "AFC", "wins": 0, "losses": 0,
             "ties": 0, "points_for": 0, "points_against": 0},
            {"team": "B", "team_division": "X", "team_conf": "AFC", "wins": 0, "losses": 0,
             "ties": 0, "points_for": 0, "points_against": 0},
        ]
    )
    result = resolve_tie(["A", "B"], _ctx(_game_log([]), records))
    assert result == [["A", "B"]]
