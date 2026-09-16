import pandas as pd
import pytest

from app.services.leaders import get_current_leaders


def test_get_current_leaders_ranks_by_total_across_weeks(
    monkeypatch: pytest.MonkeyPatch, sample_weekly_data: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.data.weekly.get_weekly_data", lambda season: sample_weekly_data)

    categories = get_current_leaders(limit=5)

    assert [c.position for c in categories] == ["QB", "RB", "WR", "TE", "DL", "LB", "CB", "S"]

    qb = next(c for c in categories if c.position == "QB")
    assert qb.metric == "Passing Yards"
    assert qb.unit == "yds"
    assert [row.player for row in qb.rows] == ["Q One", "Q Two"]
    assert qb.rows[0].value == 550
    assert qb.rows[0].team == "DAL"


def test_get_current_leaders_ranks_rb_by_total_not_week_one(
    monkeypatch: pytest.MonkeyPatch, sample_weekly_data: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.data.weekly.get_weekly_data", lambda season: sample_weekly_data)

    categories = get_current_leaders(limit=5)
    rb = next(c for c in categories if c.position == "RB")

    # R2 (90+95=185) outranks R1 (100+80=180) despite a lower week-1 total.
    assert [row.player for row in rb.rows[:2]] == ["R Two", "R One"]


def test_get_current_leaders_uses_most_recent_team_for_traded_player(
    monkeypatch: pytest.MonkeyPatch, sample_weekly_data: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.data.weekly.get_weekly_data", lambda season: sample_weekly_data)

    categories = get_current_leaders(limit=5)
    rb = next(c for c in categories if c.position == "RB")
    r3 = next(row for row in rb.rows if row.player == "R Three")

    assert r3.team == "PHI"  # traded from DAL (week 1) to PHI (week 2)
    assert r3.value == 15  # 10 + 5 across both teams


def test_get_current_leaders_excludes_postseason(
    monkeypatch: pytest.MonkeyPatch, sample_weekly_data: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.data.weekly.get_weekly_data", lambda season: sample_weekly_data)

    categories = get_current_leaders(limit=5)
    qb = next(c for c in categories if c.position == "QB")
    q1 = next(row for row in qb.rows if row.player == "Q One")

    assert q1.value == 550  # not 1549, which would include the POST row


def test_get_current_leaders_dl_ranks_by_sacks(
    monkeypatch: pytest.MonkeyPatch, sample_weekly_data: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.data.weekly.get_weekly_data", lambda season: sample_weekly_data)

    categories = get_current_leaders(limit=5)
    dl = next(c for c in categories if c.position == "DL")

    assert dl.metric == "Sacks"
    assert dl.unit == "sacks"
    # D1 (DE, 2.0+1.5=3.5) outranks D2 (DT, 1.0+1.0=2.0)
    assert [row.player for row in dl.rows] == ["D One", "D Two"]
    assert dl.rows[0].value == 3.5


def test_get_current_leaders_lb_combines_solo_and_assist_tackles(
    monkeypatch: pytest.MonkeyPatch, sample_weekly_data: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.data.weekly.get_weekly_data", lambda season: sample_weekly_data)

    categories = get_current_leaders(limit=5)
    lb = next(c for c in categories if c.position == "LB")

    assert lb.metric == "Tackles"
    # L1 (MLB, 5+2 + 4+1 = 12) outranks L2 (OLB, 3+3 + 4+0 = 10)
    assert [row.player for row in lb.rows] == ["L One", "L Two"]
    assert lb.rows[0].value == 12
    assert lb.rows[1].value == 10


def test_get_current_leaders_cb_and_safety_are_separate_categories(
    monkeypatch: pytest.MonkeyPatch, sample_weekly_data: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.data.weekly.get_weekly_data", lambda season: sample_weekly_data)

    categories = get_current_leaders(limit=5)
    cb = next(c for c in categories if c.position == "CB")
    s = next(c for c in categories if c.position == "S")

    assert cb.metric == s.metric == "Interceptions"
    assert [row.player for row in cb.rows] == ["C One", "C Two"]
    assert cb.rows[0].value == 2

    # S combines position codes "S" and "SAF"; S One (position "S") outranks
    # S Two (position "SAF") despite the different raw position codes.
    assert [row.player for row in s.rows] == ["S One", "S Two"]
    assert s.rows[0].value == 2


def test_get_current_leaders_respects_limit(
    monkeypatch: pytest.MonkeyPatch, sample_weekly_data: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.data.weekly.get_weekly_data", lambda season: sample_weekly_data)

    categories = get_current_leaders(limit=1)
    assert all(len(c.rows) <= 1 for c in categories)
