'use client'

import { useState } from 'react'
import { importMembers, setAccountActive, updateAccount, type AdminResult } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { roleLabel } from '@/lib/auth/permissions'
import type { AppRole } from '@/lib/types'

export type AdminUser = {
  id: string
  fullName: string
  email: string
  status: 'active' | 'inactive'
  role: AppRole
  project: string
  assignedMemberIds: string[]
}

const roles: AppRole[] = ['member', 'team_leader', 'reviewer', 'admin', 'document_owner']

export function AdminPanel({
  users,
  projects,
  settings,
}: {
  users: AdminUser[]
  projects: string[]
  settings: { timezone: string; retentionMonths: number; dailyWindow: string }
}) {
  const [tab, setTab] = useState<'users' | 'settings'>('users')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  function show(result: AdminResult) {
    if (result.ok) {
      setMessage(result.message)
      setErrors([])
    } else {
      setMessage('')
      setErrors(result.errors)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b86f3c]">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#1b2a41]">Account administration</h1>
        <p className="mt-2 text-sm text-slate-500">Create or update up to 17 users from CSV, deactivate accounts, and assign roles.</p>
      </div>
      <div className="mb-5 flex gap-2 border-b">
        <button type="button" onClick={() => setTab('users')} className={`border-b-2 px-4 py-3 text-sm font-medium ${tab === 'users' ? 'border-[#b86f3c] text-[#b86f3c]' : 'border-transparent text-slate-500'}`}>Users</button>
        <button type="button" onClick={() => setTab('settings')} className={`border-b-2 px-4 py-3 text-sm font-medium ${tab === 'settings' ? 'border-[#b86f3c] text-[#b86f3c]' : 'border-transparent text-slate-500'}`}>Report rules</button>
      </div>
      {message && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {errors.length > 0 && <ul className="mb-4 list-disc rounded-lg bg-red-50 px-8 py-3 text-sm text-red-700">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
      {tab === 'settings' ? (
        <Card>
          <CardContent className="grid gap-4 p-6 text-sm">
            <p><span className="font-medium">Timezone:</span> {settings.timezone}</p>
            <p><span className="font-medium">Retention:</span> {settings.retentionMonths} months</p>
            <p><span className="font-medium">Daily window:</span> end of the next calendar day. Writes after that are rejected. There is no approval step.</p>
            <p className="text-slate-500">Window value stored: {settings.dailyWindow}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader><CardTitle>Import CSV</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-slate-500">Columns: full_name, email, role, project. At most 17 rows. New accounts receive a Supabase invite email.</p>
              <form action={async (formData) => show(await importMembers(null, formData))} className="flex flex-wrap items-center gap-3">
                <input name="file" type="file" accept=".csv,text/csv" required className="text-sm" aria-label="CSV file" />
                <Button type="submit">Import</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{users.length} accounts</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-4">
              {users.map((user) => (
                <div key={user.id} className="rounded-xl border border-slate-100">
                <form action={async (formData) => show(await updateAccount(formData))} className="grid gap-3 p-4 md:grid-cols-2">
                  <input type="hidden" name="userId" value={user.id} />
                  <div>
                    <p className="font-medium">{user.fullName}</p>
                    <p className="text-sm text-slate-500">{user.email}</p>
                    <p className="mt-1 text-xs uppercase text-slate-400">{user.status === 'active' ? 'Active' : 'Deactivated'}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm">Role
                      <select name="role" defaultValue={user.role} className="mt-1 block h-9 w-full rounded-lg border px-2">
                        {roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
                      </select>
                    </label>
                    <label className="text-sm">Project
                      <select name="project" defaultValue={user.project || projects[0]} className="mt-1 block h-9 w-full rounded-lg border px-2">
                        {projects.map((project) => <option key={project} value={project}>{project}</option>)}
                      </select>
                    </label>
                    <fieldset className="text-sm">
                      <legend className="mb-1">Assigned members (reviewers only)</legend>
                      <div className="max-h-28 overflow-auto rounded-lg border p-2">
                        {users.filter((member) => member.id !== user.id).map((member) => (
                          <label key={member.id} className="flex items-center gap-2 py-0.5">
                            <input type="checkbox" name="assigned" value={member.id} defaultChecked={user.assignedMemberIds.includes(member.id)} />
                            {member.fullName}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div className="flex gap-2">
                      <Button type="submit" className="bg-[#1b2a41]">Save role</Button>
                    </div>
                  </div>
                </form>
                <form action={async (formData) => show(await setAccountActive(formData))} className="px-4 pb-4">
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="active" value={user.status === 'active' ? 'false' : 'true'} />
                  <Button type="submit" variant="outline">{user.status === 'active' ? 'Deactivate' : 'Reactivate'}</Button>
                </form>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
