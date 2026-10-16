// metricGlossary.test.ts
// Checks that every stat in the player and team catalogs has a plain-language explanation, so a new stat can't ship unexplained.
import { describe, expect, it } from "vitest"
import { METRIC_GLOSSARY } from "./metricGlossary"
import { PLAYER_METRICS } from "./playerMetrics"
import { TEAM_METRICS } from "./teamMetrics"

describe("METRIC_GLOSSARY", () => {
  it("explains every catalog stat, and nothing that isn't one", () => {
    const catalogKeys = new Set([...Object.values(PLAYER_METRICS).flat(), ...TEAM_METRICS].map((metric) => metric.key))
    expect([...catalogKeys].filter((key) => !METRIC_GLOSSARY[key])).toEqual([])
    expect(Object.keys(METRIC_GLOSSARY).filter((key) => !catalogKeys.has(key))).toEqual([])
  })
})
