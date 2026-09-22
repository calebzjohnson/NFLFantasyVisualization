import pandas as pd
import pytest

from app.services.team_efficiency import get_current_team_efficiency


def test_get_current_team_efficiency_computes_offense_and_defense(
    monkeypatch: pytest.MonkeyPatch, sample_pbp: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.services.team_efficiency.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.pbp.get_season_pbp", lambda season: sample_pbp)

    teams = {t["team"]: t for t in get_current_team_efficiency()}

    assert teams["A"]["offensive_epa_per_play"] == pytest.approx(0.25)
    assert teams["A"]["offensive_plays"] == 2
    assert teams["A"]["defensive_epa_per_play"] == pytest.approx(0.3)
    assert teams["A"]["defensive_plays"] == 2

    assert teams["B"]["offensive_epa_per_play"] == pytest.approx(0.3)
    assert teams["B"]["defensive_epa_per_play"] == pytest.approx(0.25)


def test_get_current_team_efficiency_excludes_non_scrimmage_postseason_and_null_epa(
    monkeypatch: pytest.MonkeyPatch, sample_pbp: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.services.team_efficiency.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.pbp.get_season_pbp", lambda season: sample_pbp)

    teams = {t["team"]: t for t in get_current_team_efficiency()}

    # A's offense excludes the postseason play (epa 5.0) and the null-EPA play;
    # B's excludes the punt (epa -2.0). If any leaked in, these counts and
    # averages would differ from the exact values asserted above.
    assert teams["A"]["offensive_plays"] == 2
    assert teams["B"]["offensive_plays"] == 2


def test_get_current_team_efficiency_falls_back_when_no_plays_yet(
    monkeypatch: pytest.MonkeyPatch, sample_pbp: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.services.team_efficiency.nfl.get_current_season", lambda: 2027)

    def fake_get_season_pbp(season: int) -> pd.DataFrame:
        if season == 2027:
            return pd.DataFrame(columns=sample_pbp.columns)
        return sample_pbp

    monkeypatch.setattr("app.data.pbp.get_season_pbp", fake_get_season_pbp)

    teams = {t["team"]: t for t in get_current_team_efficiency()}

    assert set(teams) == {"A", "B"}
