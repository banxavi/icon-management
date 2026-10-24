export const ROLE_CODES = ['member', 'team_leader', 'reviewer', 'admin', 'document_owner'] as const

export type AppRole = (typeof ROLE_CODES)[number]

export type WorkStatus = 'office' | 'wfh'

export type ReportStatus = 'draft' | 'submitted'

export type SessionUser = {
  id: string
  email: string
  fullName: string
  status: 'active' | 'inactive'
  teamId: string | null
  contact: string
  skills: string[]
  roles: AppRole[]
  lastActivityAt: string | null
}

export type ProjectOption = {
  id: string
  name: string
}

export type WeeklyReportRecord = {
  id: string
  userId: string
  weekStart: string
  highlights: string
  progress: string
  risks: string
  nextWeek: string
  status: ReportStatus
  submittedAt: string | null
}

export type DailyReportRecord = {
  id: string
  userId: string
  reportDate: string
  projectId: string
  projectName: string
  workStatus: WorkStatus
  wfhReason: string
  doneToday: string
  nextPlan: string
  blockers: string
  status: ReportStatus
  submittedAt: string | null
  isLate: boolean
  edited: boolean
}
