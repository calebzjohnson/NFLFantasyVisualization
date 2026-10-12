// setup.ts
// Vitest setup: jest-dom matchers (toBeInTheDocument, ...), DOM cleanup between tests, and a desktop-sized matchMedia.
import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

afterEach(cleanup)

// jsdom has no matchMedia. Default every query to "doesn't match" (a desktop
// screen); tests that need a phone stub their own with vi.stubGlobal.
window.matchMedia = (query: string) =>
  ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }) as unknown as MediaQueryList
