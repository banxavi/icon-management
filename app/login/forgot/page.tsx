'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { requestPasswordReset } from '@/app/actions/auth'
import { AlertBanner, AuthShell } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, {})
  return (
    <AuthShell>
      <form action={action} className="p-8">
        <h1 className="font-display text-2xl font-semibold text-balance">Reset your password</h1>
        <p className="mt-2 text-sm text-pretty text-muted-foreground">
          We will email a reset link if the account exists. The email comes from Neon Auth.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Label htmlFor="email">Company email</Label>
          <Input id="email" name="email" type="email" required autoComplete="username" />
        </div>
        {state.error ? <AlertBanner tone="danger" className="mt-4">{state.error}</AlertBanner> : null}
        {state.message ? <AlertBanner tone="success" className="mt-4">{state.message}</AlertBanner> : null}
        <Button type="submit" disabled={pending} size="lg" className="mt-6 h-11 w-full">
          Send reset link
        </Button>
        <Link href="/login" className="mt-4 block text-center text-sm font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </form>
    </AuthShell>
  )
}
