'use client'
// Story: REP-07
import { PortalProvider } from '@/components/portal-provider'
import { WeeklyTeamReport } from '@/components/team-screens'
export default function Page() { return <PortalProvider><WeeklyTeamReport /></PortalProvider> }
