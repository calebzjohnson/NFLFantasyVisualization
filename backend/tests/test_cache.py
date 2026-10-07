import threading
import time
from typing import Any

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app import cache
from app.cache import memoized, single_flight
from app.main import app

client = TestClient(app)


def test_hit_returns_identical_result_without_recomputing() -> None:
    calls: list[str] = []

    @memoized
    def compute(fields: list[str] | None = None) -> dict[str, Any]:
        calls.append("x")
        return {"fields": fields}

    first = compute(fields=["a", "b"])
    second = compute(fields=["a", "b"])  # a fresh but equal list must still hit

    assert second is first
    assert len(calls) == 1


def test_distinct_params_get_distinct_entries() -> None:
    calls: list[str | None] = []

    @memoized
    def compute(position: str | None = None) -> str | None:
        calls.append(position)
        return position

    assert compute(position="QB") == "QB"
    assert compute(position="WR") == "WR"
    assert compute(position="QB") == "QB"
    assert calls == ["QB", "WR"]


def test_ttl_expiry_recomputes(monkeypatch: pytest.MonkeyPatch) -> None:
    now = [1000.0]
    monkeypatch.setattr(cache.time, "monotonic", lambda: now[0])
    calls: list[int] = []

    @memoized
    def compute() -> int:
        calls.append(1)
        return len(calls)

    assert compute() == 1
    now[0] += cache._settings.cache_ttl_seconds - 1
    assert compute() == 1
    now[0] += 2
    assert compute() == 2


def test_least_recently_used_entry_is_evicted(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(cache._settings, "cache_max_entries", 2)
    calls: list[int] = []

    @memoized
    def compute(n: int) -> int:
        calls.append(n)
        return n

    compute(1)
    compute(2)
    compute(1)  # 2 is now least recently used
    compute(3)  # evicts 2
    compute(1)
    compute(2)
    assert calls == [1, 2, 3, 2]


def test_exceptions_are_not_cached() -> None:
    calls: list[int] = []

    @memoized
    def compute() -> int:
        calls.append(1)
        if len(calls) == 1:
            raise ValueError("boom")
        return 7

    with pytest.raises(ValueError):
        compute()
    assert compute() == 7


def test_concurrent_misses_compute_once() -> None:
    calls: list[int] = []

    @memoized
    def compute() -> int:
        calls.append(1)
        time.sleep(0.05)
        return 42

    results: list[int] = []
    threads = [threading.Thread(target=lambda: results.append(compute())) for _ in range(5)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert results == [42] * 5
    assert len(calls) == 1


def test_single_flight_never_runs_a_loader_concurrently() -> None:
    running = 0
    peak = 0
    lock = threading.Lock()

    @single_flight
    def load() -> None:
        nonlocal running, peak
        with lock:
            running += 1
            peak = max(peak, running)
        time.sleep(0.02)
        with lock:
            running -= 1

    threads = [threading.Thread(target=load) for _ in range(4)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert peak == 1


def test_endpoint_reuses_cached_result(
    monkeypatch: pytest.MonkeyPatch, sample_pbp: pd.DataFrame
) -> None:
    loads: list[int] = []

    def load_pbp(season: int) -> pd.DataFrame:
        loads.append(season)
        return sample_pbp

    monkeypatch.setattr("app.services.team_efficiency.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.pbp.get_season_pbp", load_pbp)

    first = client.get("/teams/efficiency")
    second = client.get("/teams/efficiency")

    assert first.status_code == second.status_code == 200
    assert second.json() == first.json()
    assert loads == [2026]


def test_data_responses_carry_cache_control(
    monkeypatch: pytest.MonkeyPatch, sample_pbp: pd.DataFrame
) -> None:
    monkeypatch.setattr("app.services.team_efficiency.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.pbp.get_season_pbp", lambda season: sample_pbp)

    response = client.get("/teams/efficiency")

    age = cache._settings.http_cache_max_age
    assert response.headers["Cache-Control"] == (
        f"public, max-age={age}, stale-while-revalidate={age}"
    )


def test_errors_and_health_are_not_marked_cacheable() -> None:
    bad_position = client.get("/players/radar-pool?position=XX")

    assert bad_position.status_code == 400
    assert "Cache-Control" not in bad_position.headers
    assert "Cache-Control" not in client.get("/health").headers
