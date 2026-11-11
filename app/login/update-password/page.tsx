'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createAuthClient } from '@neondatabase/auth/next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { messages } from '@/lib/messages'

const authClient = createAuthClient()

function UpdatePasswordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(formData: FormData) {
    const password = String(formData.get('password') || '')
    const confirm = String(formData.get('confirm') || '')
    if (password.length < 8) {
      setError(messages.passwordTooShort)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    const token = params.get('token') || ''
    if (!token) {
      setError('Missing reset token. Open the link from your email again.')
      return
    }
    setPending(true)
    const { error: updateError } = await authClient.resetPassword({
      newPassword: password,
      token,
    })
    setPending(false)
    if (updateError) {
      setError('We could not update the password. Open the reset link again.')
      return
    }
    await authClient.signOut()
    router.push('/login?reset=1')
  }

  return (
    <form action={onSubmit} className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
      <h1 className="text-2xl font-semibold text-[#1b2a41]">Choose a new password</h1>
      <p className="mt-2 text-sm text-slate-500">Use at least 8 characters.</p>
      <div className="mt-6 flex flex-col gap-4">
        <label className="text-sm font-medium"><Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" required className="mt-2" autoComplete="new-password" />
        </label>
        <label className="text-sm font-medium"><Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" name="confirm" type="password" required className="mt-2" autoComplete="new-password" />
        </label>
      </div>
      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      <Button type="submit" disabled={pending} className="mt-6 h-11 w-full bg-[#1b2a41]">Update password</Button>
    </form>
  )
}

export default function UpdatePasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f9] p-4">
      <Suspense fallback={<div className="text-sm text-slate-500">Loading…</div>}>
        <UpdatePasswordForm />
      </Suspense>
    </main>
  )
}
