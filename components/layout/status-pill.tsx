import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const tones = {
  neutral: 'bg-muted text-muted-foreground border-border',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  accent: 'bg-primary/10 text-primary border-primary/20',
} as const

export function StatusPill({
  children,
  tone = 'neutral',
  className,
  dot,
}: {
  children: ReactNode
  tone?: keyof typeof tones
  className?: string
  dot?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium', tones[tone], className)}>
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  )
}
