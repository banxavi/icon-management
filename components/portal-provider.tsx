'use client'

import { createContext, useContext } from 'react'
import type { SessionUser } from '@/lib/types'

const SessionContext = createContext<SessionUser | null>(null)

/** Session comes from the server. There is no demo role switcher. */
export function PortalProvider({ session, children }: { session: SessionUser; children: React.ReactNode }) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

export function useSession() {
  const session = useContext(SessionContext)
  if (!session) throw new Error('Session is missing.')
  return session
}
