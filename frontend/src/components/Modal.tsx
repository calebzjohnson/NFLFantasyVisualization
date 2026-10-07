// Modal.tsx
// Centered overlay dialog, portalled to document.body so it escapes the
// app's max-width column and Panel's overflow-hidden. Closes on Escape, on a
// backdrop click, and from its own close button.
import { type ReactNode, useEffect, useId, useRef } from "react"
import { createPortal } from "react-dom"

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  // Where focus came from, so closing returns it there rather than to the top
  // of the document.
  const openerRef = useRef<Element | null>(null)

  useEffect(() => {
    openerRef.current = document.activeElement
    panelRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)

    const { overflow } = document.body.style
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = overflow
      ;(openerRef.current as HTMLElement | null)?.focus?.()
    }
  }, [onClose])

  return createPortal(
    <div
      // Navbar sits at z-20, so this has to clear it.
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      // mousedown, not click: a drag that starts inside the panel and releases
      // on the backdrop would otherwise close the dialog.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-1)] shadow-2xl shadow-black/50 outline-none"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
          <h2
            id={titleId}
            className="flex items-center gap-2 font-display text-lg font-bold tracking-wider text-[var(--text-primary)] uppercase"
          >
            <span className="h-4 w-1 rounded-sm bg-[var(--accent)]" aria-hidden="true" />
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer px-1 text-lg leading-none text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export default Modal
