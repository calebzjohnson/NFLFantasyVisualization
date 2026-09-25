// useFetch.test.ts
// Tests for useFetch's loading/data/error states and its per-path cache.
import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchJson } from "./api"
import { useFetch } from "./useFetch"

vi.mock("./api", () => ({ fetchJson: vi.fn() }))
const mockFetchJson = vi.mocked(fetchJson)

// useFetch's cache lives for the whole test file, so each test uses its own path.
describe("useFetch", () => {
  beforeEach(() => {
    mockFetchJson.mockReset()
  })

  it("starts loading, then exposes the data", async () => {
    mockFetchJson.mockResolvedValue([1, 2, 3])
    const { result } = renderHook(() => useFetch<number[]>("/loads"))

    expect(result.current).toEqual({ data: null, error: null, loading: true })
    await waitFor(() => expect(result.current.data).toEqual([1, 2, 3]))
    expect(result.current.loading).toBe(false)
  })

  it("serves a path it already fetched from cache without refetching", async () => {
    mockFetchJson.mockResolvedValue("first")
    const first = renderHook(() => useFetch<string>("/cached"))
    await waitFor(() => expect(first.result.current.data).toBe("first"))

    const second = renderHook(() => useFetch<string>("/cached"))

    expect(second.result.current).toEqual({ data: "first", error: null, loading: false })
    expect(mockFetchJson).toHaveBeenCalledTimes(1)
  })

  it("exposes the error message when the request fails", async () => {
    mockFetchJson.mockRejectedValue(new Error("Request to /fails failed (500)"))
    const { result } = renderHook(() => useFetch("/fails"))

    await waitFor(() => expect(result.current.error).toBe("Request to /fails failed (500)"))
    expect(result.current.loading).toBe(false)
  })

  it("doesn't fetch a null path", () => {
    const { result } = renderHook(() => useFetch(null))

    expect(result.current.loading).toBe(true)
    expect(mockFetchJson).not.toHaveBeenCalled()
  })
})
