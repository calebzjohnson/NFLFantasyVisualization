from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import players, scores

settings = get_settings()

app = FastAPI(title="NFL Fantasy Visualization API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(players.router)
app.include_router(scores.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
