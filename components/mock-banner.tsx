import { messages } from '@/lib/messages'

export function MockBanner() {
  return <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">{messages.previewOnly}</p>
}
