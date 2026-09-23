// useFetch.ts
// React hook that GETs a backend path and exposes data/loading/error. Caches
// each successful response in memory, keyed by path, for the life of the
// page - so switching back to an already-fetched path (e.g. toggling the
// position-group filter back to one you've already viewed) shows instantly
// instead of re-fetching and re-loading every image on the page again.
import { useEffect, useState } from "react"
import { fetchJson } from "./api"

interface FetchState<T> {
  data: T | null
  error: string | null
  loading: boolean
}

const cache = new Map<string, unknown>()

function stateForPath<T>(path: string | null): FetchState<T> {
  if (path === null) return { data: null, error: null, loading: true }
  if (cache.has(path)) {
    return { data: cache.get(path) as T, error: null, loading: false }
  }
  return { data: null, error: null, loading: true }
}

// path may be null for "don't fetch yet" - e.g. a second fetch whose URL
// depends on a value from a first fetch that hasn't resolved. Stays in a
// permanent loading state (never errors) until given a real path.
export function useFetch<T>(path: string | null): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>(() => stateForPath<T>(path))

  // Reset synchronously during render when `path` changes, rather than in the
  // effect below — this is React's documented pattern for "state that depends
  // on a prop," and avoids briefly showing the previous path's stale result.
  const [trackedPath, setTrackedPath] = useState(path)
  if (path !== trackedPath) {
    setTrackedPath(path)
    setState(stateForPath<T>(path))
  }

  useEffect(() => {
    if (path === null) return
    if (cache.has(path)) return // already have it - nothing to fetch

    let cancelled = false

    fetchJson<T>(path)
      .then((data) => {
        cache.set(path, data)
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
  }, [path])

  return state
}
