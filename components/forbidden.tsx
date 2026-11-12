import { messages } from '@/lib/messages'
import { EmptyState } from '@/components/layout'

export function Forbidden() {
  return <EmptyState title={messages.forbidden} description={messages.forbiddenDetail} />
}
