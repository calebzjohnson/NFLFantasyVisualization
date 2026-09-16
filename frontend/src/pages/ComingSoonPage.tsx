interface ComingSoonPageProps {
  title: string
}

function ComingSoonPage({ title }: ComingSoonPageProps) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">{title}</h1>
      <p className="mt-2 text-[var(--text-secondary)]">Coming soon.</p>
    </div>
  )
}

export default ComingSoonPage
