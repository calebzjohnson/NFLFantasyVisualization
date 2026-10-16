// CreatePage.tsx
// Create route: build your own chart from players or teams (never both), a chart type (bar or line), up to five picks, and the stats to draw.
// Everything lives in the URL (?kind=&type=&ids=&stats=) so a chart can be
// shared or reloaded. A player's position group comes from their bio and
// decides which stats data to fetch and which stats the picks share (see
// chartBuilder.ts for the rules).
import { useCallback, useMemo, type ReactNode } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import ComparisonBarChart from "../components/ComparisonBarChart"
import HighlightPicker from "../components/HighlightPicker"
import Panel from "../components/Panel"
import StatGlossary from "../components/StatGlossary"
import PositionGroupToggle from "../components/PositionGroupToggle"
import TrendChart from "../components/TrendChart"
import {
  availableMetrics,
  barRows,
  BUILDER_KINDS,
  builderParams,
  CHART_TYPES,
  chartStats,
  MAX_PICKS,
  MAX_STATS,
  parseBuilder,
  pickColor,
  pickedLines,
  type BuilderState,
  type Picked,
} from "../data/chartBuilder"
import { isPositionGroup, type PositionGroup } from "../data/leaderCategories"
import { METRIC_GLOSSARY } from "../data/metricGlossary"
import type { PlayerBio } from "../data/playerBio"
import {
  PLAYER_METRICS,
  playersPathForPosition,
  playersWeeklyPathForPosition,
  type PlayerMetric,
  type StatFields,
} from "../data/playerMetrics"
import { SEARCH_PLAYERS_PATH, type SearchPlayer } from "../data/search"
import { teamSeasonRows, type TeamGameRow } from "../data/teamMetrics"
import { teamPath, type TeamInfo } from "../data/teams"
import { teamLogoUrl } from "../lib/imageUrls"
import { useFetch, useFetchAll } from "../lib/useFetch"
import { usePageTitle } from "../lib/usePageTitle"

const KIND_LABELS = { players: "Players", teams: "Teams" } as const
const TYPE_LABELS = { bar: "Bar", line: "Line" } as const
const SINGULAR = { players: "player", teams: "team" } as const

type Candidate = Picked & { label: string }

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <span className="text-xs font-medium tracking-wider text-[var(--text-muted)] uppercase">{label}</span>
      {children}
    </div>
  )
}

function Note({ children }: { children: ReactNode }) {
  return <p className="text-xs text-[var(--text-muted)]">{children}</p>
}

// Toggle buttons rather than checkboxes: a native checkbox is under the 24px
// minimum tap target, and these match the site's pill toggles.
function StatPills({
  metrics,
  selected,
  onChange,
}: {
  metrics: PlayerMetric[]
  selected: string[]
  onChange: (stats: string[]) => void
}) {
  const full = selected.length >= MAX_STATS.bar
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Stats">
      {metrics.map((metric) => {
        const on = selected.includes(metric.key)
        return (
          <button
            key={metric.key}
            type="button"
            aria-pressed={on}
            // A full chart takes no more until one is turned off.
            disabled={!on && full}
            onClick={() => onChange(on ? selected.filter((key) => key !== metric.key) : [...selected, metric.key])}
            className={`rounded-full border px-2.5 py-1 text-sm transition-colors disabled:cursor-not-allowed ${
              on
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--surface-0)]"
                : "border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
            }`}
          >
            {metric.label}
          </button>
        )
      })}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="px-2 py-1 text-sm text-[var(--accent)] hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  )
}

function statLabel(key: string): string | undefined {
  return Object.values(PLAYER_METRICS)
    .flat()
    .find((metric) => metric.key === key)?.label
}

