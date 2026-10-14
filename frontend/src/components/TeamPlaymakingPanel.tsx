// TeamPlaymakingPanel.tsx
// The team page's Playmaking tab: how the backfield's touches and the team's
// targets are split, who gets the ball in the red zone, and season leaders.
import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  redZoneShare,
  type LeaderGroup,
  type PlaymakingPlayer,
  type PlaymakingResponse,
  type RedZonePlayer,
} from "../data/playmaking"
import type { TeamInfo } from "../data/teams"
import { buildColorByKey } from "../data/usage"
import { useFetch } from "../lib/useFetch"
import Panel from "./Panel"
import PlayerAvatar from "./PlayerAvatar"
import PositionGroupToggle from "./PositionGroupToggle"
import { UsageDonut, UsageWeeklyChart } from "./TeamUsagePanel"

const VIEWS = ["weekly", "season"] as const
type View = (typeof VIEWS)[number]

// Same card as the home page's Leaders row, without the team abbreviation -
// every player here plays for the team whose page this is.
function PlaymakerCard({
  player,
  rank,
  teamColor,
  headline,
  sub,
}: {
  player: PlaymakingPlayer | RedZonePlayer
  rank: number
  teamColor: string
  headline: string
  sub?: string
}) {
  const name = player.name ?? "Unknown"
  return (
    <Link
      to={`/players/${player.player_id}`}
      state={{ playerName: name }}
      className="flex min-w-0 flex-1 basis-32 flex-col items-center gap-1 rounded-lg px-2 py-3 text-center hover:bg-[var(--surface-2)]"
    >
      <span
        className={`mb-1 font-display text-base ${
          rank === 1 ? "font-bold text-[var(--accent)]" : "text-[var(--text-muted)]"
        }`}
      >
        {rank}
      </span>
      <PlayerAvatar
        name={name}
        headshot={player.headshot_url}
        color={teamColor}
        size="h-20 w-20"
        imageSize={192}
      />
      <span className="mt-1 w-full truncate text-sm font-medium text-[var(--text-primary)]">{name}</span>
      <span className="font-display text-2xl font-bold text-[var(--text-primary)]">{headline}</span>
      {sub && <span className="text-sm font-medium text-[var(--text-secondary)]">{sub}</span>}
    </Link>
  )
}

function UsagePanel({
  usage,
  teamColor,
  teamColor2,
}: {
  usage: PlaymakingResponse["touches"]
  teamColor: string
  teamColor2: string
}) {
  const [view, setView] = useState<View>("weekly")
  const navigate = useNavigate()
  const colorByKey = buildColorByKey(usage, null, teamColor, teamColor2)
  const goToPlayer = (id: string) => navigate(`/players/${id}`)

  return (
    <Panel
      title={usage.label}
      actions={
        <PositionGroupToggle options={VIEWS} active={view} onChange={setView} aria-label="View" />
      }
    >
      {usage.team_value === 0 ? (
        <p className="p-4 text-sm text-[var(--text-secondary)]">Nothing recorded yet this season.</p>
      ) : view === "season" ? (
        <UsageDonut
          playerName={null}
          usage={usage}
          colorByKey={colorByKey}
          onSelect={goToPlayer}
        />
      ) : (
        <UsageWeeklyChart
          playerId={null}
          playerName={null}
          usage={usage}
          colorByKey={colorByKey}
          onSelect={goToPlayer}
        />
      )}
    </Panel>
  )
}

function LeadersPanel({ leaders, teamColor }: { leaders: LeaderGroup[]; teamColor: string }) {
  const [active, setActive] = useState(leaders[0]?.key ?? "")
  const group = leaders.find((entry) => entry.key === active) ?? leaders[0]

  return (
    <Panel
      title="Team Leaders"
      actions={
        <PositionGroupToggle
          options={leaders.map((entry) => entry.key)}
          active={group?.key ?? ""}
          onChange={setActive}
          labelFor={(key) => leaders.find((entry) => entry.key === key)?.label ?? key}
          aria-label="Stat"
        />
      }
    >
      {!group || group.players.length === 0 ? (
        <p className="p-4 text-sm text-[var(--text-secondary)]">Nothing recorded yet this season.</p>
      ) : (
        <div className="flex flex-wrap justify-center gap-2 p-3">
          {group.players.map((player, index) => (
            <PlaymakerCard
              key={player.player_id}
              player={player}
              rank={index + 1}
              teamColor={teamColor}
              headline={String(Math.round(player.value * 10) / 10)}
            />
          ))}
        </div>
      )}
    </Panel>
  )
}

function RedZonePanel({
  redZone,
  teamColor,
}: {
  redZone: PlaymakingResponse["red_zone"]
  teamColor: string
}) {
  const shares = redZoneShare(redZone.total, redZone.players)

  return (
    <Panel title="Red Zone Touches">
      {shares.length === 0 ? (
        <p className="p-4 text-sm text-[var(--text-secondary)]">
          No red zone touches recorded yet this season.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap justify-center gap-2 p-3">
            {shares.map(({ player, pct }, index) => (
              <PlaymakerCard
                key={player.player_id}
                player={player}
                rank={index + 1}
                teamColor={teamColor}
                headline={String(player.touches)}
                sub={`${Math.round(pct)}%`}
              />
            ))}
          </div>
          <p className="px-4 pb-3 text-xs text-[var(--text-muted)]">
            Carries and receptions inside the opponent's 20, out of this team's {redZone.total}.
          </p>
        </>
      )}
    </Panel>
  )
}

// Mounted only while its tab is open, so the other tabs never pay for this
// fetch; useFetch caches per path, so switching back is instant.
function TeamPlaymakingPanel({ teamAbbr }: { teamAbbr: string }) {
  const playmaking = useFetch<PlaymakingResponse>(`/teams/${teamAbbr}/playmaking`)
  const teams = useFetch<TeamInfo[]>("/teams")

  if (playmaking.error) {
    return (
      <Panel title="Playmaking">
        <p className="p-4 text-sm text-[var(--negative)]">
          Couldn't load playmaking: {playmaking.error}
        </p>
      </Panel>
    )
  }
  if (!playmaking.data) {
    return (
      <Panel title="Playmaking">
        <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>
      </Panel>
    )
  }

  const team = teams.data?.find((t) => t.team_abbr === teamAbbr)
  const teamColor = team?.team_color ?? "var(--accent)"
  const teamColor2 = team?.team_color2 ?? "var(--border)"
  const { touches, targets, red_zone, leaders } = playmaking.data

  return (
    <div className="flex flex-col gap-6">
      <LeadersPanel leaders={leaders} teamColor={teamColor} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UsagePanel usage={touches} teamColor={teamColor} teamColor2={teamColor2} />
        <UsagePanel usage={targets} teamColor={teamColor} teamColor2={teamColor2} />
      </div>
      <RedZonePanel redZone={red_zone} teamColor={teamColor} />
    </div>
  )
}

export default TeamPlaymakingPanel
