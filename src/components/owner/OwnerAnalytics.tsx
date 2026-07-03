'use client'

import { useEffect, useState } from 'react'
import { FORMAT_LABELS } from '@/types'

function toCsv(data: Analytics): string {
  const lines: string[] = []
  lines.push(`訪問者分析,直近${data.days}日`)
  lines.push('')
  lines.push('区分,件数')
  lines.push(`総閲覧数,${data.total_views}`)
  lines.push(`お気に入り済み,${data.member_fav_views}`)
  lines.push(`未お気に入り（ログイン）,${data.member_nonfav_views}`)
  lines.push(`未ログイン,${data.anon_views}`)
  lines.push('')
  lines.push('時間帯,件数')
  data.hourly.forEach((h) => lines.push(`${h.hour}時,${h.count}`))
  lines.push('')
  lines.push('フォーマット,ユニーク人数')
  data.format_counts.forEach((f) => lines.push(`${FORMAT_LABELS[f.format] ?? f.format},${f.count}`))
  return lines.join('\n')
}

function downloadCsv(data: Analytics) {
  const csv = toCsv(data)
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `shoptutor-analytics-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

type Analytics = {
  days: number
  total_views: number
  anon_views: number
  member_fav_views: number
  member_nonfav_views: number
  hourly: { hour: number; count: number }[]
  format_counts: { format: string; count: number }[]
}

export default function OwnerAnalytics() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/owner/analytics')
      if (!res.ok) {
        setError('分析データの取得に失敗しました')
        setLoading(false)
        return
      }
      setData(await res.json())
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-xl border p-3">
        <div className="font-medium text-sm mb-2">訪問者分析</div>
        <div className="text-xs text-gray-400">読み込み中...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-xl border p-3">
        <div className="font-medium text-sm mb-2">訪問者分析</div>
        <div className="text-xs text-red-500">{error}</div>
      </div>
    )
  }

  const maxFormatCount = Math.max(1, ...data.format_counts.map((f) => f.count))
  const maxHourlyCount = Math.max(1, ...data.hourly.map((h) => h.count))
  const pct = (n: number) => (data.total_views === 0 ? 0 : Math.round((n / data.total_views) * 100))

  const BREAKDOWN = [
    { key: 'member_fav_views', label: 'お気に入り済み', value: data.member_fav_views, color: 'bg-blue-500' },
    { key: 'member_nonfav_views', label: '未お気に入り（ログイン）', value: data.member_nonfav_views, color: 'bg-sky-300' },
    { key: 'anon_views', label: '未ログイン', value: data.anon_views, color: 'bg-gray-300' },
  ] as const

  return (
    <div className="bg-white rounded-xl border p-3 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm">訪問者分析（直近{data.days}日）</div>
        <button
          type="button"
          onClick={() => downloadCsv(data)}
          className="text-xs text-blue-600 hover:underline flex-shrink-0"
        >
          CSVダウンロード
        </button>
      </div>

      <div>
        <div className="text-xs text-gray-500 mb-1">
          閲覧数 <span className="text-base font-medium text-gray-800">{data.total_views}</span>件
        </div>
        <div className="flex w-full h-2.5 rounded-full overflow-hidden bg-gray-100">
          {BREAKDOWN.map((b) => (
            <div key={b.key} className={b.color} style={{ width: `${pct(b.value)}%` }} />
          ))}
        </div>
        <div className="flex flex-col gap-1 mt-2">
          {BREAKDOWN.map((b) => (
            <div key={b.key} className="flex items-center gap-2 text-xs text-gray-600">
              <span className={`w-2.5 h-2.5 rounded-full ${b.color} flex-shrink-0`} />
              <span className="flex-1">{b.label}</span>
              <span className="font-medium">{b.value}件（{pct(b.value)}%）</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs text-gray-500 mb-2">時間帯別の閲覧傾向</div>
        <div className="flex items-end gap-[2px] h-14">
          {data.hourly.map((h) => (
            <div
              key={h.hour}
              className="flex-1 bg-blue-400 rounded-sm"
              style={{ height: `${(h.count / maxHourlyCount) * 100}%`, minHeight: h.count > 0 ? '2px' : '0' }}
              title={`${h.hour}時: ${h.count}件`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-gray-400 mt-1">
          <span>0時</span>
          <span>12時</span>
          <span>23時</span>
        </div>
      </div>

      <div>
        <div className="text-xs text-gray-500 mb-2">訪問者のよく遊ぶフォーマット（ユニーク人数）</div>
        {data.format_counts.length === 0 ? (
          <div className="text-xs text-gray-400">まだデータがありません</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {data.format_counts.map((f) => (
              <div key={f.format} className="flex items-center gap-2">
                <div className="text-xs text-gray-600 w-24 flex-shrink-0">
                  {FORMAT_LABELS[f.format] ?? f.format}
                </div>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-blue-400 rounded-full h-2"
                    style={{ width: `${(f.count / maxFormatCount) * 100}%` }}
                  />
                </div>
                <div className="text-xs font-medium w-8 text-right">{f.count}人</div>
              </div>
            ))}
            <p className="text-[10px] text-gray-400 mt-0.5">
              ※ 延べ人数（複数フォーマットを登録している人は該当する全フォーマットに計上されます）
            </p>
          </div>
        )}
      </div>

      <p className="text-[10px] text-gray-400">
        ※ ログイン済み訪問者の登録フォーマットを匿名集計したものです。個人を特定する情報は含まれません。
      </p>
    </div>
  )
}
