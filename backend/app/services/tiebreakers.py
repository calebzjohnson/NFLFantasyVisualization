from collections.abc import Callable
from dataclasses import dataclass

import pandas as pd

# nflverse team-level touchdown columns to sum for a team's own touchdowns.
# receiving_tds is deliberately excluded: it's always identical to
# passing_tds (a passing TD is simultaneously credited as a receiving TD to
# the same team), so including both would double-count.
TOUCHDOWN_COLUMNS = [
    "passing_tds",
    "rushing_tds",
    "special_teams_tds",
    "def_tds",
    "fumble_recovery_tds",
    "pt_return_tds",
]


@dataclass
class TiebreakContext:
    game_log: pd.DataFrame  # team, opponent, points_for, points_against, week, win, loss, tie
    team_records: pd.DataFrame  # team, wins, losses, ties, points_for, points_against, win_pct,
    # team_division, team_conf
    weekly_team_stats: pd.DataFrame  # game_id, team, opponent_team, <touchdown columns>


Criterion = Callable[[list[str], TiebreakContext], dict[str, float]]


def _pct(games: pd.DataFrame) -> float:
    """Win percentage over a set of games (ties count as half a win)."""
    n = len(games)
    if n == 0:
        return 0.0
    wins = games["win"].sum()
    ties = games["tie"].sum()
    return float((wins + 0.5 * ties) / n)


def head_to_head(group: list[str], ctx: TiebreakContext) -> dict[str, float]:
    """Win pct in games played among just the teams in `group`."""
    others = set(group)
    result: dict[str, float] = {}
    for team in group:
        team_games = ctx.game_log[ctx.game_log["team"] == team]
        vs_group = team_games[team_games["opponent"].isin(others - {team})]
        result[team] = _pct(vs_group)
    return result


def division_record(group: list[str], ctx: TiebreakContext) -> dict[str, float]:
    """Win pct in games against divisional opponents."""
    division_by_team = ctx.team_records.set_index("team")["team_division"]
    result: dict[str, float] = {}
    for team in group:
        team_games = ctx.game_log[ctx.game_log["team"] == team]
        opponent_division = team_games["opponent"].map(division_by_team)
        result[team] = _pct(team_games[opponent_division == division_by_team[team]])
    return result


def common_games(group: list[str], ctx: TiebreakContext) -> dict[str, float]:
    """Win pct restricted to opponents every team in `group` has played."""
    opponents_by_team = {
        team: set(ctx.game_log.loc[ctx.game_log["team"] == team, "opponent"]) for team in group
    }
    common_opponents = set.intersection(*opponents_by_team.values())
    result: dict[str, float] = {}
    for team in group:
        team_games = ctx.game_log[ctx.game_log["team"] == team]
        result[team] = _pct(team_games[team_games["opponent"].isin(common_opponents)])
    return result


def conference_record(group: list[str], ctx: TiebreakContext) -> dict[str, float]:
    """Win pct in games against conference opponents."""
    conf_by_team = ctx.team_records.set_index("team")["team_conf"]
    result: dict[str, float] = {}
    for team in group:
        team_games = ctx.game_log[ctx.game_log["team"] == team]
        opponent_conf = team_games["opponent"].map(conf_by_team)
        result[team] = _pct(team_games[opponent_conf == conf_by_team[team]])
    return result


def _strength(group: list[str], ctx: TiebreakContext, *, only_wins: bool) -> dict[str, float]:
    records_by_team = ctx.team_records.set_index("team")
    result: dict[str, float] = {}
    for team in group:
        team_games = ctx.game_log[ctx.game_log["team"] == team]
        if only_wins:
            team_games = team_games[team_games["win"]]
        opponent_records = records_by_team.loc[team_games["opponent"]]
        wins = opponent_records["wins"].sum()
        losses = opponent_records["losses"].sum()
        ties = opponent_records["ties"].sum()
        played = wins + losses + ties
        result[team] = float((wins + 0.5 * ties) / played) if played else 0.0
    return result


def strength_of_victory(group: list[str], ctx: TiebreakContext) -> dict[str, float]:
    """Combined win pct of every opponent this team has beaten."""
    return _strength(group, ctx, only_wins=True)


