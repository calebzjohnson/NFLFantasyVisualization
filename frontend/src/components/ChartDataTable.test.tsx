// ChartDataTable.test.tsx
// Tests that a chart's data table has a named caption, column and row headers, and dashes for missing values.
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import ChartDataTable from "./ChartDataTable"

describe("ChartDataTable", () => {
  it("renders the rows under a 'Show data as table' toggle", () => {
    render(
      <ChartDataTable
        caption="Ranks"
        columns={["Stat", "Value", "Percentile"]}
        rows={[
          ["Yards", 120, "80th"],
          ["TDs", null, null],
        ]}
      />,
    )

    expect(screen.getByText("Show data as table")).toBeInTheDocument()
    const table = screen.getByRole("table", { name: "Ranks" })
    expect(within(table).getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
      "Stat",
      "Value",
      "Percentile",
    ])
    expect(within(table).getByRole("rowheader", { name: "Yards" })).toBeInTheDocument()
    expect(within(table).getAllByRole("cell").map((td) => td.textContent)).toEqual(["120", "80th", "—", "—"])
    // Long tables scroll; the scroll area must be reachable by keyboard.
    expect(screen.getByRole("region", { name: "Ranks" })).toHaveAttribute("tabindex", "0")
  })
})
