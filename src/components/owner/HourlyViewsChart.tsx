'use client'

import { useState } from 'react'

type Props = {
  hourly: { hour: number; views: number }[]
}

// 時間帯ごとの閲覧数（24本の縦棒・1色）。タップ・ホバーでその時間の数を出す
export default function HourlyViewsChart({ hourly }: Props) {
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(1, ...hourly.map((h) => h.views))
  const peak = hourly.reduce((a, b) => (b.views > a.views ? b : a), hourly[0])
  const current = active !== null ? hourly[active] : null

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-slate-600">
        {peak && peak.views > 0 ? (
          <>
            一番見られているのは <span className="font-bold text-slate-900">{peak.hour}時台</span>（{peak.views}件）
          </>
        ) : (
          'まだ閲覧はありません'
        )}
      </p>
      <div className="relative" onMouseLeave={() => setActive(null)}>
        <div className="flex items-end gap-[2px] h-28 border-b border-slate-200">
          {hourly.map((h, i) => (
            <button
              key={h.hour}
              type="button"
              className="flex-1 h-full flex items-end focus:outline-none group"
              aria-label={`${h.hour}時台 閲覧${h.views}件`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
            >
              <span
                className={`w-full rounded-t-[3px] transition-colors ${active === i ? 'bg-blue-800' : 'bg-blue-600'}`}
                style={{ height: `${h.views === 0 ? 0 : Math.max(3, (h.views / max) * 100)}%` }}
              />
            </button>
          ))}
        </div>
        {current && active !== null && (
          <div
            className="absolute -top-2 -translate-y-full -translate-x-1/2 px-2 py-1 rounded-lg bg-slate-900 text-white text-xs whitespace-nowrap pointer-events-none"
            style={{ left: `${Math.min(88, Math.max(12, ((active + 0.5) / 24) * 100))}%` }}
          >
            {current.hour}時台 <span className="font-bold tabular-nums">{current.views}</span>件
          </div>
        )}
      </div>
      <div className="relative h-4 text-[11px] text-slate-400 tabular-nums">
        {[0, 6, 12, 18].map((h) => (
          <span key={h} className={`absolute ${h === 0 ? '' : '-translate-x-1/2'}`} style={{ left: `${(h / 24) * 100}%` }}>
            {h}時
          </span>
        ))}
        <span className="absolute right-0">23時</span>
      </div>
    </div>
  )
}
