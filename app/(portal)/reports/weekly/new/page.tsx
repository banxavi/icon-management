'use client'

import { toast } from 'sonner'
import { MockBanner } from '@/components/mock-banner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { messages } from '@/lib/messages'

const fields = [
  ['highlight', 'Highlights', 'What stood out this week?'],
  ['progress', 'Main progress', 'Which goals moved forward?'],
  ['risk', 'Risks', 'What should the team watch?'],
  ['next', 'Next week', 'What is the plan?'],
] as const

export default function WeeklyPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <MockBanner />
      <div>
        <p className="text-sm font-medium text-[#e2894b]">WEEKLY REPORT</p>
        <h1 className="mt-1 text-3xl font-semibold">Weekly summary</h1>
        <p className="mt-2 text-slate-500">Preview form only. Weekly reports are not saved in this release.</p>
      </div>
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Weekly report</CardTitle>
          <CardDescription>Sample fields for a later release.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {fields.map(([id, label, placeholder]) => (
            <div key={id} className="flex flex-col gap-2">
              <Label htmlFor={id}>{label}</Label>
              <Textarea id={id} placeholder={placeholder} rows={4} />
            </div>
          ))}
          <div className="flex justify-end">
            <Button type="button" className="bg-[#1b2a41]" onClick={() => toast.message(messages.previewOnly)}>Preview submit</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
