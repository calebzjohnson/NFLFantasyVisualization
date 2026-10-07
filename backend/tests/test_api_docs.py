import importlib
from collections.abc import Callable, Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import app.main
from app.config import Settings, get_settings

DOC_PATHS = ["/docs", "/redoc", "/openapi.json"]


@pytest.fixture
def build_app(monkeypatch: pytest.MonkeyPatch) -> Iterator[Callable[[bool], FastAPI]]:
    """Rebuilds app.main's app with APP_ENABLE_API_DOCS set, since the docs
    routes are fixed when the app is constructed at import.
    """

    def build(enabled: bool) -> FastAPI:
        monkeypatch.setenv("APP_ENABLE_API_DOCS", str(enabled).lower())
        get_settings.cache_clear()
        return importlib.reload(app.main).app

    yield build
    get_settings.cache_clear()


@pytest.mark.parametrize("path", DOC_PATHS)
def test_docs_are_off_when_disabled(build_app: Callable[[bool], FastAPI], path: str) -> None:
    assert TestClient(build_app(False)).get(path).status_code == 404


@pytest.mark.parametrize("path", DOC_PATHS)
def test_docs_are_served_when_enabled(build_app: Callable[[bool], FastAPI], path: str) -> None:
    assert TestClient(build_app(True)).get(path).status_code == 200


def test_docs_default_to_off() -> None:
    # Production has no .env and doesn't set the variable, so it gets this default.
    assert Settings.model_fields["enable_api_docs"].default is False
