// render.tsx
// Test render helpers: renderWithRouter for anything that links, and mockApi to answer fetchJson by path.
import { render } from "@testing-library/react"
import type { ReactElement } from "react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { vi } from "vitest"
import { fetchJson } from "../lib/api"

// Renders `ui` inside a router at `route`. Pass `path` (e.g. "/teams/:teamAbbr")
// when the component reads URL params.
export function renderWithRouter(ui: ReactElement, { route = "/", path }: { route?: string; path?: string } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {path ? (
        <Routes>
          <Route path={path} element={ui} />
        </Routes>
      ) : (
        ui
      )}
    </MemoryRouter>,
  )
}

// Answers fetchJson calls from a path -> response map; unknown paths fail
// like a 404. The test file must also call vi.mock("../lib/api", ...) (with
// its own relative path) so fetchJson is a mock. Note useFetch caches
// responses per path for the whole test file.
export function mockApi(responses: Record<string, unknown>) {
  vi.mocked(fetchJson).mockImplementation(async (path: string) => {
    if (path in responses) return responses[path]
    throw new Error(`Request to ${path} failed (404)`)
  })
}