function CreatePage() {
  usePageTitle("Create")
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const state = useMemo(() => parseBuilder(searchParams), [searchParams])
  // replace: building a chart updates the current history entry instead of
  // adding one per click, so Back leaves the page.
  const update = (next: Partial<BuilderState>) =>
    setSearchParams(builderParams({ ...state, ...next }), { replace: true })
  const forPlayers = state.kind === "players"
  const plural = state.kind
  const singular = SINGULAR[state.kind]

  const playerList = useFetch<SearchPlayer[]>(forPlayers ? SEARCH_PLAYERS_PATH : null)
  const teams = useFetch<TeamInfo[]>(forPlayers ? null : "/teams")
  const list = forPlayers ? playerList : teams

  const candidates = useMemo<Candidate[]>(() => {
    if (forPlayers) {
      return (playerList.data ?? []).flatMap((player) =>
        player.player_id && player.player_display_name
          ? [
              {
                id: player.player_id,
                name: player.player_display_name,
                team: player.recent_team ?? "",
                href: `/players/${player.player_id}`,
                // Position and team tell apart players who share a name.
                label: [player.player_display_name, player.position, player.recent_team].filter(Boolean).join(" · "),
              },
            ]
          : [],
      )
    }
    return (teams.data ?? []).map((team) => ({
      id: team.team_abbr,
      name: team.team_name,
      team: team.team_abbr,
      href: teamPath(team.team_abbr),
      logo: teamLogoUrl(team.team_logo_espn),
      label: team.team_name,
    }))
  }, [forPlayers, playerList.data, teams.data])

  // Ids in the URL that aren't real players or teams are dropped here.
  const picked = useMemo(() => {
    const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]))
    return state.ids.flatMap((id) => byId.get(id) ?? [])
  }, [candidates, state.ids])

  const bios = useFetchAll<PlayerBio>(
    forPlayers ? picked.map((pick) => `/players/${encodeURIComponent(pick.id)}/bio`) : [],
  )

  // Players whose position has no stat catalog (e.g. long snappers) can't be charted.
  const { chartable, unsupported, groups } = useMemo(() => {
    if (!forPlayers) return { chartable: picked, unsupported: [], groups: [] }
    const groupById = new Map<string, PositionGroup | null>(
      bios.data?.map((bio) => [bio.player_id, isPositionGroup(bio.position_group) ? bio.position_group : null]),
    )
    const chartablePicks = picked.filter((pick) => groupById.get(pick.id))
    return {
      chartable: chartablePicks,
      unsupported: bios.data ? picked.filter((pick) => !groupById.get(pick.id)) : [],
      groups: [...new Set(chartablePicks.map((pick) => groupById.get(pick.id)!))],
    }
  }, [forPlayers, picked, bios.data])

  const dataPaths = (() => {
    if (picked.length === 0) return []
    if (!forPlayers) return ["/teams/weekly"]
    if (!bios.data) return null
    return groups.map((group) =>
      state.type === "bar" ? playersPathForPosition(group) : playersWeeklyPathForPosition(group),
    )
  })()
  const data = useFetchAll<StatFields[]>(dataPaths)
  const rows = useMemo(() => data.data?.flat() ?? [], [data.data])

  const metrics = useMemo(() => availableMetrics(state.kind, groups), [state.kind, groups])
  const stats = useMemo(() => chartStats(state, metrics), [state, metrics])
  // Stats the URL asks for that this mix of positions doesn't share.
  const leftOut =
    forPlayers && metrics.length > 0
      ? (state.stats ?? []).filter((key) => !metrics.some((metric) => metric.key === key)).flatMap((key) => statLabel(key) ?? [])
      : []

  const idField = forPlayers ? "player_id" : "team"
  const trends = useCallback(
    (metric: PlayerMetric) => ({ up: pickedLines(chartable, rows, idField, metric), down: [] }),
    [chartable, rows, idField],
  )

  const loading = list.loading || bios.loading || data.loading
  const error = list.error ?? bios.error ?? data.error

  function chart() {
    // A shared link's picks only resolve once the list arrives - load, don't hint, until then.
    if (picked.length === 0 && !error && !(list.loading && state.ids.length > 0)) {
      return (
        <p className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-secondary)]">
          Add up to {MAX_PICKS} {plural} above to build a chart.
        </p>
      )
    }
    if (loading || error) {
      return (
        <Panel title="Your Chart">
          {error ? (
            <p className="p-4 text-sm text-[var(--negative)]">
              Couldn't load {plural}: {error}
            </p>
          ) : (
            <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>
          )}
        </Panel>
      )
    }
    if (chartable.length === 0) return null
    if (metrics.length === 0) {
      return (
        <p className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-secondary)]">
          These positions don't share any stats. Remove a player to chart the rest.
        </p>
      )
    }
    if (stats.length === 0) {
      return (
        <Panel title="Season Comparison">
          <p className="p-6 text-center text-sm text-[var(--text-secondary)]">
            No stats picked. Choose up to {MAX_STATS.bar} above to compare.
          </p>
        </Panel>
      )
    }
    const glossary = (
      <StatGlossary
        entries={stats.map((metric) => ({ key: metric.key, label: metric.label, text: METRIC_GLOSSARY[metric.key] }))}
      />
    )
    if (state.type === "bar") {
      const rowById = new Map<string, StatFields>(
        forPlayers
          ? rows.map((row) => [String(row.player_id), row])
          : teamSeasonRows(rows as TeamGameRow[], teams.data ?? []).map((row) => [row.team, row]),
      )
      return (
        <ComparisonBarChart
          title="Season Comparison"
          rows={barRows(chartable, rowById, stats)}
          metrics={stats}
          footer={glossary}
        />
      )
    }
    const [metric] = stats
    return (
      <TrendChart
        // Keyed so a new stat starts the chart fresh, like picking one in its own menu.
        key={metric.key}
        title={`${metric.label} by Week`}
        metrics={stats}
        plural={plural}
        singular={singular}
        loading={false}
        error={null}
        trends={trends}
        footer={glossary}
        summary={`${metric.label.toLowerCase()} each week for the ${chartable.length} ${chartable.length === 1 ? singular : plural} you picked`}
        onSelect={(line) => {
          const pick = chartable.find((p) => p.id === line.id)
          if (pick) navigate(pick.href, forPlayers ? { state: { playerName: pick.name } } : undefined)
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-wide text-[var(--text-primary)] uppercase">Create</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Build your own chart: pick players or teams, a chart type, and the stats to compare.
        </p>
      </div>
      <Panel title="Build a Chart">
        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-wrap gap-6">
            <Field label="Compare">
              <PositionGroupToggle
                options={BUILDER_KINDS}
                active={state.kind}
                labelFor={(kind) => KIND_LABELS[kind]}
                // Picks and stats belong to one kind, so switching starts over.
                onChange={(kind) => kind !== state.kind && update({ kind, ids: [], stats: null })}
                aria-label="Compare"
              />
            </Field>
            <Field label="Chart">
              <PositionGroupToggle
                options={CHART_TYPES}
                active={state.type}
                labelFor={(type) => TYPE_LABELS[type]}
                onChange={(type) => update({ type })}
                aria-label="Chart type"
              />
            </Field>
          </div>
          <Field label={KIND_LABELS[state.kind]}>
            <div className="flex flex-wrap items-center gap-2">
              {picked.map((pick) => {
                const index = chartable.indexOf(pick)
                return (
                  <button
                    key={pick.id}
                    type="button"
                    onClick={() => update({ ids: picked.filter((p) => p !== pick).map((p) => p.id) })}
                    aria-label={`Remove ${pick.name}`}
                    className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-2)] focus:outline-2 focus:outline-[var(--accent)]"
                  >
                    {index >= 0 && (
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: pickColor(index) }}
                        aria-hidden="true"
                      />
                    )}
                    {pick.name}
                    <span aria-hidden="true">×</span>
                  </button>
                )
              })}
              {picked.length < MAX_PICKS ? (
                <HighlightPicker
                  label="Add"
                  noun={plural}
                  options={candidates.filter((candidate) => !picked.includes(candidate))}
                  picked={null}
                  onPick={(id) => update({ ids: [...picked.map((p) => p.id), id] })}
                  onClear={() => {}}
                />
              ) : (
                <Note>
                  Up to {MAX_PICKS} {plural}.
                </Note>
              )}
            </div>
            {unsupported.length > 0 && (
              <Note>No stats to chart for {unsupported.map((pick) => pick.name).join(", ")}.</Note>
            )}
          </Field>
          <Field label={state.type === "bar" ? `Stats (up to ${MAX_STATS.bar})` : "Stat"}>
            {metrics.length === 0 ? (
              <Note>
                {picked.length > 0 && loading
                  ? "Loading…"
                  : chartable.length > 0
                    ? "No stat is tracked for all of these positions."
                    : `Add a ${singular} to see the stats you can chart.`}
              </Note>
            ) : state.type === "bar" ? (
              <StatPills
                metrics={metrics}
                selected={stats.map((metric) => metric.key)}
                onChange={(next) => update({ stats: next })}
              />
            ) : (
              <select
                aria-label="Stat"
                value={stats[0].key}
                onChange={(event) => update({ stats: [event.target.value] })}
                className="rounded-md border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1 text-sm text-[var(--text-primary)] focus:outline-2 focus:outline-[var(--accent)]"
              >
                {metrics.map((metric) => (
                  <option key={metric.key} value={metric.key}>
                    {metric.label}
                  </option>
                ))}
              </select>
            )}
            {leftOut.length > 0 && (
              <Note>Not tracked for every pick's position, so left out: {leftOut.join(", ")}.</Note>
            )}
          </Field>
        </div>
      </Panel>
      {chart()}
    </div>
  )
}

export default CreatePage
