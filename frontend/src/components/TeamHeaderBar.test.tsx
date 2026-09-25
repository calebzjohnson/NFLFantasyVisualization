// TeamHeaderBar.test.tsx
// Tests for the team page header: name, record and division place, and points facts.
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { teamInfo, teamRecord } from "../test/fixtures"
import TeamHeaderBar from "./TeamHeaderBar"

const team = teamInfo("BUF", { team_name: "Buffalo Bills" })

describe("TeamHeaderBar", () => {
  it("shows the name, record, and division place", () => {
    const record = teamRecord("BUF", { wins: 2, losses: 1, points_for: 77, points_against: 62 })
    render(<TeamHeaderBar team={team} standing={{ record, division: "AFC East", place: 1 }} />)

    expect(screen.getByRole("heading", { name: "Buffalo Bills" })).toBeInTheDocument()
    expect(screen.getByText("2-1 · 1st in AFC East")).toBeInTheDocument()
    expect(screen.getByText("77")).toBeInTheDocument()
    expect(screen.getByText("+15")).toBeInTheDocument()
  })

  it("shows a negative point differential with a minus sign", () => {
    const record = teamRecord("BUF", { points_for: 10, points_against: 18 })
    render(<TeamHeaderBar team={team} standing={{ record, division: "AFC East", place: 4 }} />)
    expect(screen.getByText("−8")).toBeInTheDocument()
  })

  it("still shows the name before the season has standings", () => {
    render(<TeamHeaderBar team={team} standing={null} />)
    expect(screen.getByRole("heading", { name: "Buffalo Bills" })).toBeInTheDocument()
    expect(screen.queryByText("Record")).not.toBeInTheDocument()
  })
})
