'use client'

import { addDaysToKey, jstDateKey, weekdayOfKey } from '@/lib/eventTime'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

type Props = {
  // 選択中の日付（"YYYY-MM-DD"）か、7日間すべてなら 'week'
  selected: string
  onSelect: (day: string) => void
  // 日ごとの件数（未取得の日は表示しない）
  counts: Map<string, number>
}

// 今日から7日分の日付を横に並べたカレンダー帯。各日の件数も出す
export default function DateStrip({ selected, onSelect, counts }: Props) {
  const today = jstDateKey()
  const days = Array.from({ length: 7 }, (_, i) => addDaysToKey(today, i))
  const weekTotal = days.reduce((sum, d) => sum + (counts.get(d) ?? 0), 0)

  const cellClass = (active: boolean) =>
    `flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 transition-colors ${
      active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'
    }`

  return (
    <div className="flex gap-1" role="group" aria-label="日付">
      {days.map((d, i) => {
        const weekday = weekdayOfKey(d)
        const active = selected === d
        const label = i === 0 ? '今日' : i === 1 ? '明日' : WEEKDAYS[weekday]
        const count = counts.get(d)
        return (
          <button
            key={d}
            type="button"
            onClick={() => onSelect(d)}
            aria-pressed={active}
            aria-label={`${Number(d.slice(5, 7))}月${Number(d.slice(8))}日（${WEEKDAYS[weekday]}）${count !== undefined ? ` ${count}件` : ''}`}
            className={cellClass(active)}
          >
            <span
              className={`text-[11px] font-semibold ${
                active ? 'text-white/80' : weekday === 0 ? 'text-red-500' : weekday === 6 ? 'text-blue-600' : 'text-slate-500'
              }`}
            >
              {label}
            </span>
            <span className="text-lg font-bold leading-none tabular-nums">{Number(d.slice(8))}</span>
            <span className={`text-[11px] tabular-nums ${active ? 'text-white/70' : 'text-slate-400'}`}>
              {count !== undefined ? count : ' '}
            </span>
          </button>
        )
      })}
      <button
        type="button"
        onClick={() => onSelect('week')}
        aria-pressed={selected === 'week'}
        aria-label={`7日間すべて ${weekTotal}件`}
        className={cellClass(selected === 'week')}
      >
        <span className={`text-[11px] font-semibold ${selected === 'week' ? 'text-white/80' : 'text-slate-500'}`}>7日間</span>
        <span className="text-sm font-bold leading-none">すべて</span>
        <span className={`text-[11px] tabular-nums ${selected === 'week' ? 'text-white/70' : 'text-slate-400'}`}>
          {counts.size > 0 ? weekTotal : ' '}
        </span>
      </button>
    </div>
  )
}
