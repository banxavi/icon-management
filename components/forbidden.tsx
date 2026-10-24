import { messages } from '@/lib/messages'
import { Card, CardContent } from '@/components/ui/card'

export function Forbidden() {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-8 text-center">
        <h1 className="text-lg font-semibold">{messages.forbidden}</h1>
        <p className="mt-2 text-sm text-slate-500">{messages.forbiddenDetail}</p>
      </CardContent>
    </Card>
  )
}
