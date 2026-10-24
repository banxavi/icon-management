import { notFound } from 'next/navigation'
import { canEditProfileField } from '@/lib/auth/profile'
import { requireSession } from '@/lib/auth/session'
import { loadDirectory } from '@/lib/data/load'
import { NameEditor, ProfileEditor } from '@/components/profile-editor'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

export default async function MemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSession()
  const people = await loadDirectory(session)
  const person = people.find((item) => item.id === id)
  if (!person) notFound()
  const mine = person.id === session.id
  const canRename = canEditProfileField({
    actorId: session.id,
    actorRoles: session.roles,
    targetId: person.id,
    field: 'fullName',
    sameTeam: Boolean(session.teamId),
  })
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b86f3c]">Profile</p>
      <h1 className="mt-3 text-3xl font-semibold text-[#1b2a41]">{person.fullName}</h1>
      <p className="mt-1 text-sm text-slate-500">{person.roles.join(', ') || 'Member'}</p>
      <Card className="mt-8">
        <CardHeader><CardTitle>Directory fields</CardTitle></CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <p><span className="font-medium">Name:</span> {person.fullName}</p>
          <p><span className="font-medium">Role:</span> {person.roles.join(', ') || 'Member'}</p>
          <p><span className="font-medium">Projects:</span> {person.projects.join(', ') || 'None'}</p>
          <p><span className="font-medium">Email:</span> {person.email}</p>
          <p className="sm:col-span-2"><span className="font-medium">Contact:</span> {person.contact || 'None'}</p>
          <div className="sm:col-span-2">
            <p className="font-medium">Skills</p>
            <div className="mt-2 flex flex-wrap gap-2">{person.skills.length > 0 ? person.skills.map((skill) => <Badge key={skill} variant="secondary">{skill}</Badge>) : <span className="text-slate-500">None</span>}</div>
          </div>
          {canRename && <div className="sm:col-span-2"><NameEditor userId={person.id} fullName={person.fullName} /></div>}
          {mine && <div className="sm:col-span-2"><ProfileEditor contact={person.contact} skills={person.skills.join(', ')} /></div>}
        </CardContent>
      </Card>
    </div>
  )
}
