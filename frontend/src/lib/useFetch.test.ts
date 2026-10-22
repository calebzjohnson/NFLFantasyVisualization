// useFetch.test.ts
// Tests for useFetch/useFetchAll: loading/data/error states, the per-path cache, and in-flight request sharing.
import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchJson } from "./api"
import { useFetch, useFetchAll } from "./useFetch"

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

  it("shares one request between hooks that mount before it resolves", async () => {
    mockFetchJson.mockResolvedValue("shared")
    const { result } = renderHook(() => [useFetch<string>("/shared"), useFetch<string>("/shared")])

    await waitFor(() => expect(result.current.map((state) => state.data)).toEqual(["shared", "shared"]))
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

describe("useFetchAll", () => {
  beforeEach(() => {
    mockFetchJson.mockReset()
  })

  it("exposes every path's data in order once all arrive, sharing the cache with useFetch", async () => {
    mockFetchJson.mockImplementation(async (path: string) => path.toUpperCase())
    const { result } = renderHook(() => useFetchAll<string>(["/all-a", "/all-b"]))

    await waitFor(() => expect(result.current.data).toEqual(["/ALL-A", "/ALL-B"]))
    expect(renderHook(() => useFetch<string>("/all-b")).result.current.data).toBe("/ALL-B")
    expect(mockFetchJson).toHaveBeenCalledTimes(2)
  })

  it("is done at once for no paths", () => {
    const { result } = renderHook(() => useFetchAll([]))

    expect(result.current).toEqual({ data: [], error: null, loading: false })
  })

  it("reports a failing path's error", async () => {
    mockFetchJson.mockImplementation(async (path: string) => {
      if (path === "/all-bad") throw new Error("Request to /all-bad failed (404)")
      return path
    })
    const { result } = renderHook(() => useFetchAll(["/all-ok", "/all-bad"]))

    await waitFor(() => expect(result.current.error).toBe("Request to /all-bad failed (404)"))
    expect(result.current.data).toBeNull()
  })

  it("with keepPrevious, keeps the last data while a changed set of paths loads", async () => {
    let resolve: (value: string) => void = () => {}
    mockFetchJson.mockImplementation(async (path: string) =>
      path === "/keep-b" ? new Promise<string>((r) => (resolve = r)) : path,
    )
    const { result, rerender } = renderHook(({ paths }) => useFetchAll<string>(paths, { keepPrevious: true }), {
      initialProps: { paths: ["/keep-a"] },
    })
    await waitFor(() => expect(result.current.data).toEqual(["/keep-a"]))

    rerender({ paths: ["/keep-a", "/keep-b"] })
    expect(result.current).toEqual({ data: ["/keep-a"], error: null, loading: true })

    resolve("/keep-b")
    await waitFor(() => expect(result.current.data).toEqual(["/keep-a", "/keep-b"]))
    expect(result.current.loading).toBe(false)
  })
})
