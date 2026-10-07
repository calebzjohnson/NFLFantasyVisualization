import pandas as pd
import pytest
from fastapi.testclient import TestClient
from limits import parse
from starlette.requests import Request

from app.config import get_settings
from app.main import app
from app.rate_limit import client_ip

client = TestClient(app)
HEAVY_LIMIT = parse(get_settings().rate_limit_heavy).amount
DEFAULT_LIMIT = parse(get_settings().rate_limit_default).amount


def _request(*forwarded_for: str, peer: str = "10.0.0.1") -> Request:
    headers = [(b"x-forwarded-for", value.encode()) for value in forwarded_for]
    return Request({"type": "http", "headers": headers, "client": (peer, 1234)})


def test_client_ip_is_the_entry_render_appended() -> None:
    assert client_ip(_request("6.6.6.6, 203.0.113.9")) == "203.0.113.9"


def test_client_ip_spans_repeated_headers() -> None:
    assert client_ip(_request("6.6.6.6", "203.0.113.9")) == "203.0.113.9"


def test_client_ip_falls_back_to_peer_without_header() -> None:
    assert client_ip(_request()) == "10.0.0.1"


@pytest.fixture
def stub_efficiency(monkeypatch: pytest.MonkeyPatch, sample_pbp: pd.DataFrame) -> None:
    monkeypatch.setattr("app.services.team_efficiency.nfl.get_current_season", lambda: 2026)
    monkeypatch.setattr("app.data.pbp.get_season_pbp", lambda season: sample_pbp)


@pytest.mark.usefixtures("stub_efficiency")
def test_heavy_endpoint_returns_429_with_retry_after() -> None:
    for _ in range(HEAVY_LIMIT):
        assert client.get("/teams/efficiency").status_code == 200

    response = client.get("/teams/efficiency")

    assert response.status_code == 429
    assert 1 <= int(response.headers["Retry-After"]) <= 60


@pytest.mark.usefixtures("stub_efficiency")
def test_spoofed_forwarded_for_does_not_reset_the_limit() -> None:
    for n in range(HEAVY_LIMIT):
        headers = {"X-Forwarded-For": f"10.9.9.{n}, 203.0.113.9"}
        assert client.get("/teams/efficiency", headers=headers).status_code == 200

    spoofed = client.get(
        "/teams/efficiency", headers={"X-Forwarded-For": "1.2.3.4, 203.0.113.9"}
    )
    other_client = client.get("/teams/efficiency", headers={"X-Forwarded-For": "203.0.113.10"})

    assert spoofed.status_code == 429
    assert other_client.status_code == 200


def test_other_endpoints_use_the_default_limit() -> None:
    for _ in range(DEFAULT_LIMIT):
        assert client.get("/health").status_code == 200

    response = client.get("/health", headers={"Origin": "http://localhost:5173"})

    assert response.status_code == 429
    # CORS wraps the limiter, so the frontend can read the 429 instead of
    # seeing an opaque network error.
    assert response.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"
