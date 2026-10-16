import { createAdminClient } from '@/lib/supabase-admin'

export type AuthUserInfo = { email: string | null; banned_until: string | null }

// Authのユーザーをまとめて取得する（1人ずつ getUserById すると人数分の通信になり遅いため）
export async function listAuthUsers(): Promise<Map<string, AuthUserInfo>> {
  const admin = createAdminClient()
  const users = new Map<string, AuthUserInfo>()
  const perPage = 1000
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) break
    for (const u of data.users) {
      users.set(u.id, { email: u.email ?? null, banned_until: (u as { banned_until?: string | null }).banned_until ?? null })
    }
    if (data.users.length < perPage) break
  }
  return users
}

// 検索語を PostgREST の or() に入れても壊れないようにする（区切り文字を除く）
export function sanitizeSearch(q: string | null | undefined): string {
  return (q ?? '').replace(/[,()*%\\]/g, ' ').trim()
}
