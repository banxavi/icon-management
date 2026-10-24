export const members = Array.from({ length: 17 }, (_, index) => ({
  id: `member-${index + 1}`,
  name: ['Nguyen Minh Anh', 'Tran Quoc Bao', 'Le Hoang Nam', 'Pham Thu Ha', 'Do Duc Long'][index % 5],
  role: index === 0 ? 'Team Leader' : 'Member',
  initials: ['MA', 'QB', 'LN', 'TH', 'DL'][index % 5],
}))

export const projects = ['ICON Core', 'Support Platform', 'Internal Tools']

export const dailyReports = [
  { id: 'DR-2408', date: '2026-10-24', project: 'ICON Core', status: 'Submitted', summary: 'Finished the access flow and updated the rollout notes.' },
  { id: 'DR-2407', date: '2026-10-23', project: 'Support Platform', status: 'Submitted', summary: 'Fixed ticket sync and reviewed a team pull request.' },
  { id: 'DR-2406', date: '2026-10-22', project: 'ICON Core', status: 'Submitted', summary: 'Integrated the new dashboard screen.' },
  { id: 'DR-2405', date: '2026-10-21', project: 'Internal Tools', status: 'Submitted', summary: 'Reviewed the weekly report requirements.' },
  { id: 'DR-2404', date: '2026-10-20', project: 'ICON Core', status: 'Not submitted', summary: 'No content yet.' },
]

export const teamWeeklySummary = projects.map((project, index) => ({
  project,
  members: [5, 6, 6][index],
  submitted: [4, 5, 5][index],
  progress: ['82%', '74%', '91%'][index],
  highlight: ['Access flow is in place.', 'Ticket sync is stable.', 'Report scope is agreed.'][index],
}))

export const requests = [
  { id: 'REQ-001', member: 'Tran Quoc Bao', type: 'Access', title: 'Staging access', status: 'New', created: '2026-10-24' },
  { id: 'REQ-002', member: 'Pham Thu Ha', type: 'Equipment', title: 'Replacement keyboard', status: 'In progress', created: '2026-10-23' },
  { id: 'REQ-003', member: 'Do Duc Long', type: 'Training', title: 'Observability course', status: 'Done', created: '2026-10-21' },
]

export const announcements = [
  { title: 'Daily report window', date: '2026-10-24', body: 'Submit or edit a daily report until the end of the next calendar day.', pinned: true },
  { title: 'Weekend maintenance', date: '2026-10-23', body: 'The portal will be maintained Saturday from 22:00 to 23:30.', pinned: false },
]

export const documents = [
  { id: 'DOC-01', name: 'WFH policy', folder: 'Policies', version: 'v2.1', uploader: 'Nguyen Minh Anh', updated: '2026-10-24', tags: ['WFH', 'Important'], kind: 'PDF' },
  { id: 'DOC-02', name: 'Reporting process', folder: 'Process', version: 'v1.4', uploader: 'Tran Quoc Bao', updated: '2026-10-23', tags: ['Reports'], kind: 'PDF' },
  { id: 'DOC-03', name: 'Onboarding checklist', folder: 'Guides', version: 'v3.0', uploader: 'Pham Thu Ha', updated: '2026-10-20', tags: ['Onboarding'], kind: 'XLSX' },
  { id: 'DOC-04', name: 'ICON Core architecture', folder: 'Projects', version: 'v1.8', uploader: 'Le Hoang Nam', updated: '2026-10-18', tags: ['ICON Core'], kind: 'PNG' },
]

export const skills = ['TypeScript', 'Next.js', 'Product thinking', 'Observability']
