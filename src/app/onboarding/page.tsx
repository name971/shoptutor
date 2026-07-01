'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { FORMAT_LABELS, FORMAT_COLORS } from '@/types'

const SELECTABLE_FORMATS = Object.keys(FORMAT_LABELS)

export default function OnboardingPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/login')
      } else {
        setChecking(false)
      }
    })
  }, [router])

  const toggle = (format: string) => {
    setSelected((prev) =>
      prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format]
    )
  }

  const handleSubmit = async () => {
    if (selected.length === 0) {
      setError('1つ以上選択してください')
      return
    }
    setSaving(true)
    setError('')

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.replace('/login')
      return
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ main_formats: selected })
      .eq('id', user.id)

    if (updateError) {
      setError('保存に失敗しました。もう一度お試しください。')
      setSaving(false)
      return
    }

    router.replace('/')
    router.refresh()
  }

  if (checking) return null

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <h1 className="text-xl font-bold text-gray-800 text-center">
          よく遊ぶフォーマットを選んでください
        </h1>
        <p className="mt-2 text-sm text-gray-500 text-center">
          あとから変更できます。1つ以上選択してください。
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2">
          {SELECTABLE_FORMATS.map((format) => {
            const isSelected = selected.includes(format)
            const colors = FORMAT_COLORS[format]
            return (
              <button
                key={format}
                onClick={() => toggle(format)}
                className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                  isSelected
                    ? `${colors.bg} ${colors.text} border-current`
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                {FORMAT_LABELS[format]}
              </button>
            )
          })}
        </div>

        {error && <p className="mt-4 text-sm text-red-500 text-center">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? '保存中...' : 'はじめる'}
        </button>
      </div>
    </div>
  )
}
