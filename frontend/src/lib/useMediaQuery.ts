// useMediaQuery.ts
// Whether a CSS media query matches right now, re-rendering when it starts or stops matching (e.g. a phone rotating).
import { useCallback, useSyncExternalStore } from "react"

// Tailwind's `sm` breakpoint: below it is phone-sized.
export const PHONE_QUERY = "(max-width: 639px)"

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener("change", onChange)
      return () => list.removeEventListener("change", onChange)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}
