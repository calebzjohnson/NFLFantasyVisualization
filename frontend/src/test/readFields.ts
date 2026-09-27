// readFields.ts
// Test helper: which row fields a stat function reads, via a recording Proxy.
export function readFields<Row>(statFn: (row: Row) => unknown): string[] {
  const read = new Set<string>()
  const row = new Proxy(
    {},
    {
      get: (_, key) => {
        if (typeof key === "string") read.add(key)
        return 1
      },
    },
  )
  statFn(row as Row)
  return [...read]
}
