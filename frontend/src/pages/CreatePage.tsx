// CreatePage.tsx
// Create route: build your own chart from players or teams (never both), a chart type (bar, line, scatter, or beeswarm), up to five picks, and the stats to draw.
// Everything lives in the URL (?kind=&type=&ids=&stats=) so a chart can be
// shared or reloaded. A player's position group comes from their bio and
// decides which stats data to fetch and which stats the picks share (see
// chartBuilder.ts for the rules). The scatter and beeswarm draw everyone at
// the picked positions (or every team) as background, with the picks pinned
// on top in their colors.
import { useCallback, useMemo, type ReactNode } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import ComparisonBarChart from "../components/ComparisonBarChart"
import { BeeswarmChart } from "../components/LeagueBeeswarm"
import MetricScatter from "../components/MetricScatter"
import Panel from "../components/Panel"
import type { Pin } from "../components/PickLegend"
import { PlayerDot, TooltipHeader as PlayerTooltipHeader, type PlayerPoint } from "../components/PlayerComparisonScatter"
import SearchBar from "../components/SearchBar"
import StatGlossary from "../components/StatGlossary"
import PositionGroupToggle from "../components/PositionGroupToggle"
import { TeamLogoBadge, TeamLogoMarker } from "../components/TeamLogo"
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
  meetsPoolFloor,
  pickedLines,
  percentileColumns,
  poolFloor,
  seasonWeek,
  type BuilderState,
  type Picked,
  type PoolRow,
} from "../data/chartBuilder"
import { isPositionGroup, positionPlural, type PositionGroup } from "../data/leaderCategories"
import { METRIC_GLOSSARY } from "../data/metricGlossary"
import type { PlayerBio } from "../data/playerBio"
import {
  minimumNotes,
  PLAYER_METRICS,
  playersPathForPosition,
  playersWeeklyPathForPosition,
  smallSampleNotes,
  type PlayerMetric,
  type PlayerStatsRow,
  type StatFields,
} from "../data/playerMetrics"
import { SEARCH_PLAYERS_PATH, type SearchPlayer } from "../data/search"
import { teamSeasonRows, type TeamGameRow, type TeamSeasonRow } from "../data/teamMetrics"
import { teamPath, type TeamInfo } from "../data/teams"
import { teamLogoUrl } from "../lib/imageUrls"
import { useFetch, useFetchAll } from "../lib/useFetch"
import { usePageTitle } from "../lib/usePageTitle"

