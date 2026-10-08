from collections.abc import Awaitable, Callable

from fastapi import Depends, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import get_settings
from app.rate_limit import limiter, rate_limit_exceeded
from app.routers import players, scores, standings, teams

settings = get_settings()

docs_on = settings.enable_api_docs
app = FastAPI(
    title="Plot the Pigskin API",
    docs_url="/docs" if docs_on else None,
    redoc_url="/redoc" if docs_on else None,
    openapi_url="/openapi.json" if docs_on else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded)
app.add_middleware(SlowAPIMiddleware)
# Added last so it's outermost: 429s still carry CORS headers the browser can read.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Outermost, so it also covers 429s and CORS preflights."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


def cache_control(response: Response) -> None:
    """Lets browsers/CDNs reuse successful data responses. Errors (raised as
    exceptions) get a fresh response without this header, so aren't cached.
    """
    age = settings.http_cache_max_age
    response.headers["Cache-Control"] = f"public, max-age={age}, stale-while-revalidate={age}"


for router in (players.router, scores.router, standings.router, teams.router):
    app.include_router(router, dependencies=[Depends(cache_control)])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
