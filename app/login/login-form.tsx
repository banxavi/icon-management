'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { ArrowRight, LockKeyhole } from 'lucide-react'
import { signIn } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginForm({ initialError, notice }: { initialError?: string; notice?: string }) {
  const [state, action, pending] = useActionState(signIn, { error: initialError })
  const error = state.error
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f9] p-4">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-xl md:grid-cols-2">
        <div className="hidden bg-[#1b2a41] p-10 text-white md:flex md:flex-col md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#f0a060] font-bold text-[#1b2a41]">I</div>
              <span className="font-semibold">ICON TEAM 1</span>
            </div>
            <div className="mt-24">
              <p className="text-sm font-medium text-[#f0a060]">TEAM PORTAL</p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight">Clear work.<br />A clear day.</h1>
              <p className="mt-5 max-w-sm text-slate-300">One place for the team to submit daily reports and stay in sync.</p>
            </div>
          </div>
          <p className="text-sm text-slate-400">© 2026 ICON Team 1</p>
        </div>
        <Card className="rounded-none border-0 shadow-none">
          <CardHeader className="px-8 pt-10 md:px-12">
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>Sign in with the email and password provisioned for you.</CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-10 md:px-12">
            <form action={action} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Company email</Label>
                <Input id="email" name="email" type="email" placeholder="name@icon.example" autoComplete="username" required />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/login/forgot" className="text-xs font-medium text-[#e2894b]">Forgot password?</Link>
                </div>
                <Input id="password" name="password" type="password" autoComplete="current-password" required />
              </div>
              {notice && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
              {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700"><LockKeyhole className="mr-2 inline size-4" />{error}</div>}
              <Button type="submit" disabled={pending} className="h-11 bg-[#1b2a41] hover:bg-[#263b59]">
                {pending ? 'Signing in...' : 'Sign in'} <ArrowRight className="ml-auto size-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
