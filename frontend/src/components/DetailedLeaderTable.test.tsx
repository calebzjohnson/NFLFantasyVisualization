// DetailedLeaderTable.test.tsx
// Tests for the ranked leader table: caller-rendered name cells, stat cells, and sort headers.
import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import DetailedLeaderTable from "./DetailedLeaderTable"

const columns = [
  { key: "yards", label: "YARDS" },
  { key: "td", label: "TD" },
]
const rows = [
  { rank: 1, name: "First", stats: { yards: 300, td: 3 } },
  { rank: 2, name: "Second", stats: { yards: 200, td: 1 } },
]

function renderTable(onSort = vi.fn()) {
  render(
    <DetailedLeaderTable
      entityLabel="Thing"
      renderEntity={(row) => <span>{row.name}</span>}
      columns={columns}
      rows={rows}
      sortKey="yards"
      sortDesc
      onSort={onSort}
    />,
  )
  return onSort
}

describe("DetailedLeaderTable", () => {
  it("renders one row per leader with the caller's name cell and its stats", () => {
    renderTable()
    const [header, first] = screen.getAllByRole("row")

    expect(within(header).getByText("Thing")).toBeInTheDocument()
    expect(within(first).getByText("First")).toBeInTheDocument()
    expect(within(first).getByText("300")).toBeInTheDocument()
    expect(screen.getAllByRole("row")).toHaveLength(3)
  })

  it("marks the active sort column and reports header clicks", () => {
    const onSort = renderTable()

    expect(screen.getByRole("button", { name: /YARDS/ })).toHaveTextContent("YARDS▼")
    fireEvent.click(screen.getByRole("button", { name: /TD/ }))
    expect(onSort).toHaveBeenCalledWith("td")
  })
})
