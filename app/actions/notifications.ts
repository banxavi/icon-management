'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth/session'
import { getSql } from '@/lib/db'
import { notificationHistoryStart } from '@/lib/notifications/history'

export async function markNotificationRead(id: string) {
  const session = await requireSession()
  const sql = getSql()
  if (!sql) return
  await sql`
    update public.notifications
    set read_at = ${new Date().toISOString()}::timestamptz
    where id = ${id}::uuid and recipient_id = ${session.id}::uuid and read_at is null
  `
  revalidatePath('/notifications')
  revalidatePath('/dashboard')
}

export async function markAllNotificationsRead() {
  const session = await requireSession()
  const sql = getSql()
  if (!sql) return
  const since = notificationHistoryStart(new Date()).toISOString()
  await sql`
    update public.notifications
    set read_at = ${new Date().toISOString()}::timestamptz
    where recipient_id = ${session.id}::uuid and read_at is null and created_at >= ${since}::timestamptz
  `
  revalidatePath('/notifications')
  revalidatePath('/dashboard')
}
