import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await getSessionUser()
  redirect(session ? '/dashboard' : '/login')
}
