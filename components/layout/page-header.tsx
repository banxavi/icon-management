import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0 max-w-3xl">
        {eyebrow ? <p className="text-xs font-semibold uppercase text-primary">{eyebrow}</p> : null}
        <h1 className="mt-2 font-display text-3xl font-semibold text-balance text-foreground md:text-[2rem]">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-pretty text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
