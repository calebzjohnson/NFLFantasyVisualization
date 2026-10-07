// vite.config.test.ts
// Tests that production builds refuse to run without VITE_API_BASE_URL.
import type { ConfigEnv, UserConfigFnObject } from "vite"
import { afterEach, describe, expect, it, vi } from "vitest"
import config from "./vite.config.ts"

const resolve = (env: ConfigEnv) => (config as UserConfigFnObject)(env)
const prodBuild: ConfigEnv = { command: "build", mode: "production" }

describe("vite config", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("fails a production build when VITE_API_BASE_URL is empty", () => {
    vi.stubEnv("VITE_API_BASE_URL", "")
    expect(() => resolve(prodBuild)).toThrow(/VITE_API_BASE_URL/)
  })

  it("allows a production build when VITE_API_BASE_URL is set", () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com")
    expect(() => resolve(prodBuild)).not.toThrow()
  })

  it("does not require the variable for the dev server", () => {
    vi.stubEnv("VITE_API_BASE_URL", "")
    expect(() => resolve({ command: "serve", mode: "development" })).not.toThrow()
  })
})
