'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { useSession } from '@/components/portal-provider'
import { MockBanner } from '@/components/mock-banner'
import { Forbidden } from '@/components/forbidden'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { canViewTeamDashboard } from '@/lib/auth/permissions'
import { members, projects, requests, teamWeeklySummary } from '@/lib/mock-data'

export function WeeklyTeamReport() {
  const session = useSession()
  const [summary, setSummary] = useState('The team kept a steady pace this week and cleared the main delivery items.')
  if (!canViewTeamDashboard(session.roles)) return <Forbidden />
  return (
    <div className="flex flex-col gap-6">
      <MockBanner />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#e2894b]">TEAM WEEKLY</p>
          <h1 className="mt-1 text-3xl font-semibold">Team weekly report</h1>
          <p className="mt-2 text-slate-500">Sample summary by project. Export is not connected.</p>
        </div>
        <Button variant="outline" className="gap-2" type="button" disabled><Download />Export PDF/Excel</Button>
      </div>
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">Project summary</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs text-slate-500"><tr><th className="px-3 py-3">Project</th><th className="px-3 py-3">Members</th><th className="px-3 py-3">Submitted</th><th className="px-3 py-3">Progress</th><th className="px-3 py-3">Highlight</th></tr></thead>
            <tbody>
              {teamWeeklySummary.map((row) => (
                <tr key={row.project} className="border-b">
                  <td className="px-3 py-4 font-medium">{row.project}</td>
                  <td className="px-3 py-4">{row.members}</td>
                  <td className="px-3 py-4">{row.submitted}/{row.members}</td>
                  <td className="px-3 py-4 font-medium text-[#e2894b]">{row.progress}</td>
                  <td className="px-3 py-4 text-slate-600">{row.highlight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">Leader summary</CardTitle></CardHeader>
        <CardContent><Textarea value={summary} onChange={(event) => setSummary(event.target.value)} readOnly className="min-h-32" /></CardContent>
      </Card>
    </div>
  )
}

export function TeamCalendar() {
  const session = useSession()
  if (!canViewTeamDashboard(session.roles)) return <Forbidden />
  const days = ['Mon 20', 'Tue 21', 'Wed 22', 'Thu 23', 'Fri 24']
  return (
    <div className="flex flex-col gap-6">
      <MockBanner />
      <div>
        <p className="text-sm font-medium text-[#e2894b]">CALENDAR</p>
        <h1 className="mt-1 text-3xl font-semibold">Team calendar</h1>
        <p className="mt-2 text-slate-500">Sample Office and WFH markers. Leave approval is not part of this release.</p>
      </div>
      <Card className="overflow-hidden border-0 shadow-sm">
        <CardContent className="overflow-x-auto p-0">
          <table className="min-w-[720px] w-full text-center text-sm">
            <thead className="bg-slate-50"><tr><th className="p-4 text-left">Member</th>{days.map((day) => <th key={day} className="p-4">{day}</th>)}</tr></thead>
            <tbody>
              {members.slice(0, 8).map((member, index) => (
                <tr key={member.id} className="border-t">
                  <td className="p-4 text-left font-medium">{member.name}</td>
                  {days.map((day, dayIndex) => <td key={day} className="p-2"><Badge variant="outline">{dayIndex === 2 && index % 2 === 0 ? 'WFH' : 'Office'}</Badge></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

export function RequestsScreen() {
  const [items, setItems] = useState(requests)
  const [title, setTitle] = useState('')
  return (
    <div className="flex flex-col gap-6">
      <MockBanner />
      <div>
        <p className="text-sm font-medium text-[#e2894b]">REQUESTS</p>
        <h1 className="mt-1 text-3xl font-semibold">Support requests</h1>
        <p className="mt-2 text-slate-500">Sample list only. Nothing is saved.</p>
      </div>
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">New request</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <select defaultValue="equipment" className="h-9 rounded-lg border px-2 text-sm" aria-label="Request type">
            <option value="equipment">Equipment</option>
            <option value="access">Access</option>
            <option value="training">Training</option>
            <option value="proposal">Proposal</option>
          </select>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Short description" className="min-w-64 flex-1" />
          <Button type="button" onClick={() => { if (!title.trim()) return; setItems([{ id: `REQ-${items.length + 4}`, member: 'You', type: 'Equipment', title, status: 'New', created: '2026-10-24' }, ...items]); setTitle('') }}>Add to preview</Button>
        </CardContent>
      </Card>
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">Request list</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs text-slate-500"><tr><th className="px-3 py-3">ID</th><th className="px-3 py-3">From</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Title</th><th className="px-3 py-3">Status</th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="px-3 py-4 font-medium">{item.id}</td>
                  <td className="px-3 py-4">{item.member}</td>
                  <td className="px-3 py-4">{item.type}</td>
                  <td className="px-3 py-4">{item.title}</td>
                  <td className="px-3 py-4">{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-400">Projects in the sample: {projects.join(', ')}</p>
        </CardContent>
      </Card>
    </div>
  )
}
