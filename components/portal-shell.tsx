'use client'

// Story: REP-01
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, ChevronDown, ClipboardCheck, FileClock, LayoutDashboard, Menu, Settings, Users, X, FolderOpen, Megaphone } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { Role } from '@/lib/mock-data'
import { vi } from '@/lib/i18n/vi'

const nav = [
  { href: '/dashboard', label: vi.dashboard, icon: LayoutDashboard, roles: ['Member', 'Team Leader', 'Reviewer', 'Admin'] },
  { href: '/reports/daily/new', label: vi.dailyReport, icon: ClipboardCheck, roles: ['Member', 'Team Leader', 'Reviewer', 'Admin'] },
  { href: '/reports/weekly/new', label: vi.weeklyReport, icon: FileClock, roles: ['Member', 'Team Leader', 'Reviewer', 'Admin'] },
  { href: '/reports/history', label: vi.history, icon: FileClock, roles: ['Member', 'Team Leader', 'Reviewer', 'Admin'] },
  { href: '/team', label: vi.team, icon: Users, roles: ['Team Leader', 'Reviewer', 'Admin'] },
  { href: '/team/dashboard', label: 'Tổng quan team', icon: LayoutDashboard, roles: ['Team Leader', 'Reviewer', 'Admin'] },
  { href: '/team/reports/weekly', label: 'Báo cáo tuần team', icon: FileClock, roles: ['Team Leader', 'Reviewer', 'Admin'] },
  { href: '/team/calendar', label: 'Lịch làm việc', icon: Users, roles: ['Team Leader', 'Reviewer', 'Admin'] },
  { href: '/requests', label: 'Yêu cầu hỗ trợ', icon: ClipboardCheck, roles: ['Member', 'Team Leader', 'Reviewer', 'Admin'] },
  { href: '/documents', label: 'Tài liệu', icon: FolderOpen, roles: ['Member', 'Team Leader', 'Reviewer', 'Admin'] },
  { href: '/team/directory', label: 'Danh bạ team', icon: Users, roles: ['Team Leader', 'Reviewer', 'Admin'] },
  { href: '/notifications', label: 'Thông báo', icon: Bell, roles: ['Member', 'Team Leader', 'Reviewer', 'Admin'] },
  { href: '/announcements', label: 'Thông báo chung', icon: Megaphone, roles: ['Team Leader', 'Reviewer', 'Admin'] },
  { href: '/admin', label: 'Quản trị', icon: Settings, roles: ['Admin'] },
]

export function PortalShell({ children, role, onRoleChange }: { children: React.ReactNode; role: Role; onRoleChange: (role: Role) => void }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  return <div className="min-h-screen bg-[#f4faff] text-[#0b5fa8]">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[linear-gradient(249.62deg,#1291ff_2.28%,#1cacff_98.16%)] text-white transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-20 items-center justify-between px-6"><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-xl bg-[#1cacff] font-bold text-[#0b5fa8]">I</div><div><p className="text-sm font-semibold tracking-wide">ICON TEAM 1</p><p className="text-xs text-slate-300">Internal portal</p></div></div><button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Đóng menu"><X /></button></div>
      <Separator className="bg-white/10" />
      <nav className="flex flex-1 flex-col gap-1 px-3 py-5">{nav.filter(item => item.roles.includes(role)).map(item => { const Icon = item.icon; const active = pathname === item.href; return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm leading-5 transition ${active ? 'bg-white text-[#0b5fa8] font-semibold shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}><span className="flex size-5 shrink-0 items-center justify-center"><Icon className="size-4" /></span><span className="min-w-0 truncate">{item.label}</span></Link> })}</nav>
      <div className="border-t border-white/10 p-4"><div className="rounded-xl bg-white/10 p-3"><p className="text-xs font-medium text-slate-200">Tuần này</p><p className="mt-1 text-sm">4/5 báo cáo đã nộp</p><div className="mt-3 h-1.5 rounded-full bg-white/20"><div className="h-full w-4/5 rounded-full bg-[#1cacff]" /></div></div></div>
    </aside>
    {open && <button className="fixed inset-0 z-30 bg-black/20 lg:hidden" aria-label="Đóng menu" onClick={() => setOpen(false)} />}
    <div className="lg:pl-64"><header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200 bg-[#f4faff]/95 px-4 backdrop-blur md:px-8"><div className="flex items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Mở menu"><Menu /></Button><div><p className="text-sm text-slate-500">Thứ Sáu, 24 tháng 10, 2026</p><p className="font-semibold">Chào buổi sáng, Minh Anh</p></div></div><div className="flex items-center gap-3"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="hidden gap-2 bg-white sm:flex"><span className="text-xs text-slate-500">{vi.role}</span><Badge variant="secondary">{role}</Badge><ChevronDown className="size-3" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{(['Member', 'Team Leader', 'Reviewer', 'Admin'] as Role[]).map(item => <DropdownMenuItem key={item} onClick={() => onRoleChange(item)}>{item}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="relative" aria-label="Thông báo"><Bell /><span className="absolute right-2 top-2 size-2 rounded-full bg-[#1cacff]" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-80"><DropdownMenuItem asChild><Link href="/notifications" className="flex flex-col items-start gap-1"><span className="font-medium">Bạn cần xác nhận đã đọc</span><span className="text-xs text-slate-500">Quy chế WFH vừa được cập nhật</span></Link></DropdownMenuItem><DropdownMenuItem asChild><Link href="/notifications" className="flex flex-col items-start gap-1"><span className="font-medium">Báo cáo daily đã được ghi nhận</span><span className="text-xs text-slate-500">10 phút trước</span></Link></DropdownMenuItem></DropdownMenuContent></DropdownMenu><Avatar className="size-9 bg-[#dce6f1]"><AvatarFallback className="bg-[#dce6f1] text-xs font-semibold text-[#0b5fa8]">MA</AvatarFallback></Avatar></div></header><main className="mx-auto max-w-7xl p-4 md:p-8">{children}</main></div>
  </div>
}
