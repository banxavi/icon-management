import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border/80 bg-background/60 px-6 py-10', className)}>
      <h2 className="font-display text-lg font-semibold text-balance text-foreground">{title}</h2>
      {description ? <p className="max-w-md text-sm text-pretty text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  )
}
