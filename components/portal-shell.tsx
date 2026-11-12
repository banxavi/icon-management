'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, ClipboardCheck, FileClock, FolderOpen, LayoutDashboard, LogOut, Megaphone, Menu, Settings, Users, X } from 'lucide-react'
import { useState } from 'react'
import { NotificationBell } from '@/components/notification-bell'
import type { Notice } from '@/components/notification-center'
import { useSession } from '@/components/portal-provider'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { StatusPill } from '@/components/layout'
import { canSubmitReport, canViewTeamDashboard, primaryRole, roleLabel } from '@/lib/auth/permissions'
import { formatLongDate, greetingFor } from '@/lib/reports/window'
import type { SessionUser } from '@/lib/types'
import { cn } from '@/lib/utils'

const items = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, allow: () => true },
  { href: '/reports/daily/new', label: 'Daily report', icon: ClipboardCheck, allow: (session: SessionUser) => canSubmitReport(session.roles) },
  { href: '/reports/weekly', label: 'Weekly report', icon: FileClock, allow: (session: SessionUser) => canSubmitReport(session.roles) },
  { href: '/reports/history', label: 'Report history', icon: FileClock, allow: () => true },
  { href: '/team/directory', label: 'Directory', icon: Users, allow: () => true },
  { href: '/team/dashboard', label: 'Team dashboard', icon: LayoutDashboard, allow: (session: SessionUser) => canViewTeamDashboard(session.roles) },
  { href: '/team/reports/weekly', label: 'Team weekly report', icon: FileClock, allow: (session: SessionUser) => canViewTeamDashboard(session.roles) },
  { href: '/team/calendar', label: 'Team calendar', icon: Users, allow: (session: SessionUser) => canViewTeamDashboard(session.roles) },
  { href: '/requests', label: 'Requests', icon: ClipboardCheck, allow: () => true },
  { href: '/documents', label: 'Documents', icon: FolderOpen, allow: () => true },
  { href: '/notifications', label: 'Notifications', icon: Bell, allow: () => true },
  { href: '/announcements', label: 'Announcements', icon: Megaphone, allow: () => true },
  { href: '/admin', label: 'Admin', icon: Settings, allow: (session: SessionUser) => session.roles.includes('admin') },
]

export function PortalShell({
  children,
  unreadCount,
  weekSubmitted,
  notices,
}: {
  children: React.ReactNode
  unreadCount: number
  weekSubmitted: number
  notices: Notice[]
}) {
  const session = useSession()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const initials = session.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'I'
  const role = roleLabel(primaryRole(session.roles))
  const progress = Math.min(100, (weekSubmitted / 5) * 100)

  return (
    <div className="min-h-dvh text-foreground">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-out lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(18,145,255,0.28),transparent_55%)]" aria-hidden />
        <div className="relative flex h-20 items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary font-display text-sm font-bold text-sidebar-primary-foreground">I</div>
            <div>
              <p className="font-display text-sm font-semibold">ICON TEAM 1</p>
              <p className="text-xs text-sidebar-foreground/60">Internal portal</p>
            </div>
          </div>
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu" type="button">
            <X className="size-5" />
          </button>
        </div>
        <Separator className="relative bg-sidebar-border" />
        <nav className="relative flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-5">
          {items.filter((item) => item.allow(session)).map((item) => {
            const Icon = item.icon
            const active = pathname === item.href || (item.href === '/reports/weekly' && pathname.startsWith('/reports/weekly/'))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm leading-5 transition-colors duration-150 ease-out',
                  active
                    ? 'bg-white font-semibold text-sidebar shadow-sm'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="min-w-0 truncate">{item.label}</span>
              </Link>
            )
          })}
        </nav>
        <div className="relative border-t border-sidebar-border p-4">
          <div className="rounded-xl bg-white/8 p-3 ring-1 ring-white/10">
            <p className="text-xs font-medium text-sidebar-foreground/70">This week</p>
            <p className="mt-1 text-sm tabular-nums">{weekSubmitted}/5 reports submitted</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-sidebar-primary transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </aside>
      {open ? <button className="fixed inset-0 z-30 bg-black/25 lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)} type="button" /> : null}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/70 bg-background/80 px-4 backdrop-blur-md md:h-20 md:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu />
            </Button>
            <div>
              <p className="text-sm text-muted-foreground">{formatLongDate(new Date())}</p>
              <p className="font-display font-semibold text-foreground">{greetingFor(session.fullName, new Date())}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill tone="accent">{role}</StatusPill>
            <NotificationBell unreadCount={unreadCount} notices={notices} />
            <DropdownMenu>
              <DropdownMenuTrigger aria-label="Account menu" className="rounded-full">
                <Avatar className="size-9 bg-secondary">
                  <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">{initials}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className="flex w-full cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground"
                  >
                    <LogOut className="size-4" />
                    Sign out
                  </button>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="page-enter mx-auto max-w-7xl p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:p-8">{children}</main>
      </div>
    </div>
  )
}