const KIND_LABELS = { players: "Players", teams: "Teams" } as const
const TYPE_LABELS = { bar: "Bar", line: "Line", scatter: "Scatter", beeswarm: "Beeswarm" } as const
const SINGULAR = { players: "player", teams: "team" } as const


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
  max,
  onChange,
}: {
  metrics: PlayerMetric[]
  selected: string[]
  max: number
  onChange: (stats: string[]) => void
}) {
  const full = selected.length >= max
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

// One stat from a menu: the line chart's stat, or a scatter axis. The label
// shows only when the field's own heading doesn't already say it.
function StatSelect({
  label,
  showLabel,
  metrics,
  value,
  onChange,
}: {
  label: string
  showLabel: boolean
  metrics: PlayerMetric[]
  value: string
  onChange: (key: string) => void
}) {
  const select = (
    <select
      aria-label={showLabel ? undefined : label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-md border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1 text-sm text-[var(--text-primary)] focus:outline-2 focus:outline-[var(--accent)]"
    >
      {metrics.map((metric) => (
        <option key={metric.key} value={metric.key}>
          {metric.label}
        </option>
      ))}
    </select>
  )
  if (!showLabel) return select
  return (
    <label className="flex items-center gap-2 text-sm whitespace-nowrap text-[var(--text-secondary)]">
      {label}
      {select}
    </label>
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
  // Team names and logos for team picks, and team colors for player dots.
  const teams = useFetch<TeamInfo[]>("/teams")
  const list = forPlayers ? playerList : teams

  const candidates = useMemo<Picked[]>(() => {
    if (forPlayers) {
      return (playerList.data ?? []).flatMap((player) =>
        player.player_id && player.player_display_name
          ? [
              {
                id: player.player_id,
                name: player.player_display_name,
                team: player.recent_team ?? "",
                href: `/players/${player.player_id}`,
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
    }))
  }, [forPlayers, playerList.data, teams.data])

  // Ids in the URL that aren't real players or teams are dropped here.
  const picked = useMemo(() => {
    const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]))
    return state.ids.flatMap((id) => byId.get(id) ?? [])
  }, [candidates, state.ids])

  const pickedIds = useMemo(() => new Set(picked.map((pick) => pick.id)), [picked])

  // keepPrevious: adding a pick (e.g. a scatter tap) loads one more bio
  // without blanking the chart, which would also drop the tapped player from
  // the details box. Bios are matched by player id, never by position.
  const bios = useFetchAll<PlayerBio>(
    forPlayers ? picked.map((pick) => `/players/${encodeURIComponent(pick.id)}/bio`) : [],
    { keepPrevious: true },
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
      // Not while a new pick's bio is still loading - it has no group yet, but isn't unsupported.
      unsupported: bios.data && !bios.loading ? picked.filter((pick) => !groupById.get(pick.id)) : [],
      groups: [...new Set(chartablePicks.map((pick) => groupById.get(pick.id)!))],
    }
  }, [forPlayers, picked, bios.data, bios.loading])

  const dataPaths = (() => {
    if (picked.length === 0) return []
    if (!forPlayers) return ["/teams/weekly"]
    if (!bios.data) return null
    return groups.map((group) =>
      state.type === "line" ? playersWeeklyPathForPosition(group) : playersPathForPosition(group),
    )
  })()
  const data = useFetchAll<StatFields[]>(dataPaths)
  const rows = useMemo(() => data.data?.flat() ?? [], [data.data])
  // Each player's position, from whose data they came in with (dataPaths
  // follows `groups`) - for the beeswarm's volume floors.
  const groupByPlayer = useMemo(
    () =>
      new Map(
        forPlayers && state.type !== "line"
          ? (data.data ?? []).flatMap((groupRows, i) => groupRows.map((row) => [String(row.player_id), groups[i]] as const))
          : [],
      ),
    [forPlayers, state.type, data.data, groups],
  )
  // How far into the season we are, which the floors scale by.
  const needsWeek = forPlayers && state.type === "beeswarm"
  const latestWeek = useFetch<{ week: number; season_type: string }>(needsWeek ? "/players/latest-week" : null)
  const week = latestWeek.data ? seasonWeek(latestWeek.data) : null

  const metrics = useMemo(() => availableMetrics(state.kind, groups), [state.kind, groups])
  const stats = useMemo(() => chartStats(state, metrics), [state, metrics])
  // Stats the URL asks for that this mix of positions doesn't share.
  const leftOut =
    forPlayers && metrics.length > 0
      ? (state.stats ?? []).filter((key) => !metrics.some((metric) => metric.key === key)).flatMap((key) => statLabel(key) ?? [])
      : []

  // Season rows: one per player at the picked positions (or per team), for
  // the bars and the scatter and beeswarm backgrounds. The line chart's rows are weekly.
  const teamRows = useMemo<TeamSeasonRow[]>(
    () => (forPlayers || state.type === "line" ? [] : teamSeasonRows(rows as TeamGameRow[], teams.data ?? [])),
    [forPlayers, state.type, rows, teams.data],
  )
  const pool = useMemo<PoolRow[]>(
    () =>
      forPlayers
        ? rows.map((row) => ({
            id: String(row.player_id),
            name: String(row.player_display_name),
            team: String(row.recent_team),
            row,
          }))
        : teamRows.map((row) => ({ id: row.team, name: row.name, team: row.team, row })),
    [forPlayers, rows, teamRows],
  )
  const pins = useMemo<Pin[]>(
    () => chartable.map((pick, i) => ({ id: pick.id, name: pick.name, color: pickColor(i) })),
    [chartable],
  )
  // "WRs and RBs" - who the background is, for captions.
  const poolName = forPlayers ? groups.map(positionPlural).join(" and ") : "teams"

  const idField = forPlayers ? "player_id" : "team"
  const trends = useCallback(
    (metric: PlayerMetric) => ({ up: pickedLines(chartable, rows, idField, metric), down: [] }),
    [chartable, rows, idField],
  )

  const statsHeading =
    state.type === "bar" || state.type === "beeswarm"
      ? `Stats (up to ${MAX_STATS[state.type]})`
      : state.type === "scatter"
        ? "Stats"
        : "Stat"

  // A bio loading behind kept data (see `bios`) doesn't hold up the chart.
  const loading = list.loading || (bios.loading && !bios.data) || data.loading || (needsWeek && latestWeek.loading)
  const error = list.error ?? bios.error ?? data.error ?? (needsWeek ? latestWeek.error : null)

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
        <Panel title={state.type === "beeswarm" ? "League Comparison" : "Season Comparison"}>
          <p className="p-6 text-center text-sm text-[var(--text-secondary)]">
            No stats picked. Choose up to {MAX_STATS[state.type]} above to compare.
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
      const rowById = new Map<string, StatFields>(pool.map((entry) => [entry.id, entry.row]))
      return (
        <ComparisonBarChart
          title="Season Comparison"
          rows={barRows(chartable, rowById, stats)}
          metrics={stats}
          footer={glossary}
        />
      )
    }
    if (state.type === "scatter") return scatter(glossary)
    if (state.type === "beeswarm") return beeswarm(glossary)
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
          if (pick) openPick(pick.href, pick.name)
        }}
      />
    )
  }

  function openPick(href: string, name: string) {
    navigate(href, forPlayers ? { state: { playerName: name } } : undefined)
  }

  // A scatter click: add the player or team to the picks, or remove a pick.
  // Past the limit a click does nothing; the form already says "Up to 5".
  function togglePick(id: string) {
    const ids = picked.map((pick) => pick.id)
    if (ids.includes(id)) update({ ids: ids.filter((pickId) => pickId !== id) })
    else if (ids.length < MAX_PICKS) update({ ids: [...ids, id] })
  }

  function scatter(glossary: ReactNode) {
    const [x, y = x] = stats
    const pinIds = new Set(pins.map((pin) => pin.id))
    const action = (id: string, name: string) =>
      pinIds.has(id) ? `Remove ${name} from your picks` : `Add ${name} to your picks`
    // Keyed so new stats from the form reset the chart's axes.
    const key = `${x.key}|${y.key}`
    const shared = {
      title: `${y.label} vs. ${x.label}`,
      metrics,
      initialX: x.key,
      initialY: y.key,
      loading: false,
      error: null,
      noun: plural,
      emptyText: `No ${plural} with stats yet.`,
      pinned: pins,
      pinLimitReached: picked.length >= MAX_PICKS,
      footer: glossary,
    }
    const caption = (
      <>
        Each {forPlayers ? "dot is one of this season's" : "logo is one of the league's"} {poolName}, placed by the two
        stats you picked; the lighter lines mark the median in each. Your picks are ringed in their colors and labeled.
        Click or tap a {forPlayers ? "dot" : "logo"} to add it to your picks (up to {MAX_PICKS}), or a pick to remove it.
      </>
    )
    if (forPlayers) {
      const colorByTeam = new Map(teams.data?.map((team) => [team.team_abbr, team.team_color]))
      const points = (rows as PlayerStatsRow[]).map((row) => ({
        ...row,
        color: colorByTeam.get(row.recent_team) ?? "var(--accent)",
      }))
      return (
        <MetricScatter<PlayerPoint>
          key={key}
          {...shared}
          rows={points}
          caption={caption}
          Dot={(props) => (
            <PlayerDot
              {...props}
              label={props.payload && action(props.payload.player_id, props.payload.player_display_name)}
            />
          )}
          rowId={(point) => point.player_id}
          rowName={(point) => point.player_display_name}
          onTogglePin={(point) => togglePick(point.player_id)}
          onOpen={(point) => openPick(`/players/${point.player_id}`, point.player_display_name)}
          tapPrompt="Tap a player to add or remove them."
          renderTooltipHeader={(point) => <PlayerTooltipHeader point={point} />}
        />
      )
    }
    return (
      <MetricScatter<TeamSeasonRow>
        key={key}
        {...shared}
        rows={teamRows}
        caption={caption}
        Dot={(props) => (
          <TeamLogoMarker {...props} label={props.payload && action(props.payload.team, props.payload.name)} />
        )}
        rowId={(row) => row.team}
        rowName={(row) => row.name}
        onTogglePin={(row) => togglePick(row.team)}
        onOpen={(row) => openPick(teamPath(row.team), row.name)}
        tapPrompt="Tap a logo to add or remove that team."
        renderTooltipHeader={(row) => (
          <div className="flex items-center gap-2">
            <TeamLogoBadge logo={row.logo} size="h-7 w-7" />
            <div className="text-sm text-[var(--text-primary)]">{row.name}</div>
          </div>
        )}
      />
    )
  }

  function beeswarm(glossary: ReactNode) {
    const pinIds = new Set(pins.map((pin) => pin.id))
    const groupOf = (entry: PoolRow) => groupByPlayer.get(entry.id)
    // Teams have no floor; a player is ranked once over their position's (week is loaded by now).
    const qualifies = (entry: PoolRow) => {
      const group = groupOf(entry)
      return !forPlayers || !group || meetsPoolFloor(entry.row, group, week ?? 1)
    }
    const ranked = pool.filter((entry) => pinIds.has(entry.id) || qualifies(entry))
    const pickEntries = pool.filter((entry) => pinIds.has(entry.id))
    const pickRows = pickEntries.map((entry) => ({ name: entry.name, row: entry.row }))
    // "RBs need 18 carries so far (3 a week) to be ranked; Kyle Monangai is under that but shown anyway."
    const floorNotes = groups.flatMap((group) => {
      const floor = poolFloor(group, week ?? 1)
      if (!floor) return []
      const under = pickEntries.filter((entry) => groupOf(entry) === group && !qualifies(entry)).map((entry) => entry.name)
      const groupPlural = positionPlural(group)
      return [
        `${groupPlural[0].toUpperCase()}${groupPlural.slice(1)} need ${Math.ceil(floor.min)} ${floor.noun} so far (${floor.perWeek} a week) to be ranked${
          under.length > 0 ? `; ${under.join(", ")} ${under.length > 1 ? "are" : "is"} under that but shown anyway` : ""
        }.`,
      ]
    })
    const everyoneRanked = !forPlayers || groups.every((group) => !poolFloor(group, 1))
    return (
      <Panel title="League Comparison">
        <BeeswarmChart
          // Keyed so a new set of stats drops a highlight from the old columns.
          key={stats.map((metric) => metric.key).join("|")}
          axes={stats.map((metric) => ({ key: metric.key, label: metric.label }))}
          rows={percentileColumns(ranked, stats, pinIds)}
          players={forPlayers}
          pinned={pins}
          who={forPlayers ? `${everyoneRanked ? "All" : "Qualifying"} ${poolName} this season (${ranked.length})` : `All ${ranked.length} teams this season`}
          poolText={forPlayers ? `${everyoneRanked ? "All" : "Qualifying"} ${poolName}` : "Every team in the league"}
          tableCaption={`Every ${forPlayers ? "player's" : "team's"} picked stats with percentile ranks`}
          notes={[
            ...floorNotes,
            ...minimumNotes(plural, stats, "aren't ranked in that stat"),
            ...smallSampleNotes(pickRows, stats),
          ]}
          footer={glossary}
        />
      </Panel>
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
                <div className="w-56">
                  <SearchBar
                    placeholder={`Add a ${singular}...`}
                    scope={state.kind}
                    exclude={pickedIds}
                    onPick={(id) => update({ ids: [...picked.map((p) => p.id), id] })}
                  />
                </div>
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
          <Field label={statsHeading}>
            {metrics.length === 0 ? (
              <Note>
                {picked.length > 0 && loading
                  ? "Loading…"
                  : chartable.length > 0
                    ? "No stat is tracked for all of these positions."
                    : `Add a ${singular} to see the stats you can chart.`}
              </Note>
            ) : state.type === "bar" || state.type === "beeswarm" ? (
              <StatPills
                metrics={metrics}
                selected={stats.map((metric) => metric.key)}
                max={MAX_STATS[state.type]}
                onChange={(next) => update({ stats: next })}
              />
            ) : state.type === "scatter" ? (
              <div className="flex flex-wrap gap-3">
                {(["X axis", "Y axis"] as const).map((label, axis) => (
                  <StatSelect
                    key={label}
                    label={label}
                    showLabel
                    metrics={metrics}
                    value={stats[axis]?.key ?? stats[0].key}
                    onChange={(key) => {
                      const next = stats.map((metric) => metric.key)
                      next[axis] = key
                      update({ stats: next })
                    }}
                  />
                ))}
              </div>
            ) : (
              <StatSelect
                label="Stat"
                showLabel={false}
                metrics={metrics}
                value={stats[0].key}
                onChange={(key) => update({ stats: [key] })}
              />
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
