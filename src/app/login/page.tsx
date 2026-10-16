'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Provider } from '@supabase/supabase-js'
import Link from 'next/link'
import { CalendarDays, Star, MessageSquareText } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        router.replace('/')
      } else {
        setChecking(false)
      }
    })
  }, [router])

  const handleLogin = async (provider: Provider) => {
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError('ログインに失敗しました。時間をおいて再度お試しください。')
    }
  }

  if (checking) return null

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white px-6 pt-16 pb-24">
        <div className="max-w-sm mx-auto flex flex-col gap-3">
          <span className="font-display text-lg text-white/90">ShopTutor</span>
          <h1 className="font-display text-3xl leading-snug">
            近くのMTG公認店と
            <br />
            イベントが見つかる
          </h1>
          <p className="text-sm text-white/80">全国約560店舗の口コミと、毎日更新のイベント情報</p>
        </div>
      </div>

      <div className="flex-1 px-4 -mt-14">
        <div className="max-w-sm mx-auto surface p-5 flex flex-col gap-4">
          <ul className="flex flex-col gap-2.5 text-sm text-slate-700">
            {[
              { Icon: CalendarDays, text: '今日・今週末に遊べるイベントを近い順に' },
              { Icon: Star, text: 'お気に入りの店のイベントをまとめてチェック' },
              { Icon: MessageSquareText, text: '品揃え・対戦スペースなど5項目で口コミを投稿' },
            ].map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Icon size={16} />
                </span>
                {text}
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2.5 pt-1">
            <button
              onClick={() => handleLogin('google')}
              className="h-12 flex items-center justify-center gap-2.5 rounded-xl bg-white text-sm font-bold text-slate-800 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 transition-colors"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
                <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
                <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" />
                <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9z" />
              </svg>
              Googleでログイン
            </button>
            <button
              onClick={() => handleLogin('x')}
              className="h-12 flex items-center justify-center gap-2.5 rounded-xl bg-slate-900 text-sm font-bold text-white hover:bg-slate-800 transition-colors"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
                <path d="M18.2 2.3h3.4l-7.4 8.4 8.7 11.5h-6.8l-5.3-7-6.1 7H1.3l7.9-9L.9 2.3h7l4.8 6.4 5.5-6.4zm-1.2 17.9h1.9L7.1 4.2H5.1l11.9 16z" />
              </svg>
              Xでログイン
            </button>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

          <p className="text-[11px] text-slate-500 leading-relaxed text-center">
            ログインすると
            <Link href="/terms" className="text-blue-600 hover:underline">利用規約</Link>と
            <Link href="/privacy" className="text-blue-600 hover:underline">プライバシーポリシー</Link>
            に同意したものとみなされます
          </p>
        </div>

        <div className="max-w-sm mx-auto text-center py-6">
          <Link href="/" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
            ログインせずにイベントを見る
          </Link>
        </div>
      </div>
    </div>
  )
}
