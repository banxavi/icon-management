'use client'
// Story: REP-05, WFH-02
import { PortalProvider } from '@/components/portal-provider'
import { TeamDashboard } from '@/components/team-screens'
export default function Page() { return <PortalProvider><TeamDashboard /></PortalProvider> }
