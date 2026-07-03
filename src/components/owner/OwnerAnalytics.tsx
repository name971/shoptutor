'use client'

import { useEffect, useState } from 'react'
import { FORMAT_LABELS } from '@/types'

// バー積み上げ用の色（FORMAT_COLORSはバッジ用の淡色なので、チャート判別用に別途濃色を用意）
const FORMAT_CHART_COLORS: Record<string, string> = {
  commander: '#a855f7',
  standard: '#3b82f6',
  modern: '#22c55e',
  pioneer: '#14b8a6',
  legacy: '#ef4444',
  limited: '#f59e0b',
  vintage: '#ec4899',
  other: '#6b7280',
}

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土']

type Bucket = { count: number }

// CSVフィールドのエスケープ（カンマ・改行・ダブルクォートを含む値を""で囲む）
function csvField(value: string | number): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function csvRow(fields: (string | number)[]): string {
  return fields.map(csvField).join(',')
}

function toCsv(data: Analytics): string {
  const lines: string[] = []

  lines.push(csvRow(['訪問者分析', `直近${data.days}日`]))
  lines.push('')

  lines.push(csvRow(['区分', '件数']))
  lines.push(csvRow(['総閲覧数', data.total_views]))
  lines.push(csvRow(['お気に入り済み', data.member_fav_views]))
  lines.push(csvRow(['未お気に入り（ログイン）', data.member_nonfav_views]))
  lines.push(csvRow(['未ログイン', data.anon_views]))
  lines.push('')

  lines.push(csvRow(['時間帯', '件数']))
  data.hourly.forEach((h) => lines.push(csvRow([`${h.hour}時`, h.count])))
  lines.push('')

  lines.push(csvRow(['曜日', '件数']))
  data.dow_total.forEach((d) => lines.push(csvRow([DOW_LABELS[d.dow], d.count])))
  lines.push('')

  lines.push(csvRow(['フォーマット', 'ユニーク人数', 'うちメイン']))
  data.format_counts.forEach((f) =>
    lines.push(csvRow([FORMAT_LABELS[f.format] ?? f.format, f.count, f.main_count]))
  )
  lines.push('')

  const hourLabels = Array.from({ length: 24 }, (_, h) => `${h}時`)
  lines.push(csvRow(['フォーマット別の時間帯', '区分', ...hourLabels]))
  data.format_counts.forEach((f) => {
    const label = FORMAT_LABELS[f.format] ?? f.format
    lines.push(csvRow([label, 'メイン', ...(data.format_hourly_main[f.format] ?? []).map((h) => h.count)]))
    lines.push(csvRow([label, 'サブ', ...(data.format_hourly_sub[f.format] ?? []).map((h) => h.count)]))
  })
  lines.push('')

  lines.push(csvRow(['フォーマット別の曜日', '区分', ...DOW_LABELS]))
  data.format_counts.forEach((f) => {
    const label = FORMAT_LABELS[f.format] ?? f.format
    lines.push(csvRow([label, 'メイン', ...(data.format_dow_main[f.format] ?? []).map((d) => d.count)]))
    lines.push(csvRow([label, 'サブ', ...(data.format_dow_sub[f.format] ?? []).map((d) => d.count)]))
  })

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
  dow_total: { dow: number; count: number }[]
  format_counts: { format: string; count: number; main_count: number }[]
  format_hourly_main: Record<string, Bucket[]>
  format_hourly_sub: Record<string, Bucket[]>
  format_dow_main: Record<string, { dow: number; count: number }[]>
  format_dow_sub: Record<string, { dow: number; count: number }[]>
}

