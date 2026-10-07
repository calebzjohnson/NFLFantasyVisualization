"""Server-side caching for the nflverse data path.

nflreadpy only caches raw downloads; converting them to pandas and running the
aggregations happens on every call. `memoized` caches each endpoint's computed
result, and `single_flight` stops concurrent callers from each re-downloading a
dataset when nflreadpy's cached copy expires.
"""

import threading
import time
from collections import OrderedDict
from collections.abc import Callable, Hashable
from functools import wraps
from typing import Any

from app.config import get_settings

_settings = get_settings()
# Shared by every memoized function: a burst of cache misses across endpoints
# queues here instead of exhausting CPU and memory together.
_compute_slots = threading.Semaphore(_settings.max_concurrent_computations)
_caches: list[OrderedDict[Hashable, Any]] = []


def _freeze(value: object) -> object:
    return tuple(value) if isinstance(value, list) else value


def _key(args: tuple[object, ...], kwargs: dict[str, object]) -> Hashable:
    return (
        tuple(_freeze(arg) for arg in args),
        tuple(sorted((name, _freeze(value)) for name, value in kwargs.items())),
    )


def memoized[**P, R](fn: Callable[P, R]) -> Callable[P, R]:
    """Caches fn's result per argument set for `cache_ttl_seconds`, keeping at
    most `cache_max_entries` (least recently used evicted first). Concurrent
    misses on the same arguments compute once; the rest wait for that result.
    Exceptions aren't cached. Callers share the returned object, so it must not
    be mutated.
    """
    entries: OrderedDict[Hashable, tuple[float, R]] = OrderedDict()
    _caches.append(entries)
    guard = threading.Lock()
    inflight: dict[Hashable, threading.Lock] = {}

    def fresh(key: Hashable) -> tuple[float, R] | None:
        hit = entries.get(key)
        if hit is None or hit[0] <= time.monotonic():
            return None
        entries.move_to_end(key)
        return hit

    @wraps(fn)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        key = _key(args, kwargs)
        with guard:
            if hit := fresh(key):
                return hit[1]
            key_lock = inflight.setdefault(key, threading.Lock())

        with key_lock:
            # Another request may have filled it while this one waited.
            with guard:
                if hit := fresh(key):
                    return hit[1]
            try:
                with _compute_slots:
                    value = fn(*args, **kwargs)
                with guard:
                    entries[key] = (time.monotonic() + _settings.cache_ttl_seconds, value)
                    entries.move_to_end(key)
                    while len(entries) > _settings.cache_max_entries:
                        entries.popitem(last=False)
            finally:
                with guard:
                    inflight.pop(key, None)
        return value

    return wrapper


def single_flight[**P, R](fn: Callable[P, R]) -> Callable[P, R]:
    """Serializes calls to an nflreadpy loader, so when its cached download
    expires one caller re-downloads and the rest wait, then read nflreadpy's
    refreshed cache instead of each fetching (and holding) another copy.
    """
    # ponytail: one lock per loader, not per season/stat type; key the lock by
    # arguments if different seasons ever need to load concurrently.
    lock = threading.Lock()

    @wraps(fn)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        with lock:
            return fn(*args, **kwargs)

    return wrapper


def clear_caches() -> None:
    """Empties every memoized function's cache (tests)."""
    for entries in _caches:
        entries.clear()
