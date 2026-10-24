'use client'
// Story: WFH-02
import { PortalProvider } from '@/components/portal-provider'
import { TeamCalendar } from '@/components/team-screens'
export default function Page() { return <PortalProvider><TeamCalendar /></PortalProvider> }
