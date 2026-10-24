import { describe, expect, it } from 'vitest'
import { parseMemberCsv } from '@/lib/admin/csv'

const projects = ['ICON Core', 'Support Platform', 'Internal Tools']

describe('member CSV import', () => {
  it('parses the required columns', () => {
    const result = parseMemberCsv('full_name,email,role,project\nNguyen Minh Anh,leader@icon-dev.example,team_leader,ICON Core\n', projects)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.rows[0]).toMatchObject({ email: 'leader@icon-dev.example', role: 'team_leader', project: 'ICON Core' })
    }
  })

  it('rejects more than 17 rows and unknown projects in English', () => {
    const rows = Array.from({ length: 18 }, (_, i) => `User ${i},user${i}@icon-dev.example,member,ICON Core`)
    const tooMany = parseMemberCsv(['full_name,email,role,project', ...rows].join('\n'), projects)
    expect(tooMany.ok).toBe(false)
    if (!tooMany.ok) expect(tooMany.errors[0]).toMatch(/17/)

    const bad = parseMemberCsv('full_name,email,role,project\nA,a@icon-dev.example,boss,Nope\n', projects)
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.errors.join(' ')).toMatch(/role|project/)
  })
})
