'use client'

import { useActionState } from 'react'
import { updateEmployeeProfile, updateMemberName } from '@/app/actions/admin'
import { roleLabel } from '@/lib/auth/permissions'
import { AlertBanner, Surface, SurfaceBody, SurfaceHeader } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ROLE_CODES, type AppRole } from '@/lib/types'

export type ProfileEditorValues = {
  id: string
  fullName: string
  email: string
  contact: string
  skills: string
  role: AppRole
  projects: string[]
}

export type ProfileEditableFlags = {
  fullName: boolean
  email: boolean
  contact: boolean
  skills: boolean
  role: boolean
  projects: boolean
}

export function ProfileEditor({
  values,
  editable,
  projectOptions,
  assignableRoles,
}: {
  values: ProfileEditorValues
  editable: ProfileEditableFlags
  projectOptions: string[]
  assignableRoles: AppRole[]
}) {
  const [state, action, pending] = useActionState(updateEmployeeProfile, null)
  const canSave =
    editable.fullName ||
    editable.email ||
    editable.contact ||
    editable.skills ||
    editable.role ||
    editable.projects

  return (
    <Surface>
      <SurfaceHeader
        title="Update profile"
        description="Edit every employee profile field except ID. Role and project membership update with the same save."
      />
      <SurfaceBody>
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="userId" value={values.id} />

          <div className="sm:col-span-2">
            <Label htmlFor="profile-id">Employee ID</Label>
            <Input
              id="profile-id"
              value={values.id}
              readOnly
              disabled
              className="mt-2 bg-muted/60 font-mono text-xs"
              aria-describedby="profile-id-help"
            />
            <p id="profile-id-help" className="mt-1 text-xs text-muted-foreground">
              Read-only. Used for authentication and records.
            </p>
          </div>

          <div>
            <Label htmlFor="profile-full-name">Full name</Label>
            <Input
              id="profile-full-name"
              name="fullName"
              defaultValue={values.fullName}
              required={editable.fullName}
              readOnly={!editable.fullName}
              disabled={!editable.fullName}
              className="mt-2"
              maxLength={120}
            />
          </div>

          <div>
            <Label htmlFor="profile-email">Work email</Label>
            <Input
              id="profile-email"
              name="email"
              type="email"
              defaultValue={values.email}
              required={editable.email}
              readOnly={!editable.email}
              disabled={!editable.email}
              className="mt-2"
              autoComplete="email"
            />
          </div>

          <div>
            <Label htmlFor="profile-role">Role</Label>
            <select
              id="profile-role"
              name="role"
              defaultValue={values.role}
              disabled={!editable.role}
              required={editable.role}
              className="mt-2 flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {(editable.role ? assignableRoles : ROLE_CODES).map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Projects</Label>
            <fieldset
              disabled={!editable.projects}
              className="mt-2 max-h-40 space-y-2 overflow-auto rounded-lg border border-input p-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <legend className="sr-only">Projects</legend>
              {projectOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No projects available.</p>
              ) : (
                projectOptions.map((project) => (
                  <label key={project} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="projects"
                      value={project}
                      defaultChecked={values.projects.includes(project)}
                    />
                    {project}
                  </label>
                ))
              )}
            </fieldset>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="profile-contact">Contact</Label>
            <Input
              id="profile-contact"
              name="contact"
              defaultValue={values.contact}
              readOnly={!editable.contact}
              disabled={!editable.contact}
              className="mt-2"
              maxLength={200}
              placeholder="Phone or other contact"
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="profile-skills">Skills</Label>
            <Input
              id="profile-skills"
              name="skills"
              defaultValue={values.skills}
              readOnly={!editable.skills}
              disabled={!editable.skills}
              className="mt-2"
              placeholder="Comma-separated"
            />
            <p className="mt-1 text-xs text-muted-foreground">Separate skills with commas.</p>
          </div>

          {canSave ? (
            <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Save profile'}
              </Button>
            </div>
          ) : null}

          {state?.ok ? <AlertBanner tone="success" className="sm:col-span-2">{state.message}</AlertBanner> : null}
          {state && !state.ok ? (
            <AlertBanner tone="danger" className="sm:col-span-2">
              <ul className="list-disc pl-4">
                {state.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </AlertBanner>
          ) : null}
        </form>
      </SurfaceBody>
    </Surface>
  )
}

export function NameEditor({ userId, fullName }: { userId: string; fullName: string }) {
  const [state, action, pending] = useActionState(updateMemberName, null)
  return (
    <form action={action} className="mt-4 flex flex-wrap items-end gap-3 border-t border-border/60 pt-4">
      <input type="hidden" name="userId" value={userId} />
      <div>
        <Label htmlFor="rename-full-name">Name</Label>
        <Input id="rename-full-name" name="fullName" defaultValue={fullName} className="mt-2" maxLength={120} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save name'}
      </Button>
      {state?.ok ? <p className="w-full text-sm text-emerald-700">{state.message}</p> : null}
      {state && !state.ok ? <p className="w-full text-sm text-red-600">{state.errors.join(' ')}</p> : null}
    </form>
  )
}
