# Codebase map

A one-read overview of how Plot the Pigskin fits together: where things live, how data flows, and which piece calls which.
Update it in the same change whenever you add, move, rename, or delete a file, add an endpoint or route, or change how data flows (see "Keeping this map current" at the bottom).

Plot the Pigskin is a public, read-only site that shows NFL usage and efficiency stats for fantasy football. It has no accounts and no database. Every number comes from nflverse at request time.

## Data flow

```
nflverse (via nflreadpy, 24h download cache)
  -> backend/app/data/*.py       one thin loader per dataset, @single_flight, returns a pandas DataFrame
  -> backend/app/services/*.py   pandas aggregation per feature, public get_* functions are @memoized (1h TTL)
  -> backend/app/routers/*.py    FastAPI GET endpoints: rate limits, 400/404 mapping, Cache-Control
  -> frontend/src/lib/api.ts     fetchJson(path) against VITE_API_BASE_URL
  -> frontend/src/lib/useFetch.ts  React hook with a page-lifetime cache keyed by path, shares in-flight requests
  -> frontend/src/data/*.ts      response types and pure shaping/formatting per feature
  -> frontend/src/components/*   panels and charts (recharts), each fetching its own data
  -> frontend/src/pages/*        one component per route
```

Each chart fetches its own data. Pages pass ids (team abbreviation, player id, position group), not data. Most components also fetch `/teams` for logos and colors. `useFetch` dedupes those requests, so that's cheap.

## Backend (`backend/`, Python 3.12, FastAPI, uv)

| File | Role |
|---|---|
| `app/main.py` | App setup: CORS (GET only), slowapi middleware, security headers, `Cache-Control` on every data router, `/health`. API docs only when `APP_ENABLE_API_DOCS`. |
| `app/config.py` | `Settings` (pydantic-settings, `APP_` env prefix, reads `.env`): CORS origins, cache TTL/size, compute concurrency, HTTP max-age, rate limits, trusted proxy hops. |
| `app/cache.py` | `@memoized` (per-function TTL+LRU cache, single computation per key, global compute semaphore) and `@single_flight` (serializes an nflreadpy loader). `clear_caches()` for tests. |
| `app/rate_limit.py` | slowapi limiter keyed on the client IP from `X-Forwarded-For` (`trusted_proxy_hops` from the right). `heavy_limit` decorator, 429 handler with `Retry-After`. |

### `app/data/`: nflverse loaders (one dataset each)

| File | Loads |
|---|---|
| `player_stats.py` | Season totals (`summary_level="reg"`) and per-game rows. |
| `pbp.py` | Play-by-play (~370 columns, the heaviest load). |
| `schedules.py` | Schedule, plus `get_played_games`, `get_team_game_log` (one row per team-game), and `last_complete_week`. |
| `snap_counts.py` | PFR snap counts (keyed by `pfr_player_id`), plus `get_pfr_to_gsis_map()`. |
| `pfr_defense.py` | PFR advanced defense (pressures, missed tackles, coverage). Keyed by PFR id. |
| `nextgen_stats.py` | Next Gen Stats season-to-date (week 0 rows). |
| `depth_charts.py` | Latest depth-chart snapshot, plus `get_alignment_bucket` (scheme + alignment to EDGE/DL/LB/CB/S). |
| `injuries.py`, `rosters.py` | Weekly injury reports, and rosters (the `RES` status for reserve/IR). |
| `players.py`, `teams.py`, `team_stats.py` | Player registry (bio), team registry (includes old franchise codes), weekly team stats. |

### `app/services/`: one module per feature

| File | Produces |
|---|---|
| `players.py` | `/players*` payloads: season and weekly stats with field/sort/position filters, latest week, game log, bio (server-side `position_group`), usage share. |
| `extended_stats.py` | Merges snap counts and PFR defense onto player_stats rows. Splits SPEC into K/P/LS and DL/LB/DB into EDGE/DL/LB/CB/S. |
| `radar.py` | Player radar pool: 6 percentile-ranked axes per position, minimum-sample rules. |
| `team_radar.py` | Team radar pool: 6 EPA/red-zone/special-teams axes with league percentiles. |
| `team_efficiency.py` | Offensive and defensive EPA per play for each team. |
| `team_tendencies.py` | Play-calling rates (balance, formation, pass location and depth, run direction, tempo, red zone, third and fourth down) vs. league. |
| `team_playmaking.py` | Team usage shares, red-zone touches, top-5 leaders per stat. |
| `scoring_composition.py` | Points by unit (passing/rushing TDs, kicking, defense/ST). |
| `depth_chart.py` | Team depth chart by unit, with injury/reserve status merged from injuries and rosters. |
| `teams.py` | Active teams (filtered by schedule), plus a per-team game stats log. |
| `standings.py` + `tiebreakers.py` | Division standings in official NFL tiebreaker order. |
| `scores.py` | A week's games. The default week follows the fantasy calendar (rolls over Wednesday, US Eastern). |
| `matchups.py` | One game: before kickoff a preview (per-game season box score, recent form, season leaders, offense-vs-defense EPA), after it a breakdown (box score, line score, drives, win probability, game leaders, full box score). Betting lines are in the schedule row and deliberately not sent. |

