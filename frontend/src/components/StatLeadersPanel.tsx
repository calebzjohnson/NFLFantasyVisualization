// StatLeadersPanel.tsx
// Stat leaders table for one position group; fetches /players for it.
// Which position is active is owned by the caller (e.g. a page-level toggle) -
// pass an optional `actions` (e.g. <PositionGroupToggle />) to render a
// switcher in the panel header, for a caller that isn't controlling position
// from elsewhere on the page.
import { type ReactNode, useState } from "react"
import { Link } from "react-router-dom"
import {
  LEADER_CATEGORIES,
  type PositionGroup,
  positionPlural,
  type RawPlayerRow,
} from "../data/leaderCategories"
import { competitionRanks, previousRanks, weeklyLeaderPath } from "../data/leaderMovement"
import type { DetailedLeaderRow } from "../data/leaderStatsTypes"
import type { TeamInfo } from "../data/teams"
import { useFetch } from "../lib/useFetch"
import DetailedLeaderTable from "./DetailedLeaderTable"
import ExpandButton from "./ExpandButton"
import Modal from "./Modal"
import Panel from "./Panel"
import PlayerAvatar from "./PlayerAvatar"
import RankChange from "./RankChange"
import TeamLink from "./TeamLink"

const LEADER_ROWS_SHOWN = 5

function PlayerCell({ row }: { row: DetailedLeaderRow }) {
  return (
    <div className="flex items-center gap-3">
      {/* Duplicates the name link beside it: clickable, but kept out of the tab
          order and the accessibility tree so it isn't a second, unnamed link. */}
      <Link to={`/players/${row.playerId}`} state={{ playerName: row.player }} tabIndex={-1} aria-hidden="true">
        <PlayerAvatar name={row.player} headshot={row.headshot} color={row.teamColor} size="h-8 w-8" />
      </Link>
      <div>
        <Link
          to={`/players/${row.playerId}`}
          state={{ playerName: row.player }}
          className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline"
        >
          {row.player}
        </Link>
        <TeamLink team={row.team} className="block text-xs text-[var(--text-secondary)]">
          {row.team}
        </TeamLink>
      </div>
    </div>
  )
}

// The home page's showcase: one card per leader, with their place, headline
// stat only, and an arrow for how far they've moved since last week.
function LeaderCard({
  row,
  statKey,
  rank,
  previousRank,
}: {
  row: DetailedLeaderRow
  statKey: string
  rank: number
  previousRank: number | undefined
}) {
  return (
    <Link
      to={`/players/${row.playerId}`}
      state={{ playerName: row.player }}
      className="flex min-w-0 flex-1 basis-32 flex-col items-center gap-1 rounded-lg px-2 py-3 text-center hover:bg-[var(--surface-2)]"
    >
      {/* Styled like the standings' place column: the leader in the accent color. */}
      <span
        className={`mb-1 font-display text-base ${
          row.rank === 1 ? "font-bold text-[var(--accent)]" : "text-[var(--text-muted)]"
        }`}
      >
        {row.rank}
      </span>
      <PlayerAvatar
        name={row.player}
        headshot={row.headshot}
        color={row.teamColor}
        size="h-20 w-20"
        imageSize={192}
      />
      <span className="mt-1 w-full truncate text-sm font-medium text-[var(--text-primary)]">
        {row.player}
      </span>
      <span className="text-xs text-[var(--text-secondary)]">{row.team}</span>
      <span className="flex items-center gap-1">
        <span className="font-display text-2xl font-bold text-[var(--text-primary)]">{row.stats[statKey]}</span>
        <RankChange previous={previousRank} current={rank} />
      </span>
    </Link>
  )
}

