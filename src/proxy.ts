import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const SKIP_ONBOARDING_CHECK_PREFIXES = ['/login', '/auth', '/onboarding']
const ONBOARDED_COOKIE = 'st_onboarded'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
