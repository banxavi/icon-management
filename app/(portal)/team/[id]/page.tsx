import { notFound } from 'next/navigation'
import { primaryRole } from '@/lib/auth/permissions'
import { canAssignRole, canEditProfileField } from '@/lib/auth/profile'
import { requireSession } from '@/lib/auth/session'
import { asRole } from '@/lib/data/rows'
import { loadDirectory } from '@/lib/data/load'
import { getSql } from '@/lib/db'
import { ProfileEditor } from '@/components/profile-editor'
import { Badge } from '@/components/ui/badge'
import { EmptyState, PageHeader, Surface, SurfaceBody, SurfaceHeader } from '@/components/layout'
import { ROLE_CODES, type AppRole } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function MemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSession()
  const people = await loadDirectory(session)
  const person = people.find((item) => item.id === id)
  if (!person) notFound()

  const sql = getSql()
  const [roleRows, projectOptionRows] = sql
    ? await Promise.all([
        sql`
          select r.code from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          where ur.user_id = ${person.id}::uuid
        `,
        sql`select name from public.projects order by name`,
      ])
    : [[], []]

  const roleCodes = roleRows
    .map((row) => asRole(row.code))
    .filter((role): role is AppRole => Boolean(role))
  const role = primaryRole(roleCodes)
  const projectOptions = projectOptionRows.map((row) => String(row.name))

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
    role: canEditProfileField({ ...acl, field: 'role' }),
    projects: canEditProfileField({ ...acl, field: 'projects' }),
  }
  const canEditAny =
    editable.fullName ||
    editable.email ||
    editable.contact ||
    editable.skills ||
    editable.role ||
    editable.projects
  const assignableRoles = ROLE_CODES.filter((code) =>
    canAssignRole({ actorRoles: session.roles, nextRole: code, currentRole: role }),
  )

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
            role,
            projects: person.projects,
          }}
          editable={editable}
          projectOptions={projectOptions}
          assignableRoles={assignableRoles}
        />
      ) : (
        <EmptyState title="You can view this profile, but you cannot edit these fields." />
      )}
    </div>
  )
}
