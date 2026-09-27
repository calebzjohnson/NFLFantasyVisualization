import pandas as pd
import pytest

from app.services.radar import _passer_rating, _position_bucket, _with_percentiles


def test_passer_rating_matches_the_nfl_formula() -> None:
    # 20/30, 250 yds, 2 TD, 1 INT: (1.833 + 1.333 + 1.333 + 1.542) / 6 * 100.
    rating = _passer_rating(
        pd.Series([20]), pd.Series([30]), pd.Series([250]), pd.Series([2]), pd.Series([1])
    )
    assert rating.iloc[0] == pytest.approx(100.69, abs=0.01)


def test_passer_rating_is_null_with_no_targets() -> None:
    rating = _passer_rating(*(pd.Series([0]) for _ in range(5)))
    assert pd.isna(rating.iloc[0])


def test_with_percentiles_ranks_lower_is_better_axes_in_reverse() -> None:
    pool = pd.DataFrame({"missed_tackle_pct": [5.0, 20.0], "pressure_rate": [5.0, 20.0]})
    axes = [("missed_tackle_pct", ""), ("pressure_rate", "")]

    ranked = _with_percentiles(pool, axes)

    # The player missing fewer tackles ranks higher; more pressures ranks higher.
    assert ranked["missed_tackle_pct_percentile"].tolist() == [100.0, 50.0]
    assert ranked["pressure_rate_percentile"].tolist() == [50.0, 100.0]


@pytest.mark.parametrize(
    ("group", "bucket"),
    [("DL", "DL"), ("LB", "LB"), ("DB", "DB"), ("FB", "RB"), ("OL", None), ("SPEC", None)],
)
def test_position_bucket_covers_defense_but_not_line_or_specialists(
    group: str, bucket: str | None
) -> None:
    assert _position_bucket(group) == bucket
