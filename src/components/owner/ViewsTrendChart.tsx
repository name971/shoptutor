'use client'

import { useState } from 'react'

type Props = {
  daily: { date: string; views: number }[]
}

function md(date: string) {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`
}

// 日ごとの閲覧数の推移（1系列の折れ線）。タップ・ホバーでその日の数を出す
export default function ViewsTrendChart({ daily }: Props) {
  const [active, setActive] = useState<number | null>(null)
  const n = daily.length
  const max = Math.max(1, ...daily.map((d) => d.views))
  // 目盛りは切りのいい数に
  const step = max <= 5 ? 1 : max <= 20 ? 5 : max <= 50 ? 10 : Math.ceil(max / 4 / 10) * 10
  const top = Math.ceil(max / step) * step
  const x = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100)
  const y = (v: number) => 100 - (v / top) * 100
  const points = daily.map((d, i) => `${x(i)},${y(d.views)}`).join(' ')
  const ticks = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step)
  const current = active !== null ? daily[active] : null

  return (
    <div className="flex gap-2">
      {/* 縦軸の目盛り */}
      <div className="relative w-7 h-36 flex-shrink-0 text-[11px] text-slate-400 tabular-nums">
        {ticks.map((t) => (
          <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${y(t)}%` }}>
            {t}
          </span>
        ))}
      </div>
      <div className="flex-1 min-w-0">
        <div className="relative h-36" onMouseLeave={() => setActive(null)}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible" aria-hidden>
            {ticks.map((t) => (
              <line key={t} x1={0} x2={100} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            <polygon points={`0,100 ${points} 100,100`} fill="#2563eb" fillOpacity={0.08} />
            <polyline points={points} fill="none" stroke="#2563eb" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {active !== null && (
              <line x1={x(active)} x2={x(active)} y1={0} y2={100} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            )}
          </svg>
          {active !== null && (
            <span
              className="absolute w-2.5 h-2.5 -ml-[5px] -mt-[5px] rounded-full bg-blue-600 ring-2 ring-white pointer-events-none"
              style={{ left: `${x(active)}%`, top: `${y(daily[active].views)}%` }}
            />
          )}
          {/* 日ごとの当たり判定（線より広く取る） */}
          <div className="absolute inset-0 flex">
            {daily.map((d, i) => (
              <button
                key={d.date}
                type="button"
                className="flex-1 h-full focus:outline-none"
                aria-label={`${md(d.date)} 閲覧${d.views}件`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
              />
            ))}
          </div>
          {current && active !== null && (
            <div
              className="absolute -top-2 -translate-y-full -translate-x-1/2 px-2 py-1 rounded-lg bg-slate-900 text-white text-xs whitespace-nowrap pointer-events-none"
              style={{ left: `${Math.min(88, Math.max(12, x(active)))}%` }}
            >
              {md(current.date)} <span className="font-bold tabular-nums">{current.views}</span>件
            </div>
          )}
        </div>
        <div className="flex justify-between text-[11px] text-slate-400 mt-1 tabular-nums">
          <span>{daily[0] ? md(daily[0].date) : ''}</span>
          <span>{daily[Math.floor(n / 2)] ? md(daily[Math.floor(n / 2)].date) : ''}</span>
          <span>{daily[n - 1] ? md(daily[n - 1].date) : ''}</span>
        </div>
      </div>
    </div>
  )
}
