import { notFound } from 'next/navigation'
import { canEditProfileField } from '@/lib/auth/profile'
import { requireSession } from '@/lib/auth/session'
import { loadDirectory } from '@/lib/data/load'
import { ProfileEditor } from '@/components/profile-editor'
import { Badge } from '@/components/ui/badge'
import { EmptyState, PageHeader, Surface, SurfaceBody, SurfaceHeader } from '@/components/layout'

export const dynamic = 'force-dynamic'

export default async function MemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSession()
  const people = await loadDirectory(session)
  const person = people.find((item) => item.id === id)
  if (!person) notFound()

  // Directory is already scoped to the actor's team when teamId is set.
  const sameTeam = Boolean(session.teamId) || session.roles.includes('admin')
  const acl = {
    actorId: session.id,
    actorRoles: session.roles,
    targetId: person.id,
    sameTeam,
  }
  const editable = {
    fullName: canEditProfileField({ ...acl, field: 'fullName' }),
    email: canEditProfileField({ ...acl, field: 'email' }),
    contact: canEditProfileField({ ...acl, field: 'contact' }),
    skills: canEditProfileField({ ...acl, field: 'skills' }),
  }
  const canEditAny = editable.fullName || editable.email || editable.contact || editable.skills

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        eyebrow="Profile"
        title={person.fullName}
        description={person.roles.join(', ') || 'Member'}
      />

      <Surface>
        <SurfaceHeader title="Directory fields" description="Visible team directory information for this employee." />
        <SurfaceBody className="grid gap-4 text-sm sm:grid-cols-2">
          <p>
            <span className="font-medium text-foreground">ID:</span>{' '}
            <span className="font-mono text-xs text-muted-foreground">{person.id}</span>
          </p>
          <p>
            <span className="font-medium text-foreground">Name:</span> {person.fullName}
          </p>
          <p>
            <span className="font-medium text-foreground">Role:</span> {person.roles.join(', ') || 'Member'}
          </p>
          <p>
            <span className="font-medium text-foreground">Projects:</span> {person.projects.join(', ') || 'None'}
          </p>
          <p>
            <span className="font-medium text-foreground">Email:</span> {person.email}
          </p>
          <p className="sm:col-span-2">
            <span className="font-medium text-foreground">Contact:</span> {person.contact || 'None'}
          </p>
          <div className="sm:col-span-2">
            <p className="font-medium text-foreground">Skills</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {person.skills.length > 0 ? (
                person.skills.map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">None</span>
              )}
            </div>
          </div>
        </SurfaceBody>
      </Surface>

      {canEditAny ? (
        <ProfileEditor
          values={{
            id: person.id,
            fullName: person.fullName,
            email: person.email,
            contact: person.contact,
            skills: person.skills.join(', '),
            roles: person.roles.join(', '),
            projects: person.projects.join(', '),
          }}
          editable={editable}
        />
      ) : (
        <EmptyState title="You can view this profile, but you cannot edit these fields." />
      )}
    </div>
  )
}
