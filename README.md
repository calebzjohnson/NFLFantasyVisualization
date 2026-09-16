# NFL Fantasy Visualization

A public, read-only site for visualizing NFL usage data relevant to fantasy football — starting with weekly and season-long rush attempt shares among a team's running backs, and target shares among its receivers.

No accounts or login. Data is sourced from [nflverse](https://github.com/nflverse) via [nfl_data_py](https://github.com/nflverse/nfl_data_py).

## Stack

- **Backend**: Python 3.12, [FastAPI](https://fastapi.tiangolo.com/), managed with [uv](https://docs.astral.sh/uv/)
- **Frontend**: React + TypeScript, built with [Vite](https://vite.dev/)
- **Hosting**: Backend on [Render](https://render.com), frontend on [Vercel](https://vercel.com)

## Repo layout

```
backend/    FastAPI service, data fetching/transforms
frontend/   React app
.github/workflows/   CI
```

## Local development

### Backend

```
cd backend
uv sync
cp .env.example .env
uv run uvicorn app.main:app --reload
```

Runs at http://localhost:8000. Health check: `GET /health`.

### Frontend

```
cd frontend
npm install
cp .env.example .env
npm run dev
```

Runs at http://localhost:5173.

## License

All rights reserved. This code is public for viewing purposes only; no license is granted to use, copy, modify, or distribute it.
