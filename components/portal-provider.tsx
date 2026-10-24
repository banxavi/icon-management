'use client'
import { createContext, useContext, useState } from 'react'
import type { Role } from '@/lib/mock-data'
import { PortalShell } from './portal-shell'
const RoleContext = createContext<Role>('Member')
export const usePortalRole = () => useContext(RoleContext)
export function PortalProvider({ children }: { children: React.ReactNode }) { const [role, setRole] = useState<Role>('Member'); return <RoleContext.Provider value={role}><PortalShell role={role} onRoleChange={setRole}>{children}</PortalShell></RoleContext.Provider> }
