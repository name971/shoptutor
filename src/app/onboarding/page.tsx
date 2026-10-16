'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import FormatOptionButton from '@/components/ui/FormatOptionButton'
import { createClient } from '@/lib/supabase'
import { FORMAT_LABELS, SUB_FORMAT_MAX } from '@/types'

const SELECTABLE_FORMATS = Object.keys(FORMAT_LABELS)

export default function OnboardingPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [mainFormat, setMainFormat] = useState<string | null>(null)
  const [subFormats, setSubFormats] = useState<string[]>([])
  const [agreedToTerms, setAgreedToTerms] = useState(false)
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

  const selectMain = (format: string) => {
    setMainFormat(format)
    setSubFormats((prev) => prev.filter((f) => f !== format))
  }

  const toggleSub = (format: string) => {
    if (format === mainFormat) return
    setSubFormats((prev) => {
      if (prev.includes(format)) return prev.filter((f) => f !== format)
      if (prev.length >= SUB_FORMAT_MAX) return prev
      return [...prev, format]
    })
  }

  const handleSubmit = async () => {
    if (!mainFormat) {
      setError('メインフォーマットを1つ選択してください')
      return
    }
    if (!agreedToTerms) {
      setError('利用規約への同意が必要です')
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
      .update({ main_format: mainFormat, sub_formats: subFormats, terms_agreed_at: new Date().toISOString() })
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
    <div className="min-h-screen bg-background px-4 py-10 flex flex-col items-center">
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="text-center flex flex-col items-center gap-2">
          <span className="text-[11px] font-extrabold text-blue-600 tracking-wider uppercase">ShopTutor へようこそ</span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">よく遊ぶフォーマットは？</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            イベントやレビューを、あなたに合わせて表示します。
            <br />
            メインを1つ、サブを最大{SUB_FORMAT_MAX}つまで選べます（あとから変更できます）。
          </p>
        </div>

        <div className="surface p-5 flex flex-col gap-5">
          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-bold text-slate-500">メインフォーマット（1つ）</h2>
            <div className="grid grid-cols-2 gap-2">
              {SELECTABLE_FORMATS.map((format) => (
                <FormatOptionButton
                  key={format}
                  format={format}
                  selected={mainFormat === format}
                  onClick={() => selectMain(format)}
                />
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-bold text-slate-500">サブフォーマット（最大{SUB_FORMAT_MAX}つ・任意）</h2>
            <div className="grid grid-cols-2 gap-2">
              {SELECTABLE_FORMATS.filter((f) => f !== mainFormat).map((format) => {
                const isSelected = subFormats.includes(format)
                return (
                  <FormatOptionButton
                    key={format}
                    format={format}
                    selected={isSelected}
                    disabled={!isSelected && subFormats.length >= SUB_FORMAT_MAX}
                    onClick={() => toggleSub(format)}
                  />
                )
              })}
            </div>
          </section>

          <label className="flex items-start gap-2.5 text-sm text-slate-600 bg-slate-50 rounded-xl p-3">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-blue-600"
            />
            <span>
              <Link href="/terms" target="_blank" className="text-blue-600 font-medium hover:underline">利用規約</Link>
              及び
              <Link href="/privacy" target="_blank" className="text-blue-600 font-medium hover:underline">プライバシーポリシー</Link>
              に同意する
            </span>
          </label>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 text-center">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full h-12 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? '保存中...' : 'はじめる'}
          </button>
        </div>
      </div>
    </div>
  )
}
