'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth/session'
import { notificationHistoryStart } from '@/lib/notifications/history'
import { createClient } from '@/lib/supabase/server'

function refresh() {
  revalidatePath('/notifications')
  revalidatePath('/dashboard')
}

export async function markNotificationRead(id: string) {
  const session = await requireSession()
  const supabase = await createClient()
  if (!supabase) return
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('recipient_id', session.id).is('read_at', null)
  refresh()
}

export async function markAllNotificationsRead() {
  const session = await requireSession()
  const supabase = await createClient()
  if (!supabase) return
  const since = notificationHistoryStart(new Date()).toISOString()
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', session.id).is('read_at', null).gte('created_at', since)
  refresh()
}
