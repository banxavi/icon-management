export default function PortalLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-8 w-56 animate-pulse rounded bg-muted" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted" />
      </div>
      <div className="h-48 animate-pulse rounded-2xl bg-muted/70" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-32 animate-pulse rounded-2xl bg-muted/70" />
        <div className="h-32 animate-pulse rounded-2xl bg-muted/70" />
      </div>
      <span className="sr-only">Loading page</span>
    </div>
  )
}
