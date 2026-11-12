import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Surface({
  children,
  className,
  interactive = false,
}: {
  children: ReactNode
  className?: string
  interactive?: boolean
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-border/70 bg-card/90 text-card-foreground shadow-sm backdrop-blur-sm',
        interactive && 'transition-transform duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function SurfaceHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-balance text-foreground">{title}</h2>
        {description ? <p className="mt-1 text-sm text-pretty text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </div>
  )
}

export function SurfaceBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('p-5', className)}>{children}</div>
}