function StatLeadersPanel({
  position,
  actions,
  expandable = false,
  layout = "table",
}: {
  position: PositionGroup
  actions?: ReactNode
  // Opt-in: the home page keeps a plain top 5.
  expandable?: boolean
  // "headshots" is the home page's showcase; the players page keeps the table.
  layout?: "table" | "headshots"
}) {
  const active = LEADER_CATEGORIES.find((category) => category.position === position)!
  const { data, error, loading } = useFetch<RawPlayerRow[]>(active.path)
  const teams = useFetch<TeamInfo[]>("/teams")
  const colorByTeam = new Map(teams.data?.map((team) => [team.team_abbr, team.team_color]))
  const showcase = layout === "headshots"
  const weekly = useFetch<RawPlayerRow[]>(showcase ? weeklyLeaderPath(active) : null)
  const latestWeek = useFetch<{ week: number }>(showcase ? "/players/latest-week" : null)

  const [sortedPosition, setSortedPosition] = useState(position)
  const [sortKey, setSortKey] = useState(active.defaultSortKey)
  const [sortDesc, setSortDesc] = useState(true)
  const [expanded, setExpanded] = useState(false)

  // Position changed out from under us - go back to that category's own default column.
  // (Adjusting state during render, not an effect, per https://react.dev/learn/you-might-not-need-an-effect)
  if (position !== sortedPosition) {
    setSortedPosition(position)
    setSortKey(active.defaultSortKey)
    setSortDesc(true)
  }

  function handleSort(key: string) {
    if (key === sortKey) {
      setSortDesc((desc) => !desc)
    } else {
      setSortKey(key)
      setSortDesc(true)
    }
  }

  // Ranked across everyone at the position, so a player's rank means the same
  // thing in the panel's top 5 and in the expanded list.
  const ranked: DetailedLeaderRow[] | null =
    data
      ?.map((row) => ({
        playerId: String(row.player_id),
        player: String(row.player_display_name),
        team: String(row.recent_team),
        headshot: row.headshot_url,
        teamColor: colorByTeam.get(String(row.recent_team)) ?? "var(--accent)",
        stats: active.toStats(row),
      }))
      .sort((a, b) => (sortDesc ? b.stats[sortKey] - a.stats[sortKey] : a.stats[sortKey] - b.stats[sortKey]))
      .map((row, index) => ({ ...row, rank: index + 1 })) ?? null

  function table(rows: DetailedLeaderRow[]) {
    return (
      <DetailedLeaderTable
        entityLabel="Player"
        renderEntity={(row) => <PlayerCell row={row} />}
        columns={active.columns}
        rows={rows}
        sortKey={sortKey}
        sortDesc={sortDesc}
        onSort={handleSort}
      />
    )
  }

  const top = ranked?.slice(0, LEADER_ROWS_SHOWN)

  // Compared on shared places, not `rank`, so ties don't read as movement.
  const headline = active.defaultSortKey
  const currentRanks = ranked && competitionRanks(new Map(ranked.map((row) => [row.playerId, row.stats[headline]])))
  const lastWeekRanks =
    ranked &&
    weekly.data &&
    latestWeek.data &&
    previousRanks(
      active,
      ranked.map((row) => row.playerId),
      weekly.data,
      latestWeek.data.week,
    )

  return (
    <>
      <Panel
        title={showcase ? `Leaders - ${active.defaultSortLabel}` : `${active.label} Leaders`}
        titleHref={showcase ? `/players?position=${position}` : undefined}
        actions={
          <div className="flex items-center gap-2">
            {actions}
            {expandable && ranked && (
              <ExpandButton
                label={`Show all ${positionPlural(position)}`}
                expanded={expanded}
                onClick={() => setExpanded(true)}
              />
            )}
          </div>
        }
      >
        {loading && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
        {error && <p className="p-4 text-sm text-[var(--negative)]">Couldn't load leaders: {error}</p>}
        {top && showcase && (
          <div className="flex flex-wrap justify-center gap-1 p-3">
            {top.map((row) => (
              <LeaderCard
                key={row.playerId}
                row={row}
                statKey={headline}
                rank={currentRanks!.get(row.playerId)!}
                previousRank={lastWeekRanks?.get(row.playerId)}
              />
            ))}
          </div>
        )}
        {top && !showcase && <div className="overflow-x-auto">{table(top)}</div>}
      </Panel>
      {expanded && ranked && (
        <Modal title={`${active.label} Leaders`} onClose={() => setExpanded(false)}>
          <div className="overflow-x-auto">{table(ranked)}</div>
        </Modal>
      )}
    </>
  )
}

export default StatLeadersPanel
