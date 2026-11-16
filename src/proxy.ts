import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const SKIP_ONBOARDING_CHECK_PREFIXES = ['/login', '/auth', '/onboarding']
const ONBOARDED_COOKIE = 'st_onboarded'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // 未ログイン（Supabaseのセッションcookieがない）なら確認することがないので、何もせず通す
  if (!request.cookies.getAll().some((c) => c.name.startsWith('sb-'))) return supabaseResponse

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getClaims はログイン情報（JWT）を検証する。非対称鍵の署名ならSupabaseへ問い合わせずに手元で検証できるため、
  // 毎回Authサーバーに問い合わせる getUser より速い（期限切れならここでセッションも更新される）
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub ?? null

  const pathname = request.nextUrl.pathname
  const skipCheck = SKIP_ONBOARDING_CHECK_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  // オンボーディング（メインフォーマット選択）が済んでいるかは、一度確認したらCookieに覚えておき、
  // 以降のページ移動ではDBに問い合わせない（Cookieの値はユーザーIDで、別ユーザーなら確認し直す）
  if (userId && !skipCheck && request.cookies.get(ONBOARDED_COOKIE)?.value !== userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('main_format')
      .eq('id', userId)
      .maybeSingle()

    if (!profile || !profile.main_format) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }

    supabaseResponse.cookies.set(ONBOARDED_COOKIE, userId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 180,
    })
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    {
      // ページの表示だけを対象にする。API（各ルートが自分で認証する）・静的ファイル・地図データ・
      // メタ情報の画像と、<Link> の先読み（一覧のカード1枚ごとに発生する）では動かさない
      source:
        '/((?!api|_next/static|_next/image|geo/|favicon.ico|manifest.webmanifest|opengraph-image|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|txt|xml)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
