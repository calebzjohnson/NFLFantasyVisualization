# Deployment notes

A running list of what needs to be configured or changed when we actually connect this repo to hosting. Add to this file whenever a local decision has a deployment implication, so nothing gets forgotten between now and go-live.

**Hosting plan:** frontend on Vercel (from `frontend/`), backend on Render (from `backend/`). No accounts/auth, so no auth secrets to provision.

## Frontend (Vercel)

- [ ] **SPA routing rewrite.** The app uses `react-router-dom` with `BrowserRouter`, so routes like `/players` only exist client-side. Without a rewrite rule, a direct/refreshed load of a non-root URL will 404 on Vercel. Add `frontend/vercel.json`:
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```
- [ ] **API base URL.** Set `VITE_API_BASE_URL` in the Vercel project's env vars (Production and Preview) to the deployed Render backend URL, e.g. `https://<service>.onrender.com`, no trailing slash. It is baked in at build time, so changing it requires a redeploy. `vite build` fails if it is missing or empty (check in `frontend/vite.config.ts`). `vite dev` still falls back to `http://localhost:8000` (see `frontend/.env.example`).
- [ ] **Monorepo root.** Set the Vercel project's root directory to `frontend/`.
- [ ] **Feedback email.** The About page uses a placeholder, `feedback@example.com` (`FEEDBACK_EMAIL` in `frontend/src/pages/AboutPage.tsx`, also asserted in `AboutPage.test.tsx`). Swap in the real inbox before launch. Posting a plain address publicly invites spam, so use a dedicated inbox or alias rather than a personal one.

## Backend (Render)

- [ ] **CORS origins.** Set `APP_CORS_ORIGINS` to include the deployed Vercel frontend URL. Locally it only allows `http://localhost:5173` (see `backend/.env.example` and `backend/app/config.py`).
- [ ] **Monorepo root.** Set Render's root directory to `backend/`.
- [ ] **Build/start commands.** Build: `uv sync --locked`. Start: `uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT` (Render injects `$PORT`).
- [ ] **Instance size: pick one with at least 2 GB RAM. 512 MB plans will run out of memory.** Measured locally on 2026-10-07 (macOS RSS, one uvicorn process, every endpoint hit once):
  | Data | Idle | Steady state with all datasets loaded | Peak (all endpoints at once, cold) |
  |---|---|---|---|
  | 2026 through week 5 | ~90 MB | ~700 MB | 734 MB |
  | Full 2025 season (end-of-season proxy) | ~155 MB | ~1.0 GB | 1.03-1.17 GB |
  Memory jumps the moment any play-by-play endpoint is hit (`/teams/efficiency`: 190 MB -> 730 MB) and stays there; it isn't a transient spike, so `APP_MAX_CONCURRENT_COMPUTATIONS=1` didn't lower the peak. Latency isn't the constraint: every endpoint was under 0.6 s cold (downloads included) and 0.1 s to recompute from nflreadpy's cache. All 21 endpoints at once on a cold process finished in 3 s. Cached responses take 1-5 ms (68 ms for the largest). Re-measure on Render after deploy (Metrics tab) late in the season; Linux allocator behavior can differ from macOS.
- [ ] **Autoscaling off, one instance, one uvicorn worker.** The response cache and the rate-limit counters live in process memory. A second worker or instance would duplicate the cache (more RAM, more cold misses) and give each client one budget per process. Moving to several instances means a shared store (Redis) for slowapi first.
- [ ] **Billing alerts.** Turn on spend/usage alerts in the Render dashboard.
- [ ] **Rate limits.** Per client IP: `APP_RATE_LIMIT_HEAVY` (default `30/minute`) on `/players/radar-pool`, `/players/weekly`, `/teams/radar-pool`, `/teams/efficiency`; `APP_RATE_LIMIT_DEFAULT` (default `120/minute`) on everything else, including `/health`. A page load makes roughly 5-10 distinct API calls, and the frontend dedupes repeats. Over the limit: 429 with `Retry-After`. slowapi logs a warning with the client IP on each 429 (the only place the app logs IPs).
- [ ] **Client IP trust assumption.** `APP_TRUSTED_PROXY_HOPS` (default `1`). Render's proxy appends the connecting address to `X-Forwarded-For` without clearing what the client sent, so the app keys on the rightmost entry and ignores anything to its left (client-spoofable). This is correct only if exactly one proxy hop appends. If Render ever adds a hop (or Cloudflare is put in front), raise the value, or every visitor shares one proxy-IP budget. Verify after deploy (see below).
- [ ] **Caching.** Endpoint results are memoized in-process for `APP_CACHE_TTL_SECONDS` (default 1h, max `APP_CACHE_MAX_ENTRIES` = 128 per endpoint) on top of nflreadpy's own 24h download cache, so worst-case data age is ~27h after nflverse publishes (24h + 1h + up to 2h in the browser). The About page promises "within a day or two" of a game; keep that true if these change. Data GETs send `Cache-Control: public, max-age=3600, stale-while-revalidate=3600` (`APP_HTTP_CACHE_MAX_AGE`). A restart/redeploy clears the cache; the first visitors after it pay the cold-load cost.

## Post-deploy checks

- [ ] **Rate-limit keying.** From one network, exceed the heavy limit on `/teams/efficiency` while varying a spoofed `X-Forwarded-For: <random>` header; it must still 429. Then from a second network (e.g. phone hotspot), confirm requests still succeed: if they 429 too, all visitors share one key and `APP_TRUSTED_PROXY_HOPS` is wrong.
- [ ] **`Cache-Control`** present on data responses (`curl -I <api>/teams`).

## General

- [ ] Neither app's real `.env` is committed (only `.env.example`) — actual values need to be entered directly in the Vercel/Render dashboards, not copied from a file.
- [ ] **Legal review before go-live.** Go over all potential legal issues before deploying. Known ones: team logos (efficiency chart, scoreboard, standings, player page) are NFL trademarks and copyrighted art, and player headshots (stat leaders, comparison tooltip, player page) are copyrighted photos. Both are hotlinked, CDN-resized, from ESPN/NFL CDNs (see `frontend/src/lib/imageUrls.ts`). Stats and player names are fine. A "Not affiliated with or endorsed by the NFL" footer is already in place. The site is non-profit; if that changes (ads, donations), talk to an IP lawyer. Fallback if asked to remove images: team-colored abbreviations and initials, which `PlayerAvatar` already renders when a headshot is missing.
- [ ] **Privacy page must mention IP handling (H4, deferred legal).** The rate limiter keeps each visitor's IP in process memory for the length of its window (a minute), and slowapi logs the IP in a warning whenever it returns a 429. Nothing else in the app logs IPs.

## Possible follow-ups (not scheduled)

Found while measuring load on 2026-10-07; neither is required for launch.

- **Response compression.** Responses aren't gzipped. At full-season size, `/players/weekly?position_group=WR` with all fields is ~10 MB of JSON (the frontend requests a subset of fields, so its real payloads are smaller). Adding FastAPI's built-in `GZipMiddleware` is one line and would cut transfer roughly 10x, which matters if Render bills bandwidth.
- **Memory investigation.** Raw nflverse downloads are only ~180 MB at full season, but the process sits at ~1 GB once play-by-play is loaded. The rest is likely the pandas conversions plus freed memory the allocator doesn't return to the OS. If it can be brought down (e.g. keeping fewer play-by-play columns, nflreadpy's filesystem cache mode instead of memory), a smaller instance might work. Needs profiling before choosing a fix.
