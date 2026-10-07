// AboutPage.tsx
// About route: why the site exists, who built it, what's new, data source and freshness, stack, feedback, disclaimers.
import type { ReactNode } from "react"
import Panel from "../components/Panel"
import { useFetch } from "../lib/useFetch"
import { usePageTitle } from "../lib/usePageTitle"

const DEVELOPERS = [
  { name: "Caleb Johnson", github: "calebzjohnson" },
  { name: "Will Taggard", github: "willtaggard" },
] as const

// Placeholder until the real inbox exists - see DEPLOYMENT_NOTES.md.
const FEEDBACK_EMAIL = "feedback@example.com"

// Newest first. Add an entry here with each release.
const RELEASES = [
  {
    version: "v1",
    date: "October 2026",
    notes: [
      "Home page with weekly scores, division standings, stat leaders, and trending players.",
      "Team pages with scoring breakdowns, team radar charts, and league-wide efficiency comparisons.",
      "Player pages with game logs, position-specific radar charts, and usage share over the season.",
      "Defensive players grouped by the role they actually play (edge rusher, interior line, linebacker, cornerback, safety), each with their own radar chart.",
      "Search across every team and player.",
    ],
  },
] as const

const STACK = [
  { name: "React", href: "https://react.dev", role: "user interface" },
  { name: "Recharts", href: "https://recharts.org", role: "charts" },
  { name: "Tailwind CSS", href: "https://tailwindcss.com", role: "styling" },
  { name: "FastAPI", href: "https://fastapi.tiangolo.com", role: "Python backend" },
  { name: "nflreadpy", href: "https://github.com/nflverse/nflreadpy", role: "data loading" },
] as const

interface LatestWeek {
  season: number
  week: number
  season_type: string
}

function freshnessLabel({ season, week, season_type }: LatestWeek): string {
  return season_type === "REG"
    ? `Stats through Week ${week} of the ${season} season.`
    : `Stats through the ${season} postseason.`
}

const linkClass = "text-[var(--accent)] hover:underline"

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
      {children}
    </a>
  )
}

function AboutPage() {
  usePageTitle("About")
  const latest = useFetch<LatestWeek>("/players/latest-week")

  return (
    <div className="flex flex-col gap-6 text-[var(--text-secondary)]">
      <h1 className="font-display text-3xl font-bold tracking-wide text-[var(--text-primary)] uppercase">
        About
      </h1>

      <Panel title="Why we built this">
        <div className="flex flex-col gap-3 p-4">
          <p>
            We got tired of sports data sites that just hand you numbers in a table. A table can tell you a
            player had 7 targets last week, but it can't easily show you whether that's a trend, how it stacks
            up against the rest of the league, or how their role is changing over time.
          </p>
          <p>
            We're math and computer science students, and we built Plot the Pigskin to turn those numbers
            into visualizations that help fantasy managers actually understand player performance - usage,
            efficiency, and trends - at a glance.
          </p>
        </div>
      </Panel>

      <Panel title="Who we are">
        <ul className="grid gap-3 p-4 sm:grid-cols-2">
          {DEVELOPERS.map(({ name, github }) => (
            <li key={github} className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3">
              <p className="font-semibold text-[var(--text-primary)]">{name}</p>
              <ExternalLink href={`https://github.com/${github}`}>@{github} on GitHub</ExternalLink>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="What's new">
        <ol className="flex flex-col gap-4 p-4">
          {RELEASES.map(({ version, date, notes }) => (
            <li key={version}>
              <p className="font-semibold text-[var(--text-primary)]">
                {version} <span className="font-normal text-[var(--text-muted)]">· {date}</span>
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="Where the data comes from">
        <div className="flex flex-col gap-3 p-4">
          {latest.data && <p className="font-semibold text-[var(--text-primary)]">{freshnessLabel(latest.data)}</p>}
          <p>
            All stats come from <ExternalLink href="https://github.com/nflverse">nflverse</ExternalLink>, an
            open-source project that publishes NFL play-by-play, weekly player and team stats, depth charts,
            Next Gen Stats, and Pro Football Reference advanced stats. We load it with{" "}
            <ExternalLink href="https://github.com/nflverse/nflreadpy">nflreadpy</ExternalLink>.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Data refreshes about once a day, so new games usually show up within a day or two.</li>
            <li>
              Advanced defensive stats (pressures, targets against) come from Pro Football Reference and can take a
              few days to arrive, so the most recent week may be incomplete.
            </li>
            <li>Fantasy points use full PPR scoring (one point per reception).</li>
            <li>Player headshots and team logos come from links nflverse provides (hosted by the NFL and ESPN).</li>
          </ul>
          <p>
            A big thank-you to the nflverse maintainers, whose free, open data makes this site possible.
            nflverse data is shared under the{" "}
            <ExternalLink href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0 license</ExternalLink>;
            some of the underlying stats (such as Next Gen Stats and Pro Football Reference) belong to their
            original sources and fall under those sources' terms.
          </p>
        </div>
      </Panel>

      <Panel title="How it's built">
        <ul className="list-disc space-y-1 p-4 pl-9">
          {STACK.map(({ name, href, role }) => (
            <li key={name}>
              <ExternalLink href={href}>{name}</ExternalLink> - {role}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Feedback">
        <p className="p-4">
          Found a bug or have an idea for a feature? Email us at{" "}
          <a href={`mailto:${FEEDBACK_EMAIL}`} className={linkClass}>
            {FEEDBACK_EMAIL}
          </a>
          . We read every message.
        </p>
      </Panel>

      <Panel title="The fine print">
        <div className="flex flex-col gap-3 p-4">
          <p>
            Plot the Pigskin is a free, non-commercial project. We are not affiliated with or endorsed by the
            NFL or any of its teams. Team names and logos belong to their respective owners.
          </p>
          <p>Stats are provided as-is. Use them to inform your decisions, not as a guarantee.</p>
        </div>
      </Panel>
    </div>
  )
}

export default AboutPage
