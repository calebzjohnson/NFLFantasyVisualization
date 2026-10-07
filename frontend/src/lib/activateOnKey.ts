// activateOnKey.ts
// Keyboard handler for non-<button> elements with role="button" (chart markers): Enter or Space activates, like a native button.
import type { KeyboardEvent } from "react"

export function activateOnKey(action: () => void) {
  return (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault() // Space would otherwise scroll the page
      action()
    }
  }
}
