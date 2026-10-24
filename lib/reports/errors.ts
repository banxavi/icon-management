import { messages } from '@/lib/messages'

export function mapWriteError(message: string): string {
  if (message.includes('REPORT_WINDOW_CLOSED')) return messages.windowClosed
  if (message.includes('WFH_REASON_REQUIRED')) return messages.wfhReason
  if (message.includes('REQUIRED_FIELDS')) return messages.required
  return messages.saveFailed
}
