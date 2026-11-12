'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createAuthClient } from '@neondatabase/auth/next'
import { AlertBanner, AuthShell } from '@/components/layout'
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
    <form action={onSubmit} className="p-8">
      <h1 className="font-display text-2xl font-semibold text-balance">Choose a new password</h1>
      <p className="mt-2 text-sm text-pretty text-muted-foreground">Use at least 8 characters.</p>
      <div className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" required autoComplete="new-password" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" name="confirm" type="password" required autoComplete="new-password" />
        </div>
      </div>
      {error ? <AlertBanner tone="danger" className="mt-4">{error}</AlertBanner> : null}
      <Button type="submit" disabled={pending} size="lg" className="mt-6 h-11 w-full">
        Update password
      </Button>
    </form>
  )
}

export default function UpdatePasswordPage() {
  return (
    <AuthShell>
      <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading…</div>}>
        <UpdatePasswordForm />
      </Suspense>
    </AuthShell>
  )
}
