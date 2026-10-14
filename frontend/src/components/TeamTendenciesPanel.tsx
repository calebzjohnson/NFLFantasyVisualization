// TeamTendenciesPanel.tsx
// How a team calls plays - pass/run balance, formation, tempo - each with its
// rank among the 32 teams. Rank here is placement, not judgement: throwing
// often is neither better nor worse than running often.
import { ordinal } from "../data/efficiency"
import { useFetch } from "../lib/useFetch"
import Panel from "./Panel"

interface Tendency {
  key: string
  label: string
  group: string
  value: number
  rank: number
  teams: number
  league_average: number
}

const COLUMNS = 4

interface Group {
  name: string
  rows: Tendency[]
}

/** Groups in payload order, packed into rows of at most four columns, so a
 * pair of two-metric groups shares a line instead of each taking its own.
 */
function rowsOf(tendencies: Tendency[]): Group[][] {
  const groups = new Map<string, Tendency[]>()
  for (const tendency of tendencies) {
    const rows = groups.get(tendency.group) ?? []
    rows.push(tendency)
    groups.set(tendency.group, rows)
  }

  const packed: Group[][] = []
  let row: Group[] = []
  let width = 0
  for (const [name, rows] of groups) {
    if (width > 0 && width + rows.length > COLUMNS) {
      packed.push(row)
      row = []
      width = 0
    }
    row.push({ name, rows })
    width += rows.length
  }
  if (row.length > 0) packed.push(row)
  return packed
}

function TendencyRow({ tendency }: { tendency: Tendency }) {
  const { label, value, rank, league_average } = tendency
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3">
      <span className="text-xs tracking-wider text-[var(--text-muted)] uppercase">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-2xl font-bold text-[var(--text-primary)]">{value}%</span>
        <span className="text-sm text-[var(--text-secondary)]">{ordinal(rank)}</span>
      </div>
      {/* Bare number: the caption says once what it is, rather than every row
          repeating "League". */}
      <span className="text-xs text-[var(--text-muted)]">{league_average}%</span>
    </div>
  )
}

function TeamTendenciesPanel({ teamAbbr }: { teamAbbr: string }) {
  const tendencies = useFetch<{ tendencies: Tendency[] }>(`/teams/${teamAbbr}/tendencies`)

  return (
    <Panel title="Play Calling">
      {tendencies.loading && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
      {tendencies.error && (
        <p className="p-4 text-sm text-[var(--negative)]">
          Couldn't load play calling: {tendencies.error}
        </p>
      )}
      {tendencies.data && (
        <>
          {rowsOf(tendencies.data.tendencies).map((groups) => (
            <div
              key={groups.map((group) => group.name).join()}
              className="flex flex-col border-t border-[var(--border)] sm:flex-row"
            >
              {groups.map((group, index) => (
                <div
                  key={group.name}
                  style={{ flexGrow: group.rows.length }}
                  className={`min-w-0 basis-0 ${index > 0 ? "sm:border-l sm:border-[var(--border)]" : ""}`}
                >
                  <h3 className="bg-[var(--surface-2)] px-4 py-1.5 font-display text-sm font-bold tracking-wider text-[var(--text-secondary)] uppercase">
                    {group.name}
                  </h3>
                  <div
                    className="grid grid-cols-1 sm:grid-cols-2"
                    style={{ gridTemplateColumns: `repeat(${group.rows.length}, minmax(0, 1fr))` }}
                  >
                    {group.rows.map((tendency) => (
                      <TendencyRow key={tendency.key} tendency={tendency} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
          <p className="px-4 py-3 text-xs text-[var(--text-muted)]">
            Share of this team's own run and pass plays this regular season, kneels and spikes
            excluded; fourth downs are measured against every fourth-down snap, punts and field
            goals included. Beside each rate is this team's rank among the 32 teams; below it, the
            league average.
          </p>
        </>
      )}
    </Panel>
  )
}

export default TeamTendenciesPanel
