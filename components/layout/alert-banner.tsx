import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const tones = {
  info: 'bg-sky-50 text-sky-900 border-sky-200',
  success: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  warning: 'bg-amber-50 text-amber-950 border-amber-200',
  danger: 'bg-red-50 text-red-800 border-red-200',
} as const

export function AlertBanner({
  tone = 'info',
  children,
  icon,
  className,
}: {
  tone?: keyof typeof tones
  children: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm text-pretty', tones[tone], className)} role="status">
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
