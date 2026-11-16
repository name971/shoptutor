import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
// ログイン中のユーザーを、端末に保存されたセッションから読む（Authサーバーへ問い合わせない）。
// 画面の出し分け用。getUser() は毎回ネットワーク往復になり、店舗詳細では部品ごとに何度も走っていた。
// 読み書きの可否はDB側のRLSとAPIの認証が決めるので、ここを信用して権限を与えることはない
export async function getLocalUser(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase.auth.getSession()
  return { data: { user: data.session?.user ?? null } }
}
