export const DAILY_WINDOW_VALUE = 'end_of_next_calendar_day'
export const DEFAULT_TIMEZONE = 'Asia/Saigon'
export const DEFAULT_RETENTION_MONTHS = 12
export const SETTINGS_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'pptx', 'md', 'png', 'jpg'] as const

export type OrgSettingsInput = {
  timezone: string
  retentionMonths: number
  dailyWindow: string
  maxUploadMb: number
  allowedExtensions: string[]
}

export function isSupportedTimeZone(value: string): boolean {
  const zone = value.trim()
  if (!zone || zone.length > 64) return false
  try {
    Intl.DateTimeFormat('en-US', { timeZone: zone === 'Asia/Saigon' ? 'Asia/Ho_Chi_Minh' : zone }).format(new Date())
    return true
  } catch {
    return false
  }
}

export function parseOrgSettings(input: {
  timezone: string
  retentionMonths: string
  dailyWindow: string
  maxUploadMb: string
  extensions: string[]
}): { ok: true; value: OrgSettingsInput } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const timezone = input.timezone.trim()
  if (!isSupportedTimeZone(timezone)) {
    errors.push('Enter a valid time zone. Asia/Saigon is the team default.')
  }
  const retentionMonths = Number(input.retentionMonths)
  if (retentionMonths !== 12) {
    errors.push('Retention is 12 months.')
  }
  if (input.dailyWindow !== DAILY_WINDOW_VALUE) {
    errors.push('The daily report window is the end of the next calendar day.')
  }
  const maxUploadMb = Number(input.maxUploadMb)
  if (!Number.isInteger(maxUploadMb) || maxUploadMb < 1 || maxUploadMb > 50) {
    errors.push('The upload limit must be a whole number of megabytes from 1 to 50.')
  }
  const allowedExtensions = [...new Set(input.extensions.map((item) => item.trim().toLowerCase()).filter(Boolean))]
  if (allowedExtensions.length === 0 || allowedExtensions.some((item) => !SETTINGS_EXTENSIONS.includes(item as (typeof SETTINGS_EXTENSIONS)[number]))) {
    errors.push('Choose at least one allowed type: pdf, docx, xlsx, pptx, md, png, jpg.')
  }
  if (errors.length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: {
      timezone,
      retentionMonths,
      dailyWindow: DAILY_WINDOW_VALUE,
      maxUploadMb,
      allowedExtensions,
    },
  }
}
