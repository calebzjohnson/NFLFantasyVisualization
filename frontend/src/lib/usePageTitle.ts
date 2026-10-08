// usePageTitle.ts
// Sets the browser tab title for a route: "<page> · Plot the Pigskin", or just the site name when page is null.
import { useEffect } from "react"
import { SITE_NAME } from "./site"

export function usePageTitle(page: string | null | undefined) {
  useEffect(() => {
    document.title = page ? `${page} · ${SITE_NAME}` : SITE_NAME
  }, [page])
}
