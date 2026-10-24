import { ROLE_CODES, type AppRole } from '@/lib/types'

export const MAX_IMPORT_ROWS = 17

export type CsvMemberRow = {
  line: number
  fullName: string
  email: string
  role: AppRole
  project: string
}

export type CsvParseResult =
  | { ok: true; rows: CsvMemberRow[] }
  | { ok: false; errors: string[] }

const ROLE_ALIASES: Record<string, AppRole> = {
  member: 'member',
  'team leader': 'team_leader',
  team_leader: 'team_leader',
  reviewer: 'reviewer',
  admin: 'admin',
  'document owner': 'document_owner',
  document_owner: 'document_owner',
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        quoted = !quoted
      }
    } else if (char === ',' && !quoted) {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current.trim())
  return cells
}

export function parseMemberCsv(text: string, projectNames: string[]): CsvParseResult {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length === 0) {
    return { ok: false, errors: ['The CSV file is empty.'] }
  }
  const header = splitCsvLine(lines[0]).map((cell) => cell.toLowerCase())
  const expected = ['full_name', 'email', 'role', 'project']
  if (expected.some((column, index) => header[index] !== column)) {
    return { ok: false, errors: ['The CSV must include a header row: full_name,email,role,project.'] }
  }
  const dataLines = lines.slice(1)
  if (dataLines.length > MAX_IMPORT_ROWS) {
    return { ok: false, errors: ['CSV import accepts at most 17 users.'] }
  }
  if (dataLines.length === 0) {
    return { ok: false, errors: ['The CSV has no user rows.'] }
  }

  const projects = new Map(projectNames.map((name) => [name.toLowerCase(), name]))
  const errors: string[] = []
  const rows: CsvMemberRow[] = []
  const seen = new Set<string>()

  dataLines.forEach((line, index) => {
    const lineNo = index + 2
    const [fullName = '', emailRaw = '', roleRaw = '', projectRaw = ''] = splitCsvLine(line)
    const email = emailRaw.toLowerCase()
    if (!fullName) errors.push(`Row ${lineNo}: full name is required.`)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push(`Row ${lineNo}: email is not valid.`)
    const role = ROLE_ALIASES[roleRaw.toLowerCase()]
    if (!role || !ROLE_CODES.includes(role)) {
      errors.push(`Row ${lineNo}: role must be member, team_leader, reviewer, admin, or document_owner.`)
    }
    const project = projects.get(projectRaw.toLowerCase())
    if (!project) errors.push(`Row ${lineNo}: project does not match an existing project.`)
    if (email && seen.has(email)) errors.push(`Row ${lineNo}: duplicate email in this file.`)
    if (email) seen.add(email)
    if (fullName && role && project && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      rows.push({ line: lineNo, fullName, email, role, project })
    }
  })

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, rows }
}
