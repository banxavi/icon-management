import { messages } from '@/lib/messages'
import { LoginForm } from './login-form'

const errors: Record<string, string> = {
  idle: messages.idle,
  deactivated: messages.deactivated,
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; reset?: string }> }) {
  const params = await searchParams
  return (
    <LoginForm
      initialError={params.error ? errors[params.error] : undefined}
      notice={params.reset ? messages.passwordUpdated : undefined}
    />
  )
}
