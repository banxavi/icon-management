'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, ClipboardCheck, FileClock, FolderOpen, LayoutDashboard, LogOut, Megaphone, Menu, Settings, Users, X } from 'lucide-react'
import { useState } from 'react'
import { signOut } from '@/app/actions/auth'
import { NotificationBell } from '@/components/notification-bell'
import type { Notice } from '@/components/notification-center'
import { useSession } from '@/components/portal-provider'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { canSubmitReport, canViewTeamDashboard, primaryRole, roleLabel } from '@/lib/auth/permissions'
import { formatLongDate, greetingFor } from '@/lib/reports/window'
import type { SessionUser } from '@/lib/types'

const items = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, allow: () => true },
  { href: '/reports/daily/new', label: 'Daily report', icon: ClipboardCheck, allow: (session: SessionUser) => canSubmitReport(session.roles) },
  { href: '/reports/weekly/new', label: 'Weekly report', icon: FileClock, allow: (session: SessionUser) => canSubmitReport(session.roles) },
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

  return (
    <div className="min-h-screen bg-[#f4faff] text-[#0b5fa8]">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[linear-gradient(249.62deg,#1291ff_2.28%,#1cacff_98.16%)] text-white transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-20 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#1cacff] font-bold text-[#0b5fa8]">I</div>
            <div>
              <p className="text-sm font-semibold tracking-wide">ICON TEAM 1</p>
              <p className="text-xs text-slate-300">Internal portal</p>
            </div>
          </div>
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu" type="button"><X /></button>
        </div>
        <Separator className="bg-white/10" />
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-5">
          {items.filter((item) => item.allow(session)).map((item) => {
            const Icon = item.icon
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm leading-5 transition ${active ? 'bg-white font-semibold text-[#0b5fa8] shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
                <Icon className="size-4 shrink-0" />
                <span className="min-w-0 truncate">{item.label}</span>
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="rounded-xl bg-white/10 p-3">
            <p className="text-xs font-medium text-slate-200">This week</p>
            <p className="mt-1 text-sm">{weekSubmitted}/5 reports submitted</p>
            <div className="mt-3 h-1.5 rounded-full bg-white/20">
              <div className="h-full rounded-full bg-[#1cacff]" style={{ width: `${Math.min(100, (weekSubmitted / 5) * 100)}%` }} />
            </div>
          </div>
        </div>
      </aside>
      {open && <button className="fixed inset-0 z-30 bg-black/20 lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)} type="button" />}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200 bg-[#f4faff]/95 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></Button>
            <div>
              <p className="text-sm text-slate-500">{formatLongDate(new Date())}</p>
              <p className="font-semibold">{greetingFor(session.fullName, new Date())}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">{role}</Badge>
            <NotificationBell unreadCount={unreadCount} notices={notices} />
            <DropdownMenu>
              <DropdownMenuTrigger aria-label="Account menu" className="rounded-full">
                <Avatar className="size-9 bg-[#dce6f1]">
                  <AvatarFallback className="bg-[#dce6f1] text-xs font-semibold text-[#0b5fa8]">{initials}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
