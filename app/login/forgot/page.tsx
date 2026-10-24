'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { requestPasswordReset } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, {})
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f9] p-4">
      <form action={action} className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-[#1b2a41]">Reset your password</h1>
        <p className="mt-2 text-sm text-slate-500">We will email a reset link if the account exists. The email comes from Supabase Auth.</p>
        <div className="mt-6 flex flex-col gap-2">
          <Label htmlFor="email">Company email</Label>
          <Input id="email" name="email" type="email" required autoComplete="username" />
        </div>
        {state.error && <p className="mt-4 text-sm text-red-700">{state.error}</p>}
        {state.message && <p className="mt-4 text-sm text-emerald-700">{state.message}</p>}
        <Button type="submit" disabled={pending} className="mt-6 h-11 w-full bg-[#1b2a41]">Send reset link</Button>
        <Link href="/login" className="mt-4 block text-center text-sm text-[#e2894b]">Back to sign in</Link>
      </form>
    </main>
  )
}
