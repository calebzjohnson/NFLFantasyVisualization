// SearchBar.tsx
// Placeholder search input; not wired to search yet.
interface SearchBarProps {
  placeholder: string
}

// Not yet wired to search logic — visual placeholder until the backend search endpoint exists.
function SearchBar({ placeholder }: SearchBarProps) {
  return (
    <input
      type="search"
      placeholder={placeholder}
      className="w-full max-w-sm rounded-md border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-2 focus:outline-[var(--accent)]"
    />
  )
}

export default SearchBar