// フォーマット別に積み上げる。メイン/サブは呼び出し側でデータを切り替えて渡す
// （濃淡での区別は視認性が低かったため、タブ切り替え方式に変更）
function StackedChart({
  buckets,
  labels,
  formatCounts,
  countsByFormat,
}: {
  buckets: number
  labels: string[]
  formatCounts: Analytics['format_counts']
  countsByFormat: Record<string, Bucket[]>
}) {
  const bars = Array.from({ length: buckets }, (_, i) => {
    const segments = formatCounts.map((f) => ({
      format: f.format,
      count: countsByFormat[f.format]?.[i]?.count ?? 0,
    }))
    return { key: i, segments, total: segments.reduce((sum, s) => sum + s.count, 0) }
  })
  const max = Math.max(1, ...bars.map((b) => b.total))
  const gridLineCounts = [1, 0.5, 0].map((frac) => Math.round(max * frac))

  return (
    <div>
      <div className="flex gap-1.5">
        <div className="flex flex-col justify-between h-16 text-[9px] text-gray-400 text-right w-5 flex-shrink-0">
          {gridLineCounts.map((n, i) => (
            <span key={i}>{n}</span>
          ))}
        </div>
        <div className="flex-1 relative">
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {gridLineCounts.map((n, i) => (
              <div key={i} className="border-t border-gray-100" />
            ))}
          </div>
          <div className="relative flex items-end gap-[2px] h-16">
            {bars.map((b) => (
              <div key={b.key} className="flex-1 h-full flex flex-col justify-end" title={`${labels[b.key]}: 計${b.total}人`}>
                {b.segments.map((s) =>
                  s.count === 0 ? null : (
                    <div
                      key={s.format}
                      style={{
                        height: `${(s.count / max) * 100}%`,
                        backgroundColor: FORMAT_CHART_COLORS[s.format] ?? '#9ca3af',
                      }}
                      title={`${labels[b.key]} ${FORMAT_LABELS[s.format] ?? s.format}: ${s.count}人`}
                    />
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex text-[9px] text-gray-400 mt-1 ml-[26px]">
        {labels.map((l, i) => (
          <span key={i} className="flex-1 text-center">{l}</span>
        ))}
      </div>
    </div>
  )
}

export default function OwnerAnalytics() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tone, setTone] = useState<'main' | 'sub'>('main')

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
  const pct = (n: number) => (data.total_views === 0 ? 0 : Math.round((n / data.total_views) * 100))

  const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => (h % 6 === 0 ? `${h}時` : ''))
  const DOW_CHART_LABELS = DOW_LABELS

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
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-500">閲覧傾向（フォーマット別）</div>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs flex-shrink-0">
            <button
              type="button"
              onClick={() => setTone('main')}
              className={`px-2.5 py-1 transition-colors ${tone === 'main' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500'}`}
            >
              メイン
            </button>
            <button
              type="button"
              onClick={() => setTone('sub')}
              className={`px-2.5 py-1 transition-colors ${tone === 'sub' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500'}`}
            >
              サブ
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          {data.format_counts.map((f) => (
            <span key={f.format} className="flex items-center gap-1 text-[9px] text-gray-500">
              <span
                className="w-2 h-2 rounded-sm inline-block"
                style={{ backgroundColor: FORMAT_CHART_COLORS[f.format] ?? '#9ca3af' }}
              />
              {FORMAT_LABELS[f.format] ?? f.format}
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <div className="text-[10px] text-gray-500 mb-1">時間帯別</div>
            <StackedChart
              buckets={24}
              labels={HOUR_LABELS}
              formatCounts={data.format_counts}
              countsByFormat={tone === 'main' ? data.format_hourly_main : data.format_hourly_sub}
            />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 mb-1">曜日別</div>
            <StackedChart
              buckets={7}
              labels={DOW_CHART_LABELS}
              formatCounts={data.format_counts}
              countsByFormat={tone === 'main' ? data.format_dow_main : data.format_dow_sub}
            />
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">
          ※ 棒の高さ＝そのフォーマットを{tone === 'main' ? 'メインに選んでいる' : 'サブに選んでいる'}訪問者の実人数
          {tone === 'sub' && '（サブを2つ登録している人は両方の棒に計上されるため、時間帯・曜日合計は実訪問者数を上回ることがあります）'}
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-500">訪問者のよく遊ぶフォーマット</div>
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" />メイン</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-200 inline-block" />サブ</span>
          </div>
        </div>
        {data.format_counts.length === 0 ? (
          <div className="text-xs text-gray-400">まだデータがありません</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {data.format_counts.map((f) => (
              <div key={f.format} className="flex items-center gap-2">
                <div className="text-xs text-gray-600 w-24 flex-shrink-0">
                  {FORMAT_LABELS[f.format] ?? f.format}
                </div>
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden flex">
                  <div
                    className="bg-blue-500 h-2"
                    style={{ width: `${(f.main_count / maxFormatCount) * 100}%` }}
                  />
                  <div
                    className="bg-blue-200 h-2"
                    style={{ width: `${((f.count - f.main_count) / maxFormatCount) * 100}%` }}
                  />
                </div>
                <div className="text-xs font-medium w-10 text-right">{f.count}人</div>
              </div>
            ))}
            <p className="text-[10px] text-gray-400 mt-0.5">
              ※ 延べ人数（サブフォーマットも含む）。メインに選んでいる人が本命ファンの目安です
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
