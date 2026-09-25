# NFL Fantasy Visualization

A public, read-only site for visualizing NFL usage data relevant to fantasy football — starting with weekly and season-long rush attempt shares among a team's running backs, and target shares among its receivers.

No accounts or login. Data is sourced from [nflverse](https://github.com/nflverse) via [nflreadpy](https://github.com/nflverse/nflreadpy).

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

### Tests

```
cd backend && uv run pytest
cd frontend && npm test          # or `npm run test:watch` while working
```

Frontend tests use Vitest, plus React Testing Library for components. Each
test sits next to the file it covers (`teamMetrics.ts` → `teamMetrics.test.ts`),
so add a new test to that file's existing test file, or create one alongside it. Shared
test data builders live in `frontend/src/test/fixtures.ts`. Charts are tested
through their states and controls, not their rendered SVG, because jsdom
doesn't calculate layout.

## License

All rights reserved. This code is public for viewing purposes only; no license is granted to use, copy, modify, or distribute it.
