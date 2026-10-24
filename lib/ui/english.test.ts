import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const files = [
  'app/login/page.tsx',
  'app/login/login-form.tsx',
  'app/login/forgot/page.tsx',
  'app/login/update-password/page.tsx',
  'components/daily-report-form.tsx',
  'components/weekly-report-form.tsx',
  'app/(portal)/reports/weekly/page.tsx',
  'components/team-dashboard.tsx',
  'components/portal-shell.tsx',
  'components/dashboard-home.tsx',
  'components/admin-panel.tsx',
  'components/documents-library.tsx',
  'components/directory-panel.tsx',
  'components/notification-center.tsx',
  'components/notification-bell.tsx',
  'components/profile-editor.tsx',
  'lib/messages.ts',
]

const vietnamese = /[ĂÂÊÔƠƯĐăâêôơưđÁÀẢÃẠẤẦẨẪẬẮẰẲẴẶÉÈẺẼẸẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌỐỒỔỖỘỚỜỞỠỢÚÙỦŨỤỨỪỬỮỰÝỲỶỸỴáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/

describe('R1 UI copy is English', () => {
  it('does not use Vietnamese diacritics in the main screens', () => {
    const hits = files.flatMap((file) => {
      const text = readFileSync(join(process.cwd(), file), 'utf8')
      return vietnamese.test(text) ? [file] : []
    })
    expect(hits).toEqual([])
  })
})