def strength_of_schedule(group: list[str], ctx: TiebreakContext) -> dict[str, float]:
    """Combined win pct of every opponent this team has played."""
    return _strength(group, ctx, only_wins=False)


def _combined_point_rank(records: pd.DataFrame, group: list[str]) -> dict[str, float]:
    # Lower combined rank is better, so negate: resolve_tie treats a higher
    # score as better, consistent with every other criterion.
    pf_rank = records["points_for"].rank(method="min", ascending=False)
    pa_rank = records["points_against"].rank(method="min", ascending=True)
    combined = pf_rank + pa_rank
    return {team: -float(combined[team]) for team in group if team in combined.index}


def combined_rank_conference(group: list[str], ctx: TiebreakContext) -> dict[str, float]:
    records = ctx.team_records.set_index("team")
    conf = records.loc[group[0], "team_conf"]
    conf_records = records[records["team_conf"] == conf]
    return _combined_point_rank(conf_records, group)


def combined_rank_league(group: list[str], ctx: TiebreakContext) -> dict[str, float]:
    records = ctx.team_records.set_index("team")
    return _combined_point_rank(records, group)


def net_points_common(group: list[str], ctx: TiebreakContext) -> dict[str, float]:
    opponents_by_team = {
        team: set(ctx.game_log.loc[ctx.game_log["team"] == team, "opponent"]) for team in group
    }
    common_opponents = set.intersection(*opponents_by_team.values())
    result: dict[str, float] = {}
    for team in group:
        team_games = ctx.game_log[ctx.game_log["team"] == team]
        common = team_games[team_games["opponent"].isin(common_opponents)]
        result[team] = float((common["points_for"] - common["points_against"]).sum())
    return result


def net_points_all(group: list[str], ctx: TiebreakContext) -> dict[str, float]:
    records = ctx.team_records.set_index("team")
    net_points = records["points_for"] - records["points_against"]
    return {team: float(net_points[team]) for team in group}


def net_touchdowns(group: list[str], ctx: TiebreakContext) -> dict[str, float]:
    stats = ctx.weekly_team_stats.copy()
    stats["own_tds"] = stats[TOUCHDOWN_COLUMNS].sum(axis=1)

    # Each game has two rows (one per team); relabel one team's row as its
    # opponent's "tds_allowed" so a join on (game_id, opponent_team) pairs
    # each team's game with the touchdowns scored against them in it.
    opponent_tds = stats[["game_id", "team", "own_tds"]].rename(
        columns={"team": "opponent_team", "own_tds": "tds_allowed"}
    )
    merged = stats.merge(opponent_tds, on=["game_id", "opponent_team"], how="inner")
    merged["net_tds"] = merged["own_tds"] - merged["tds_allowed"]

    totals = merged.groupby("team")["net_tds"].sum()
    return {team: float(totals.get(team, 0.0)) for team in group}


# Applied in order; a step is skipped over (moves to the next) whenever it
# still leaves every team in the group exactly tied.
CRITERIA: list[Criterion] = [
    head_to_head,
    division_record,
    common_games,
    conference_record,
    strength_of_victory,
    strength_of_schedule,
    combined_rank_conference,
    combined_rank_league,
    net_points_common,
    net_points_all,
    net_touchdowns,
]


def resolve_tie(group: list[str], ctx: TiebreakContext) -> list[list[str]]:
    """Orders a group of teams tied on win_pct using the NFL's official
    division-tiebreaker procedure. Returns rank-ordered buckets (best first);
    a bucket has more than one team only if every criterion above ties all
    of them (there is no coin-toss fallback - an unresolved tie is reported
    as still tied rather than given a fabricated order).
    """
    if len(group) <= 1:
        return [list(group)]

    for criterion in CRITERIA:
        scores = criterion(group, ctx)
        tiers = _group_by_score_desc(group, scores)
        if len(tiers) > 1:
            resolved: list[list[str]] = []
            for tier in tiers:
                resolved.extend(resolve_tie(tier, ctx))
            return resolved

    return [list(group)]


def _group_by_score_desc(group: list[str], scores: dict[str, float]) -> list[list[str]]:
    distinct_scores = sorted({scores[team] for team in group}, reverse=True)
    return [[team for team in group if scores[team] == score] for score in distinct_scores]
