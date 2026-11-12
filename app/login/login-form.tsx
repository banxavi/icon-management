'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { ArrowRight, LockKeyhole } from 'lucide-react'
import { signIn } from '@/app/actions/auth'
import { AlertBanner, AuthBrandPanel, AuthShell } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginForm({ initialError, notice }: { initialError?: string; notice?: string }) {
  const [state, action, pending] = useActionState(signIn, { error: initialError })
  const error = state.error
  return (
    <AuthShell panel={<AuthBrandPanel />}>
      <div className="px-8 py-10 md:px-12">
        <h1 className="font-display text-2xl font-semibold text-balance">Welcome back</h1>
        <p className="mt-2 text-sm text-pretty text-muted-foreground">Sign in with the email and password provisioned for you.</p>
        <form action={action} className="mt-8 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Company email</Label>
            <Input id="email" name="email" type="email" placeholder="name@icon.example" autoComplete="username" required />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between gap-3">
              <Label htmlFor="password">Password</Label>
              <Link href="/login/forgot" className="text-xs font-medium text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {notice ? <AlertBanner tone="success">{notice}</AlertBanner> : null}
          {error ? (
            <AlertBanner tone="danger" icon={<LockKeyhole className="size-4" />}>
              {error}
            </AlertBanner>
          ) : null}
          <Button type="submit" disabled={pending} size="lg" className="h-11">
            {pending ? 'Signing in...' : 'Sign in'}
            <ArrowRight data-icon="inline-end" className="ml-auto size-4" />
          </Button>
        </form>
      </div>
    </AuthShell>
  )
}
