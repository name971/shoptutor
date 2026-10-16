'use client'

import { useState } from 'react'
import { addDaysToKey, jstDateKey, weekdayOfKey } from '@/lib/eventTime'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
// 棒の最大の高さ（px）。上に数値ラベルの余白を残す
const PLOT_HEIGHT = 72

type Props = {
  // 開催日（"YYYY-MM-DD"）の一覧。今日から7日分を数える
  dates: string[]
  selectedDay: string | null
  onSelectDay: (day: string | null) => void
}

// 今後7日間の日別開催数（縦棒・単色）。選んだ日を濃く、他を薄くして強調する。押すとその日で絞り込む
export default function WeekdayEventsChart({ dates, selectedDay, onSelectDay }: Props) {
  const [hovered, setHovered] = useState<string | null>(null)
  const today = jstDateKey()
  const days = Array.from({ length: 7 }, (_, i) => addDaysToKey(today, i))
  const counts = days.map((d) => dates.filter((x) => x === d).length)
  const max = Math.max(...counts, 1)
  const maxIndex = counts.indexOf(Math.max(...counts))

  const dayLabel = (d: string, i: number) => (i === 0 ? '今日' : WEEKDAYS[weekdayOfKey(d)])
  const fullLabel = (d: string) => {
    const [, m, day] = d.split('-').map(Number)
    return `${m}/${day}(${WEEKDAYS[weekdayOfKey(d)]})`
  }
  const activeIndex = days.indexOf(hovered ?? selectedDay ?? '')

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end gap-1.5 h-24 border-b border-slate-200" onMouseLeave={() => setHovered(null)}>
        {days.map((d, i) => {
          const count = counts[i]
          const isSelected = selectedDay === d
          const emphasized = selectedDay === null ? true : isSelected
          const showValue = isSelected || (selectedDay === null && i === maxIndex && count > 0)
          return (
            <button
              key={d}
              type="button"
              onClick={() => onSelectDay(isSelected ? null : d)}
              onMouseEnter={() => setHovered(d)}
              onFocus={() => setHovered(d)}
              onBlur={() => setHovered(null)}
              aria-pressed={isSelected}
              aria-label={`${fullLabel(d)} ${count}件`}
              className="flex-1 h-full flex flex-col items-center justify-end gap-0.5 focus-visible:outline-2 focus-visible:outline-slate-900 rounded-t"
            >
              {showValue && <span className="text-[11px] font-bold text-slate-900 tabular-nums">{count}</span>}
              <span
                className={`w-full max-w-7 flex-shrink-0 rounded-t transition-colors ${
                  emphasized ? (isSelected ? 'bg-blue-700' : 'bg-blue-500') : 'bg-blue-200'
                }`}
                style={{ height: count > 0 ? Math.max((count / max) * PLOT_HEIGHT, 4) : 2 }}
              />
            </button>
          )
        })}
      </div>
      <div className="flex gap-1.5">
        {days.map((d, i) => (
          <span
            key={d}
            className={`flex-1 text-center text-[11px] ${
              selectedDay === d ? 'font-bold text-slate-900' : weekdayOfKey(d) === 0 ? 'text-red-500' : weekdayOfKey(d) === 6 ? 'text-blue-600' : 'text-slate-500'
            }`}
          >
            {dayLabel(d, i)}
          </span>
        ))}
      </div>
      <div className="h-4 text-xs text-slate-500" aria-live="polite">
        {activeIndex >= 0 ? (
          <>
            <span className="font-bold text-slate-900">{fullLabel(days[activeIndex])}</span>{' '}
            <span className="tabular-nums">{counts[activeIndex]}</span>件
          </>
        ) : null}
      </div>
    </div>
  )
}