### Endpoints (`app/routers/`)

"Heavy" endpoints use `APP_RATE_LIMIT_HEAVY` (30/min). The rest use the default (120/min).

| Endpoint | Service | Heavy | Frontend consumers |
|---|---|---|---|
| `GET /health` | main.py | | Uptime check (returns `{"status": "ok"}`) |
| `/players?sort&limit&fields&position_group` | players | | StatLeadersPanel (via `leaderCategories`), PlayerComparisonScatter, SearchBar, CreatePage |
| `/players/weekly?fields&position_group` | players | yes | TrendingPlayersChart, StatLeadersPanel movement arrows (`leaderMovement`), CreatePage line chart |
| `/players/latest-week` | players | | StatLeadersPanel, AboutPage |
| `/players/radar-pool?position=` | radar | yes | PlayerRadarChart, LeagueBeeswarm |
| `/players/{id}/bio` | players | | PlayerPage, CreatePage (each pick's `position_group`) |
| `/players/{id}/games` | players | | GameLogPanel |
| `/players/{id}/usage` | players | | TeamUsagePanel |
| `/teams` | teams | | Nearly every component (logos, colors, names) |
| `/teams/weekly` | teams | | TeamsPage (TrendChart, TeamLeadersPanel), TeamPage game log, CreatePage |
| `/teams/efficiency` | team_efficiency | yes | TeamEfficiencyScatter |
| `/teams/radar-pool` | team_radar | yes | TeamRadarChart, LeagueBeeswarm |
| `/teams/{team}/scoring` | scoring_composition | | TeamScoringComposition |
| `/teams/{team}/depth-chart` | depth_chart | | TeamDepthChartPanel |
| `/teams/{team}/playmaking` | team_playmaking | yes | TeamPlaymakingPanel |
| `/teams/{team}/tendencies` | team_tendencies | yes | TeamTendenciesPanel |
| `/standings` | standings | | DivisionStandings, TeamPage header |
| `/scores?week=` | scores | | PreviousWeekScores |
| `/matchups/{game_id}` | matchups | yes | MatchupPage (MatchupPreviewPanel, MatchupComparison, MatchupLeaders, MatchupWinProbability, MatchupDrives, MatchupBoxScore) |

When adding an endpoint, also add it to the heavy-endpoint list in `DEPLOYMENT_NOTES.md` if it loads play-by-play or a whole-league frame.

### Backend tests (`backend/tests/`)

One `test_<module>.py` per service, plus `test_<name>_router.py` for the HTTP layer. Tests stub the `app/data` loaders with small DataFrames (shared fixtures in `conftest.py`) and never hit the network. An autouse fixture clears the memo caches and rate-limit counters between tests.

## Frontend (`frontend/`, React 19, TypeScript, Vite, Tailwind 4, recharts)

### Routes (`src/App.tsx`)

| Route | Page | Main pieces |
|---|---|---|
| `/` | `HomePage` | PreviousWeekScores, DivisionStandings, TeamEfficiencyScatter, StatLeadersPanel (+ position toggle) |
| `/teams` | `TeamsPage` | SearchBar (teams), TeamLeadersPanel, MetricScatter (Compare Teams), LeagueBeeswarm, TrendChart (Trending Teams) |
| `/teams/:teamAbbr` | `TeamPage` | TeamHeaderBar, then tabs in `?tab=`: **Overview** (GameLogTable, TeamRadarChart, TeamScoringComposition, LeagueBeeswarm, TeamTendenciesPanel), **Playmaking** (TeamPlaymakingPanel), **Depth Chart** (TeamDepthChartPanel) |
| `/players` | `PlayersPage` | SearchBar, page-wide PositionGroupToggle driving StatLeadersPanel, PlayerComparisonScatter, LeagueBeeswarm (`PROFILE_GROUPS` only), TrendingPlayersChart |
| `/players/:playerId` | `PlayerPage` | PlayerBioBar, GameLogPanel, PlayerRadarChart, LeagueBeeswarm, TeamUsagePanel |
| `/create` | `CreatePage` | Chart builder: players or teams (never mixed), Bar (ComparisonBarChart) or Line (TrendChart), up to 5 picks and the stats, all in `?kind&type&ids&stats` |
| `/matchups` | `MatchupsPage` | MatchupSlate (a week's games, reusing `/scores`), each linking to one matchup |
| `/matchups/:gameId` | `MatchupPage` | Header (line score, records, recent-form pills), then either the preview (scheduled) or, in `?tab=`, **Game** (comparison, leaders, win probability, drives) / **Box Score** (final) |
| `/about` | `AboutPage` | Static copy and data freshness (`/players/latest-week`) |

`src/main.tsx` mounts the app under `BrowserRouter`. `vercel.json` rewrites every non-asset path to `index.html`.

### `src/components/`

Every file opens with a two-line contract comment (file name, then purpose). Read it before opening the rest.

- **Layout and chrome:** `Navbar` (title, tabs, search), `Panel` (card wrapper), `Modal` + `ExpandButton` (fuller view of a panel), `PositionGroupToggle` (pill buttons, also used for tabs), `AxisSelect` (stat picker), `SearchBar`.
- **Identity:** `PlayerBioBar`, `TeamHeaderBar`, `PlayerAvatar` (headshot, or initials as fallback), `TeamLogo` (HTML badge + SVG marker), `TeamLink`, `StatusBadge` (injury/availability), `RankChange` (movement arrows).
- **Tables:** `DetailedLeaderTable` (sortable ranked table), `StatLeadersPanel`, `TeamLeadersPanel`, `GameLogPanel` + `GameLogTable`, `DivisionStandings` + `DivisionStandingsTable`, `DepthChartTable`, `TeamDepthChartPanel`, `PreviousWeekScores`.
- **Charts:** `MetricScatter` (pick-your-axes scatter, shared by Compare Teams and `PlayerComparisonScatter`; a click or a `HighlightPicker` search highlights one mark, drawn on top while the rest fade, and a second click opens its page), `TeamEfficiencyScatter`, `TrendChart` (+ `TrendingPlayersChart` wrapper; also the Create page's picked lines), `ComparisonBarChart` (Create page: HTML bars, one scale per stat), `PlayerRadarChart` / `TeamRadarChart`, `LeagueBeeswarm` (League Comparison for players or teams, with an optional focus row; the radars and it use `RadarAxisTick` for two-line labels), `TeamScoringComposition` (donut), `TeamUsagePanel` (weekly lines/bars + season donut, the largest file), `TeamPlaymakingPanel`, `TeamTendenciesPanel`, `MatchupSlate` (a week's games as cards), `MatchupPreviewPanel` (offense-vs-defense EPA bars), `MatchupComparison` (split bars in team colours, gist inline and the rest in a Modal; shared by preview and breakdown), `MatchupLeaders` (headshot, value and name a side; shared likewise), `MatchupWinProbability` (two areas off a 50 baseline, coloured by who's favoured), `MatchupDrives` (a Sankey per team, with a list toggle), `MatchupBoxScore`.
- **Chart accessibility and touch:** `ChartDataTable` ("show data as table"), `StatGlossary` ("What do these stats mean?" under the radars and Create charts), `TapDetails` (on touchscreens, a details box below the chart replaces the tooltip; `HoverCard` is the mouse tooltip for the nearest mark).
- `evilcharts/ui/`: `recharts-chart.tsx` (chart container and config context) and `recharts-tooltip.tsx`, adapted from Evil Charts.

### `src/data/`: per-feature types and pure logic (no React)

`teams` (team type, logo lookup, team URLs), `standings`, `scores`, `efficiency`, `teamMetrics` (team stat catalog), `playerMetrics` (player metric catalog, `/players` path builders, `SNAP_SHARE_FIELD`), `leaderCategories` + `leaderStatsTypes` + `leaderMovement` (Stat Leaders config and week-over-week rank change; `PROFILE_GROUPS` = positions with radar profiles), `trendingPlayers` (snap-share qualification), `gameLog` (per-position game log columns), `playerBio`, `usage` (usage payload type, color assignment), `playmaking`, `tendencies` (pairs play-calling rates into 100% split bars), `matchups` (one game's preview/breakdown types, the comparison row catalog, offense-vs-defense pairing, drives-to-Sankey), `teamColors` (a readable colour pair for two teams, since four share one primary), `depthChart`, `search`.

### `src/lib/`: cross-cutting helpers

- **Fetching:** `api.ts` (`fetchJson`, 429 message), `useFetch.ts` (cache + in-flight dedupe; `useFetchAll` for a list of paths known only at runtime).
- **Hooks:** `useMediaQuery`, `usePageTitle`, `useTapToOpen` (first tap previews, second tap opens; `selectFirst` makes a mouse click preview first too).
- **Hit-testing:** `chartMarks` (nearest mark within 20px for clicks, taps, and mouse hover via `useHoveredMark`, used by the scatters and `LeagueBeeswarm`), `pieSliceAt` (donuts), `activateOnKey` (Enter/Space on role="button" marks).
- **Pure helpers:** `footballStats` (passer rating etc.), `chartSummaries` (plain-language text for screen readers), `playerVisuals`, `imageUrls` (CDN-resized headshots and logos), `site` (`SITE_NAME`), `utils` (`cn()`).

### Styling

Tailwind 4 via `@tailwindcss/vite`. Theme tokens (`--surface-*`, `--text-*`, `--accent`, `--positive`, `--negative`, `--warning`) are CSS variables in `src/index.css`. The theme is light only. `contrast.test.ts` checks every text token for WCAG AA contrast, so a new color token goes through it. The display font is Barlow Condensed (`@fontsource`).

### Frontend tests

- Vitest + jsdom + React Testing Library. Each `X.test.ts(x)` sits next to the file it covers.
- `src/test/`: `fixtures.ts` (data builders), `render.tsx` (`renderWithRouter`, `mockApi` answers `fetchJson` by path), `readFields.ts`, `setup.ts` (desktop-sized `matchMedia`).
- Tests at the frontend root check config: `site.test.ts` (index.html head, robots), `contrast.test.ts`, `vercel.test.ts` (rewrites, CSP), `vite.config.test.ts` (production build needs `VITE_API_BASE_URL`).
- `e2e/smoke.spec.ts` (Playwright, desktop and Pixel 5 projects): loads every page against the real local stack. `playwright.config.ts` starts uvicorn on :8000 and Vite itself, or reuses running ones.

## Config, CI, deploy

- **Env:** backend `APP_*` (see `backend/.env.example`, `app/config.py`). Frontend `VITE_API_BASE_URL`; production builds fail without it.
- **CI** (`.github/workflows/ci.yml`): backend `ruff check`, `mypy app`, `pytest`. Frontend `lint` (oxlint), `test`, `build` (`tsc -b && vite build`). `e2e` runs Playwright against live nflverse data.
- **Hosting:** frontend on Vercel (`frontend/vercel.json`: SPA rewrite, CSP, which must list any new image or API host). Backend on Render: one instance, one worker, because the caches and rate-limit counters live in process memory.
- **`DEPLOYMENT_NOTES.md`:** running checklist of everything that needs configuring at deploy time. Add to it when a change has a deploy implication.

## Cross-cutting rules and gotchas

- **Player ids:** `gsis_id` (`player_id`) everywhere. PFR data (snap counts, advanced defense) is keyed by `pfr_player_id`, so join it through `snap_counts.get_pfr_to_gsis_map()`.
- **Position groups:** the server assigns `position_group`. Defenders are EDGE/DL/LB/CB/S, from depth-chart alignment. The frontend must never derive it from `position`.
- **Regular season only:** stats are filtered to `game_type == "REG"` (a `REGULAR_SEASON` constant in each module that needs it). `/scores` is the exception and also lists postseason games.
- **Partial weeks:** nflverse loads a week one game day at a time. Use `schedules.last_complete_week` when "the latest week" has to be complete.
- **Memoized results are shared objects.** Never mutate what a `@memoized` function returns.
- **Running Python:** use `uv run`. The code uses 3.12 syntax (`def f[**P, R]`), so the system `python3` (3.9) can't even parse it.
- **iOS zooms into focused fields under 16px.** `index.css` sets inputs/selects to 16px on touchscreens (`hover: none`); never fix it with `maximum-scale` in the viewport meta.
- **Charts:** reference lines use median and raw units, not mean and standard deviation. Touch follows the `useTapToOpen` + `TapDetails` pattern: no tooltip covering the chart on phones. The Compare scatters and `LeagueBeeswarm` instead make the first click highlight and the second open, for mouse and touch alike, with `HighlightPicker` as the search. On those charts and Team Efficiency, recharts' own tooltip is replaced: it can only follow the shape under the pointer, so `chartMarks` resolves hover and clicks to the nearest mark (`data-tap-key` inside `data-chart-marks`) and `HoverCard` shows it.
- **Shortcuts are marked with `ponytail:` comments,** each naming its limit and the upgrade path.

## Keeping this map current

Update this file in the same change (commit or PR) as the code when you:
- add, rename, move, or delete a backend module, frontend component, page, `data/` or `lib/` file: add or fix its line in the matching section;
- add or change an endpoint: update the Endpoints table, including the frontend consumers column;
- add a route or a team-page tab: update the Routes table;
- change the data flow, caching, rate limiting, CI, or hosting: update those sections;
- run into a new cross-cutting gotcha that cost real time: add one line under "Cross-cutting rules and gotchas".

Keep entries to one line. The file contract comment (frontend) or docstring (backend) holds the detail. This map only says what exists and where it fits. Don't list test files one by one, since they sit next to what they cover.
