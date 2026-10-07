import pytest
from fastapi.testclient import TestClient
from limits import parse

from app.config import get_settings
from app.main import app

client = TestClient(app)


@pytest.mark.parametrize(
    ("method", "path", "headers"),
    [
        ("GET", "/health", {}),
        ("GET", "/players/radar-pool?position=XX", {}),  # handled error (400)
        ("GET", "/no-such-route", {}),  # 404
        (
            "OPTIONS",
            "/teams",
            {"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
        ),  # CORS preflight
    ],
)
def test_every_response_carries_security_headers(
    method: str, path: str, headers: dict[str, str]
) -> None:
    response = client.request(method, path, headers=headers)

    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["Referrer-Policy"] == "no-referrer"


def test_rate_limited_responses_carry_security_headers() -> None:
    for _ in range(parse(get_settings().rate_limit_default).amount):
        client.get("/health")
    response = client.get("/health")

    assert response.status_code == 429
    assert response.headers["X-Content-Type-Options"] == "nosniff"
