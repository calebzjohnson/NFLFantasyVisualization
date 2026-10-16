// useFetch.ts
// React hooks that GET one backend path (useFetch) or several (useFetchAll)
// and expose data/loading/error. Caches each successful response in memory,
// keyed by path, for the life of the page - so switching back to an
// already-fetched path (e.g. toggling the position-group filter back to one
// you've already viewed) shows instantly instead of re-fetching and
// re-loading every image on the page again.
import { useEffect, useState } from "react"
import { fetchJson } from "./api"

interface FetchState<T> {
  data: T | null
  error: string | null
  loading: boolean
}

const cache = new Map<string, unknown>()
// Requests still in flight, keyed by path - lets sibling components that
// mount together (e.g. a radar and beeswarm reading the same pool) share one
// request instead of each missing the cache and fetching it again.
const inflight = new Map<string, Promise<unknown>>()

function load<T>(path: string): Promise<T> {
  if (cache.has(path)) return Promise.resolve(cache.get(path) as T)
  let request = inflight.get(path) as Promise<T> | undefined
  if (!request) {
    request = fetchJson<T>(path)
      .then((data) => {
        cache.set(path, data)
        return data
      })
      .finally(() => inflight.delete(path))
    inflight.set(path, request)
  }
  return request
}

// Paths joined into one string, so an effect can depend on the list's
// contents rather than on a caller's array identity (a new array each render).
const SEPARATOR = "\n"

function stateForKey<T>(key: string | null): FetchState<T[]> {
  if (key === null) return { data: null, error: null, loading: true }
  const paths = key === "" ? [] : key.split(SEPARATOR)
  if (paths.every((path) => cache.has(path))) {
    return { data: paths.map((path) => cache.get(path) as T), error: null, loading: false }
  }
  return { data: null, error: null, loading: true }
}

// Every path's response, in order, once all have arrived - for a list of
// paths only known at runtime (e.g. one per player picked). paths may be null
// for "don't fetch yet", which stays loading; an empty list is done at once.
// If any request fails, the whole state carries that error.
export function useFetchAll<T>(paths: string[] | null): FetchState<T[]> {
  const key = paths === null ? null : paths.join(SEPARATOR)
  const [state, setState] = useState<FetchState<T[]>>(() => stateForKey<T>(key))

  // Reset synchronously during render when the paths change, rather than in
  // the effect below — this is React's documented pattern for "state that
  // depends on a prop," and avoids briefly showing the previous paths' stale result.
  const [trackedKey, setTrackedKey] = useState(key)
  if (key !== trackedKey) {
    setTrackedKey(key)
    setState(stateForKey<T>(key))
  }

  useEffect(() => {
    if (key === null || key === "") return
    const keyPaths = key.split(SEPARATOR)
    if (keyPaths.every((path) => cache.has(path))) return // already have them - nothing to fetch

    let cancelled = false
    Promise.all(keyPaths.map((path) => load<T>(path)))
      .then((data) => {
        if (!cancelled) setState({ data, error: null, loading: false })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Request failed"
          setState({ data: null, error: message, loading: false })
        }
      })

    return () => {
      cancelled = true
    }
  }, [key])

  return state
}

// path may be null for "don't fetch yet" - e.g. a second fetch whose URL
// depends on a value from a first fetch that hasn't resolved. Stays in a
// permanent loading state (never errors) until given a real path.
export function useFetch<T>(path: string | null): FetchState<T> {
  const state = useFetchAll<T>(path === null ? null : [path])
  return { ...state, data: state.data?.[0] ?? null }
}
