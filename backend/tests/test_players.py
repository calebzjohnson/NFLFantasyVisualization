import pandas as pd
import pytest

from app.services.players import (
    InvalidQueryError,
    PlayerNotFoundError,
    get_current_player_stats,
    get_player_bio,
    get_player_game_log,
    get_weekly_player_stats,
)


@pytest.fixture
def sample_leaderboard_stats() -> pd.DataFrame:
    """Four players spanning positions, with distinct stat values - built for
    testing sort/limit/fields/position_group, not shared with other tests.
    """
    rows = [
        dict(player_id="Q1", player_display_name="Q One", position="QB", position_group="QB",
             team="DAL", passing_yards=300, rushing_yards=0),
        dict(player_id="Q2", player_display_name="Q Two", position="QB", position_group="QB",
             team="PHI", passing_yards=500, rushing_yards=0),
        dict(player_id="R1", player_display_name="R One", position="RB", position_group="RB",
             team="DAL", passing_yards=0, rushing_yards=800),
        dict(player_id="W1", player_display_name="W One", position="WR", position_group="WR",
             team="PHI", passing_yards=0, rushing_yards=0),
    ]
    return pd.DataFrame(rows)


def test_get_current_player_stats_sorts_descending(
    monkeypatch: pytest.MonkeyPatch, sample_leaderboard_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.player_stats.get_season_stats", lambda season: sample_leaderboard_stats
    )

    records = get_current_player_stats(sort="-passing_yards")

    assert [r["player_id"] for r in records] == ["Q2", "Q1", "R1", "W1"]


def test_get_current_player_stats_sorts_ascending_without_prefix(
    monkeypatch: pytest.MonkeyPatch, sample_leaderboard_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.player_stats.get_season_stats", lambda season: sample_leaderboard_stats
    )

    records = get_current_player_stats(sort="passing_yards")

    assert [r["player_id"] for r in records][:2] == ["R1", "W1"]  # both 0, tied for lowest


def test_get_current_player_stats_applies_limit_after_sort(
    monkeypatch: pytest.MonkeyPatch, sample_leaderboard_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.player_stats.get_season_stats", lambda season: sample_leaderboard_stats
    )

    records = get_current_player_stats(sort="-rushing_yards", limit=1)

    assert [r["player_id"] for r in records] == ["R1"]


def test_get_current_player_stats_filters_by_position_group(
    monkeypatch: pytest.MonkeyPatch, sample_leaderboard_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.player_stats.get_season_stats", lambda season: sample_leaderboard_stats
    )

    records = get_current_player_stats(position_group="QB")

    assert {r["player_id"] for r in records} == {"Q1", "Q2"}


def test_get_current_player_stats_projects_requested_fields_only(
    monkeypatch: pytest.MonkeyPatch, sample_leaderboard_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.player_stats.get_season_stats", lambda season: sample_leaderboard_stats
    )

    records = get_current_player_stats(fields=["player_display_name", "passing_yards"])

    assert all(set(r.keys()) == {"player_display_name", "passing_yards"} for r in records)


def test_get_current_player_stats_rejects_unknown_sort_field(
    monkeypatch: pytest.MonkeyPatch, sample_leaderboard_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.player_stats.get_season_stats", lambda season: sample_leaderboard_stats
    )

    with pytest.raises(InvalidQueryError):
        get_current_player_stats(sort="not_a_real_field")


def test_get_current_player_stats_rejects_unknown_fields(
    monkeypatch: pytest.MonkeyPatch, sample_leaderboard_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.player_stats.get_season_stats", lambda season: sample_leaderboard_stats
    )

    with pytest.raises(InvalidQueryError):
        get_current_player_stats(fields=["not_a_real_field"])


def test_get_current_player_stats_converts_nan_to_none(
    monkeypatch: pytest.MonkeyPatch, sample_season_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.player_stats.get_season_stats", lambda season: sample_season_stats
    )

    records = get_current_player_stats()

    assert len(records) == 2
    qb = next(r for r in records if r["player_id"] == "Q1")
    wr = next(r for r in records if r["player_id"] == "W1")

    assert qb["pacr"] == 1.5
    assert wr["pacr"] is None  # NaN in the source data, not 0 or a string


def test_get_current_player_stats_preserves_real_values(
    monkeypatch: pytest.MonkeyPatch, sample_season_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.player_stats.get_season_stats", lambda season: sample_season_stats
    )

    records = get_current_player_stats()
    qb = next(r for r in records if r["player_id"] == "Q1")

    assert qb["player_display_name"] == "Q One"
    assert qb["position"] == "QB"
    assert qb["passing_yards"] == 2500


