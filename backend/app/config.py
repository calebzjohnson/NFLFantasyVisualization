from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])

    # Computed endpoint results are memoized this long. Kept short because it
    # stacks on nflreadpy's own 24h download cache underneath, and recomputing
    # from that in-memory copy doesn't re-download anything.
    cache_ttl_seconds: int = 3_600
    # Per endpoint, so unique query strings can't grow memory without bound or
    # evict another endpoint's entries.
    cache_max_entries: int = 128
    # Cache-miss computations allowed at once; more queue instead of each
    # loading play-by-play into memory together.
    max_concurrent_computations: int = 2
    # Browser/CDN Cache-Control max-age (and stale-while-revalidate) on data GETs.
    http_cache_max_age: int = 3_600

    # Per-client-IP limits, in `limits` notation. "heavy" covers the endpoints
    # that aggregate play-by-play or every player-week.
    rate_limit_default: str = "120/minute"
    rate_limit_heavy: str = "30/minute"
    # Proxies in front of the app that append to X-Forwarded-For. The client IP
    # is read this many entries from the right; anything further left is
    # client-supplied and spoofable. Render's proxy appends one entry. 0 uses
    # the socket peer address (no proxy).
    trusted_proxy_hops: int = 1

    model_config = {"env_prefix": "APP_"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
