# Deployment notes

A running list of what needs to be configured or changed when we actually connect this repo to hosting. Add to this file whenever a local decision has a deployment implication, so nothing gets forgotten between now and go-live.

**Hosting plan:** frontend on Vercel (from `frontend/`), backend on Render (from `backend/`). No accounts/auth, so no auth secrets to provision.

## Frontend (Vercel)

- [ ] **SPA routing rewrite.** The app uses `react-router-dom` with `BrowserRouter`, so routes like `/players` only exist client-side. Without a rewrite rule, a direct/refreshed load of a non-root URL will 404 on Vercel. Add `frontend/vercel.json`:
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```
- [ ] **API base URL.** Set `VITE_API_BASE_URL` in the Vercel project's env vars to the deployed Render backend URL. Locally it defaults to `http://localhost:8000` (see `frontend/.env.example`).
- [ ] **Monorepo root.** Set the Vercel project's root directory to `frontend/`.

## Backend (Render)

- [ ] **CORS origins.** Set `APP_CORS_ORIGINS` to include the deployed Vercel frontend URL. Locally it only allows `http://localhost:5173` (see `backend/.env.example` and `backend/app/config.py`).
- [ ] **Monorepo root.** Set Render's root directory to `backend/`.
- [ ] **Build/start commands.** Build: `uv sync --locked`. Start: `uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT` (Render injects `$PORT`).

## General

- [ ] Neither app's real `.env` is committed (only `.env.example`) — actual values need to be entered directly in the Vercel/Render dashboards, not copied from a file.
