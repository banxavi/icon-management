import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function AuthShell({
  children,
  panel,
  className,
}: {
  children: ReactNode
  panel?: ReactNode
  className?: string
}) {
  return (
    <main className={cn('relative flex min-h-dvh items-center justify-center overflow-hidden p-4', className)}>
      <div className="pointer-events-none absolute inset-0 bg-app-atmosphere" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-grid-fade opacity-60" aria-hidden />
      <div
        className={cn(
          'relative z-10 grid w-full overflow-hidden rounded-3xl border border-border/70 bg-card/95 shadow-xl backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out',
          panel ? 'max-w-5xl md:grid-cols-2' : 'max-w-md',
        )}
      >
        {panel}
        <div className="bg-card">{children}</div>
      </div>
    </main>
  )
}

export function AuthBrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-sidebar p-10 text-sidebar-foreground md:flex md:flex-col md:justify-between">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(18,145,255,0.35),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(28,172,255,0.22),transparent_50%)]" aria-hidden />
      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-sidebar-primary font-display text-lg font-bold text-sidebar-primary-foreground">I</div>
          <span className="font-display text-sm font-semibold tracking-wide">ICON TEAM 1</span>
        </div>
        <div className="mt-24">
          <p className="text-xs font-semibold uppercase text-sidebar-primary">Team portal</p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-balance">
            Clear work.
            <br />
            A clear day.
          </h1>
          <p className="mt-5 max-w-sm text-sm text-pretty text-sidebar-foreground/70">
            One place for the team to submit daily reports and stay in sync.
          </p>
        </div>
      </div>
      <p className="relative text-sm text-sidebar-foreground/50">© 2026 ICON Team 1</p>
    </div>
  )
}
