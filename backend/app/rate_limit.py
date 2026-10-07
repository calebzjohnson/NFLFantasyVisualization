"""Per-client-IP rate limiting (slowapi), keyed on the proxy-reported client IP."""

import math
import time

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import get_settings

settings = get_settings()


def client_ip(request: Request) -> str:
    """The IP `trusted_proxy_hops` entries from the right of X-Forwarded-For.

    Render appends the address it saw to whatever X-Forwarded-For the client
    sent, so entries left of the ones our proxies added are attacker-controlled
    and must not key the limit.
    """
    forwarded = [
        ip.strip()
        for header in request.headers.getlist("x-forwarded-for")
        for ip in header.split(",")
        if ip.strip()
    ]
    hops = settings.trusted_proxy_hops
    if hops and len(forwarded) >= hops:
        return forwarded[-hops]
    return get_remote_address(request)


limiter = Limiter(key_func=client_ip, default_limits=[settings.rate_limit_default])
heavy_limit = limiter.limit(settings.rate_limit_heavy)


def rate_limit_exceeded(request: Request, exc: Exception) -> Response:
    """429 with Retry-After: seconds until the exceeded window resets."""
    limit, args = request.state.view_rate_limit
    reset_at, _ = limiter.limiter.get_window_stats(limit, *args)
    detail = exc.detail if isinstance(exc, RateLimitExceeded) else "rate limit"
    return JSONResponse(
        {"detail": f"Rate limit exceeded: {detail}"},
        status_code=429,
        headers={"Retry-After": str(max(1, math.ceil(reset_at - time.time())))},
    )
