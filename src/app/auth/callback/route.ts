import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, main_formats')
        .eq('id', data.user.id)
        .maybeSingle()

      if (!profile) {
        const meta = data.user.user_metadata ?? {}
        await supabase.from('profiles').insert({
          id: data.user.id,
          name: meta.full_name ?? meta.name ?? meta.user_name ?? 'ユーザー',
          avatar_url: meta.avatar_url ?? '',
          main_formats: [],
        })
        return NextResponse.redirect(`${origin}/onboarding`)
      }

      if (!profile.main_formats || profile.main_formats.length === 0) {
        return NextResponse.redirect(`${origin}/onboarding`)
      }

      return NextResponse.redirect(`${origin}/`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
