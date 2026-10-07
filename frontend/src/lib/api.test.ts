// api.test.ts
// Tests for fetchJson's success path and its error messages, including the rate-limit one.
import { afterEach, describe, expect, it, vi } from "vitest"
import { fetchJson } from "./api"

function mockFetch(status: number, body: unknown = {}) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })))
}

describe("fetchJson", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("returns the parsed body on success", async () => {
    mockFetch(200, { status: "ok" })
    await expect(fetchJson("/health")).resolves.toEqual({ status: "ok" })
  })

  it("tells the visitor to wait when rate limited", async () => {
    mockFetch(429)
    await expect(fetchJson("/teams/efficiency")).rejects.toThrow(
      "Too many requests. Wait a minute, then reload the page.",
    )
  })

  it("names the path and status for other errors", async () => {
    mockFetch(500)
    await expect(fetchJson("/standings")).rejects.toThrow("Request to /standings failed (500)")
  })
})
