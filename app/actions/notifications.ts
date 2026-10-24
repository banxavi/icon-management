'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export async function markNotificationRead(id: string) {
  const session = await requireSession()
  const supabase = await createClient()
  if (!supabase) return
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('recipient_id', session.id)
  revalidatePath('/notifications')
  revalidatePath('/dashboard')
}

export async function markAllNotificationsRead() {
  const session = await requireSession()
  const supabase = await createClient()
  if (!supabase) return
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', session.id).is('read_at', null)
  revalidatePath('/notifications')
  revalidatePath('/dashboard')
}
