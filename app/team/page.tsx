'use client'
// Story: TEAM-01
import { Search, UserPlus } from 'lucide-react'
import { PortalProvider } from '@/components/portal-provider'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { members } from '@/lib/mock-data'
export default function TeamPage() { return <PortalProvider><div className="flex flex-col gap-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-[#e2894b]">TEAM DIRECTORY</p><h1 className="mt-1 text-3xl font-semibold">Thành viên team</h1><p className="mt-2 text-slate-500">17 thành viên trong ICON Team 1.</p></div><Button className="gap-2 bg-[#1b2a41] hover:bg-[#263b59]"><UserPlus className="size-4" />Mời thành viên</Button></div><Card className="border-0 shadow-sm"><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Danh sách thành viên</CardTitle><div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-slate-400" /><Input placeholder="Tìm thành viên..." className="w-56 pl-9" /></div></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{members.map(member => <div key={member.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-4"><Avatar className="size-10 bg-[#dce6f1]"><AvatarFallback className="bg-[#dce6f1] text-xs font-semibold text-[#1b2a41]">{member.initials}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate font-medium">{member.name}</p><Badge variant="outline" className="mt-1 text-[11px]">{member.role}</Badge></div></div>)}</div></CardContent></Card></div></PortalProvider> }
