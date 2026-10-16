'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Star, Trophy, Lock, MapPinOff } from 'lucide-react'
import Chip from '@/components/ui/Chip'
import ChipRow from '@/components/ui/ChipRow'
import { SkeletonBlock } from '@/components/ui/Skeleton'
import { FORMAT_LABELS, FORMAT_HEX } from '@/types'

type Metric = { mine: number | null; average: number | null; rank: number | null; of: number }
type Compare = {
  scope: 'prefecture' | 'near'
  km: number
  prefecture: string
  hasLocation: boolean
  shopCount: number
  metrics: { weekly_events: Metric; rating: Metric; reviews: Metric; favorites: Metric; views: Metric }
  formats: { mine: { key: string; share: number }[]; area: { key: string; share: number }[] }
  competitors: {
    id: string
    name: string
    city: string | null
    distance: number | null
    weekly_event_count: number
    review_count: number
    avg_total: number | null
    favorite_count: number
    main_format: string | null
    is_me: boolean
  }[]
}

type Scope = { key: string; label: string; query: string }

const COMPETITOR_LIMIT = 20

// 同じ都道府県・周辺の店舗との比較。他店の閲覧数は出さず、地域の平均と自店の順位だけ
export default function OwnerCompare() {
  const [scopeKey, setScopeKey] = useState('prefecture')
  const [data, setData] = useState<Compare | null>(null)
  const [error, setError] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const scopes: Scope[] = [
    { key: 'prefecture', label: data ? `${data.prefecture}内` : '都道府県内', query: 'scope=prefecture' },
    ...[3, 5, 10, 20].map((km) => ({ key: `near${km}`, label: `周辺${km}km`, query: `scope=near&km=${km}` })),
  ]
  const scope = scopes.find((s) => s.key === scopeKey) ?? scopes[0]

  useEffect(() => {
    let cancelled = false
    fetch(`/api/owner/compare?${scope.query}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((d) => {
        if (!cancelled) {
          setData(d)
          setError(false)
        }
      })
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [scope.query])

  const changeScope = (key: string) => {
    setScopeKey(key)
    setShowAll(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <ChipRow innerClassName="px-0">
        {scopes.map((s) => (
          <Chip key={s.key} selected={scopeKey === s.key} onClick={() => changeScope(s.key)}>
            {s.label}
          </Chip>
        ))}
      </ChipRow>

      {error ? (
        <p className="text-sm text-red-600">比較の情報を取得できませんでした。再読み込みしてください。</p>
      ) : !data ? (
        <div className="flex flex-col gap-3">
          <SkeletonBlock className="h-56" />
          <SkeletonBlock className="h-40" />
        </div>
      ) : data.scope === 'near' && !data.hasLocation ? (
        <p className="surface p-4 text-sm text-slate-600 inline-flex items-start gap-2">
          <MapPinOff size={16} className="mt-0.5 flex-shrink-0 text-slate-400" />
          店舗の位置情報が未登録のため、周辺の比較ができません。都道府県内の比較をご利用ください。
        </p>
      ) : (
        <>
          <MetricsTable data={data} />
          <FormatComparison data={data} />
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-bold text-slate-900">
              {scope.label}の店舗（{data.shopCount}店・週のイベントが多い順）
            </h2>
            <div className="surface divide-y divide-slate-100 overflow-hidden">
              {(showAll ? data.competitors : data.competitors.slice(0, COMPETITOR_LIMIT)).map((c, i) => (
                <div key={c.id} className={`px-3 py-2.5 flex items-center gap-3 ${c.is_me ? 'bg-blue-50' : ''}`}>
                  <span className="w-6 text-right text-xs font-bold text-slate-400 tabular-nums flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate flex items-center gap-1.5">
                      {c.is_me ? (
                        <>
                          <span className="truncate">{c.name}</span>
                          <span className="flex-shrink-0 text-[11px] px-1.5 rounded bg-blue-600 text-white">自店</span>
                        </>
                      ) : (
                        <Link href={`/shops/${c.id}`} target="_blank" className="truncate hover:underline">
                          {c.name}
                        </Link>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                      {c.city && <span>{c.city}</span>}
                      {data.scope === 'near' && c.distance !== null && !c.is_me && <span className="tabular-nums">{c.distance.toFixed(1)}km</span>}
                      {c.main_format && <span>{FORMAT_LABELS[c.main_format] ?? 'その他'}中心</span>}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right text-xs text-slate-600 tabular-nums leading-tight">
                    <div>
                      週<span className="font-bold text-slate-900">{c.weekly_event_count}</span>回
                    </div>
                    <div className="inline-flex items-center gap-0.5">
                      <Star size={11} className="fill-yellow-400 text-yellow-400" />
                      {c.review_count > 0 && c.avg_total !== null ? Number(c.avg_total).toFixed(1) : '—'}
                      <span className="text-slate-400">（{c.review_count}）</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {!showAll && data.competitors.length > COMPETITOR_LIMIT && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="h-10 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                すべて見る（残り{data.competitors.length - COMPETITOR_LIMIT}店）
              </button>
            )}
          </section>
          <p className="text-[11px] text-slate-500 inline-flex items-start gap-1">
            <Lock size={12} className="mt-0.5 flex-shrink-0" />
            閲覧数は各店舗の非公開の情報のため、他店の数は表示せず、地域の平均と順位だけを出しています。店ごとの一覧はサイト上で誰でも見られる情報です。
          </p>
        </>
      )}
    </div>
  )
}

function MetricsTable({ data }: { data: Compare }) {
  const rows: { label: string; m: Metric; digits: number; unit: string }[] = [
    { label: '週のイベント数', m: data.metrics.weekly_events, digits: 1, unit: '回' },
    { label: 'レビューの★平均', m: data.metrics.rating, digits: 1, unit: '' },
    { label: 'レビュー数', m: data.metrics.reviews, digits: 1, unit: '件' },
    { label: 'お気に入り数', m: data.metrics.favorites, digits: 1, unit: '人' },
    { label: `閲覧数（30日）`, m: data.metrics.views, digits: 0, unit: '件' },
  ]
  const fmt = (v: number | null, digits: number) => (v === null ? '—' : Number.isInteger(v) && digits === 0 ? v.toLocaleString() : v.toFixed(digits).replace(/\.0$/, ''))

  return (
    <section className="surface overflow-hidden" aria-label="地域との比較">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="px-3 py-2 text-left font-medium">項目</th>
            <th className="px-3 py-2 text-right font-medium">自店</th>
            <th className="px-3 py-2 text-right font-medium">地域平均</th>
            <th className="px-3 py-2 text-right font-medium">順位</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, m, digits, unit }) => {
            const above = m.mine !== null && m.average !== null && m.mine > m.average
            const top3 = m.rank !== null && m.rank <= 3 && m.of > 1
            return (
              <tr key={label} className="border-t border-slate-100">
                <td className="px-3 py-2.5 text-slate-700">{label}</td>
                <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${above ? 'text-blue-700' : 'text-slate-900'}`}>
                  {fmt(m.mine, label.includes('★') ? 1 : 0)}
                  {m.mine !== null && <span className="text-xs font-medium">{unit}</span>}
                </td>
                <td className="px-3 py-2.5 text-right text-slate-500 tabular-nums">
                  {fmt(m.average, digits)}
                  {m.average !== null && <span className="text-xs">{unit}</span>}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                  {m.rank === null ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <span className={`inline-flex items-center gap-0.5 ${top3 ? 'font-bold text-amber-700' : 'text-slate-700'}`}>
                      {top3 && <Trophy size={12} />}
                      {m.rank}
                      <span className="text-xs text-slate-400">/{m.of}</span>
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

function FormatComparison({ data }: { data: Compare }) {
  const mine = new Map(data.formats.mine.map((f) => [f.key, f.share]))
  const rows = data.formats.area
    .map((f) => ({ key: f.key, area: f.share, mine: mine.get(f.key) ?? 0 }))
    .filter((r) => r.area > 0 || r.mine > 0)
    .sort((a, b) => b.area - a.area)
  const pct = (v: number) => Math.round(v * 100)
  // 地域では多いのに自店では少ないフォーマット（差が10ポイント以上のもの）
  const gap = rows.filter((r) => r.area - r.mine >= 0.1).sort((a, b) => b.area - b.mine - (a.area - a.mine))[0]

  return (
    <section className="surface p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900">遊ばれているフォーマット（週の開催回数の割合）</h2>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm bg-blue-600" />
          自店
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm bg-slate-300" />
          地域
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-3">
            <span className="w-24 flex-shrink-0 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: FORMAT_HEX[r.key] ?? FORMAT_HEX.other }} />
              {FORMAT_LABELS[r.key] ?? 'その他'}
            </span>
            <div className="flex-1 flex flex-col gap-[3px]">
              <Bar value={r.mine} className="bg-blue-600" label={`自店 ${pct(r.mine)}%`} />
              <Bar value={r.area} className="bg-slate-300" label={`地域 ${pct(r.area)}%`} />
            </div>
          </div>
        ))}
      </div>
      {gap && (
        <p className="text-xs text-slate-700 bg-amber-50 rounded-lg px-3 py-2">
          地域では<span className="font-bold">{FORMAT_LABELS[gap.key] ?? 'その他'}</span>が多く開かれています（地域{pct(gap.area)}%・自店{pct(gap.mine)}%）。
        </p>
      )}
    </section>
  )
}

function Bar({ value, className, label }: { value: number; className: string; label: string }) {
  return (
    <div className="flex items-center gap-2" aria-label={label}>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${className}`} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="w-14 text-right text-[11px] text-slate-600 tabular-nums">{label}</span>
    </div>
  )
}
