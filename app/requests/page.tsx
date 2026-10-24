'use client'
// Stories: REQ-01, REQ-02
import { PortalProvider } from '@/components/portal-provider'
import { RequestsScreen } from '@/components/team-screens'
export default function Page() { return <PortalProvider><RequestsScreen /></PortalProvider> }
