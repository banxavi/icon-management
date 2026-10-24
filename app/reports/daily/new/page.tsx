// Story: WFH-01
import { Toaster } from 'sonner'
import { PortalProvider } from '@/components/portal-provider'
import { DailyReportForm } from '@/components/daily-report-form'
export default function NewDailyReportPage() { return <PortalProvider><Toaster position="top-right" /><div className="mx-auto flex max-w-3xl flex-col gap-6"><div><p className="text-sm font-medium text-[#e2894b]">BÁO CÁO HẰNG NGÀY</p><h1 className="mt-1 text-3xl font-semibold">Nộp daily report</h1><p className="mt-2 text-slate-500">Chia sẻ ngắn gọn để cả team nắm được tiến độ.</p></div><DailyReportForm /></div></PortalProvider> }
