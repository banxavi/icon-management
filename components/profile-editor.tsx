'use client'

import { useActionState } from 'react'
import { updateMemberName, updateOwnProfile } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function ProfileEditor({ contact, skills }: { contact: string; skills: string }) {
  const [state, action, pending] = useActionState(updateOwnProfile, null)
  return (
    <form action={action} className="mt-6 grid gap-4">
      <p className="text-sm text-slate-500">You can edit contact and skills. Name, role, projects, and email are managed by an Admin or Team Leader.</p>
      <label className="text-sm font-medium">Contact
        <Input name="contact" defaultValue={contact} className="mt-2" />
      </label>
      <label className="text-sm font-medium">Skills
        <Input name="skills" defaultValue={skills} className="mt-2" placeholder="Comma-separated" />
      </label>
      <Button type="submit" disabled={pending} className="w-fit bg-[#1b2a41]">Save changes</Button>
      {state?.ok && <p className="text-sm text-emerald-700">{state.message}</p>}
      {state && !state.ok && <p className="text-sm text-red-600">{state.errors.join(' ')}</p>}
    </form>
  )
}

export function NameEditor({ userId, fullName }: { userId: string; fullName: string }) {
  const [state, action, pending] = useActionState(updateMemberName, null)
  return (
    <form action={action} className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
      <input type="hidden" name="userId" value={userId} />
      <label className="text-sm font-medium">Name
        <Input name="fullName" defaultValue={fullName} className="mt-2" />
      </label>
      <Button type="submit" disabled={pending} className="bg-[#1b2a41]">Save name</Button>
      {state?.ok && <p className="text-sm text-emerald-700">{state.message}</p>}
      {state && !state.ok && <p className="text-sm text-red-600">{state.errors.join(' ')}</p>}
    </form>
  )
}
