'use client'

import { useActionState } from 'react'
import { updateOwnProfile } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function ProfileEditor({ contact, skills }: { contact: string; skills: string }) {
  const [state, action, pending] = useActionState(updateOwnProfile, null)
  return (
    <form action={action} className="mt-6 grid gap-4">
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