def test_get_current_player_stats_falls_back_to_prior_season(
    monkeypatch: pytest.MonkeyPatch, sample_season_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.services.players.nfl.get_current_season", lambda: 2026)

    def fake_get_season_stats(season: int) -> pd.DataFrame:
        return pd.DataFrame() if season == 2026 else sample_season_stats

    monkeypatch.setattr("app.data.player_stats.get_season_stats", fake_get_season_stats)

    records = get_current_player_stats()

    assert len(records) == 2


def test_get_player_game_log_filters_by_player_and_regular_season(
    monkeypatch: pytest.MonkeyPatch, sample_week_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.data.player_stats.get_week_stats", lambda season: sample_week_stats)

    records = get_player_game_log("Q1")

    assert [r["week"] for r in records] == [1, 2, 3]  # sorted, POST week 19 excluded


def test_get_player_game_log_converts_nan_to_none(
    monkeypatch: pytest.MonkeyPatch, sample_week_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.data.player_stats.get_week_stats", lambda season: sample_week_stats)

    records = get_player_game_log("Q1")

    week_2 = next(r for r in records if r["week"] == 2)
    assert week_2["pacr"] is None


def test_get_player_game_log_raises_for_unknown_player(
    monkeypatch: pytest.MonkeyPatch, sample_week_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.data.player_stats.get_week_stats", lambda season: sample_week_stats)

    with pytest.raises(PlayerNotFoundError):
        get_player_game_log("not_a_real_player")


def test_get_player_game_log_falls_back_to_prior_season(
    monkeypatch: pytest.MonkeyPatch, sample_week_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.services.players.nfl.get_current_season", lambda: 2026)

    def fake_get_week_stats(season: int) -> pd.DataFrame:
        return pd.DataFrame() if season == 2026 else sample_week_stats

    monkeypatch.setattr("app.data.player_stats.get_week_stats", fake_get_week_stats)

    records = get_player_game_log("Q1")

    assert len(records) == 3


def test_get_player_bio_returns_matching_player(
    monkeypatch: pytest.MonkeyPatch, sample_players_roster: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.players.get_players", lambda: sample_players_roster
    )

    bio = get_player_bio("Q1")

    assert bio["display_name"] == "Q One"
    assert bio["team"] == "DAL"
    assert bio["height_in"] == 74.0
    assert bio["draft_year"] == 2020.0


def test_get_player_bio_maps_known_status_code(
    monkeypatch: pytest.MonkeyPatch, sample_players_roster: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.players.get_players", lambda: sample_players_roster
    )

    bio = get_player_bio("Q1")

    assert bio["status"] == "Active"  # ACT mapped to a display label


def test_get_player_bio_falls_back_to_raw_status_code(
    monkeypatch: pytest.MonkeyPatch, sample_players_roster: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.players.get_players", lambda: sample_players_roster
    )

    bio = get_player_bio("W1")

    assert bio["status"] == "XYZ"  # unmapped code passed through as-is


def test_get_player_bio_converts_nan_draft_fields_to_none(
    monkeypatch: pytest.MonkeyPatch, sample_players_roster: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.players.get_players", lambda: sample_players_roster
    )

    bio = get_player_bio("W1")

    assert bio["draft_year"] is None
    assert bio["draft_team"] is None


def test_get_player_bio_raises_for_unknown_player(
    monkeypatch: pytest.MonkeyPatch, sample_players_roster: pd.DataFrame
) -> None:
    monkeypatch.setattr(
        "app.data.players.get_players", lambda: sample_players_roster
    )

    with pytest.raises(PlayerNotFoundError):
        get_player_bio("not_a_real_player")


def test_get_weekly_player_stats_filters_position_and_regular_season(
    monkeypatch: pytest.MonkeyPatch, sample_week_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.data.player_stats.get_week_stats", lambda season: sample_week_stats)

    records = get_weekly_player_stats(position_group="QB")

    # Q1's 3 REG games only - W1 (WR) and the POST week 19 game are excluded.
    assert [r["week"] for r in records] == [1, 2, 3]
    assert all(r["player_id"] == "Q1" for r in records)


def test_get_weekly_player_stats_includes_every_player_without_a_position_filter(
    monkeypatch: pytest.MonkeyPatch, sample_week_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.data.player_stats.get_week_stats", lambda season: sample_week_stats)

    records = get_weekly_player_stats()

    assert {r["player_id"] for r in records} == {"Q1", "W1"}


def test_get_weekly_player_stats_rejects_unknown_field(
    monkeypatch: pytest.MonkeyPatch, sample_week_stats: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.data.player_stats.get_week_stats", lambda season: sample_week_stats)

    with pytest.raises(InvalidQueryError):
        get_weekly_player_stats(fields=["not_a_real_field"])
