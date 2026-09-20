// useFetch.ts
// React hook that GETs a backend path and exposes data/loading/error.
import { useEffect, useState } from "react"
import { fetchJson } from "./api"

interface FetchState<T> {
  data: T | null
  error: string | null
  loading: boolean
}

export function useFetch<T>(path: string): FetchState<T> {
  const initialState: FetchState<T> = { data: null, error: null, loading: true }
  const [state, setState] = useState<FetchState<T>>(initialState)

  // Reset synchronously during render when `path` changes, rather than in the
  // effect below — this is React's documented pattern for "state that depends
  // on a prop," and avoids briefly showing the previous path's stale result.
  const [trackedPath, setTrackedPath] = useState(path)
  if (path !== trackedPath) {
    setTrackedPath(path)
    setState(initialState)
  }

  useEffect(() => {
    let cancelled = false

    fetchJson<T>(path)
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
  }, [path])

  return state
}
