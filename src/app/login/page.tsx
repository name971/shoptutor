'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Provider } from '@supabase/supabase-js'

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
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800">ShopTutor</h1>
        <p className="mt-2 text-sm text-gray-500">MTG公認店舗レビューサイト</p>
      </div>

      <div className="w-full max-w-xs flex flex-col gap-3">
        <button
          onClick={() => handleLogin('google')}
          className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          Googleでログイン
        </button>
        <button
          onClick={() => handleLogin('twitter')}
          className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-black px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-gray-800 transition-colors"
        >
          Xでログイン
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
