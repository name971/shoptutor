'use client'

import { useMemo, useState } from 'react'
import { Event, OTHER_FORMAT_KEYS, FORMAT_HEX } from '@/types'
import Chip from '@/components/ui/Chip'
import ReminderButton from '@/components/event/ReminderButton'
import ChipRow from '@/components/ui/ChipRow'
import FormatShareBar from '@/components/charts/FormatShareBar'
import WeekdayEventsChart from '@/components/charts/WeekdayEventsChart'
import FormatBadge from '@/components/ui/FormatBadge'
import { isEventPast, formatEventWhen } from '@/lib/eventTime'

type FormatCount = {
  key: string
  label: string
  count: number
}

type Props = {
  formatCounts: FormatCount[]
  events: Event[]
  weeklyEventCount: number
  // リマインダーに保存する店舗の情報
  shopId: string
  shopName: string
}

const PAGE_SIZE = 10

export default function OfficialEventsSection({ formatCounts, events, weeklyEventCount, shopId, shopName }: Props) {
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // 内訳の棒と凡例のチップを同じ順（回数の多い順）にそろえる
  const sortedFormatCounts = useMemo(() => [...formatCounts].sort((a, b) => b.count - a.count), [formatCounts])

  const upcomingEvents = useMemo(
    () => events.filter((e) => !isEventPast(e.held_at, e.start_time)),
    [events]
  )

  const filteredEvents = upcomingEvents
    .filter(
      (e) =>
        !selectedFormat ||
        (selectedFormat === 'other' ? OTHER_FORMAT_KEYS.includes(e.format) : e.format === selectedFormat)
    )
    .filter((e) => !selectedDay || e.held_at === selectedDay)
  const visibleEvents = filteredEvents.slice(0, visibleCount)

  const handleSelectDay = (day: string | null) => {
    setSelectedDay(day)
    setVisibleCount(PAGE_SIZE)
  }

  const handleSelectFormat = (format: string | null) => {
    setSelectedFormat(format)
    setVisibleCount(PAGE_SIZE)
  }

  if (upcomingEvents.length === 0) {
    return (
      <div className="surface p-4">
        <h2 className="font-bold text-base text-gray-900 mb-2">イベント</h2>
        <div className="text-sm text-gray-500">今週のイベント情報はありません</div>
      </div>
    )
  }

  return (
    <div className="surface p-4">
      <h2 className="font-bold text-base text-slate-900 mb-3">イベント</h2>

      <div className="flex flex-col gap-4 mb-4">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xs font-bold text-slate-500">遊ばれているフォーマット（週）</h3>
          <FormatShareBar items={sortedFormatCounts} selected={selectedFormat} onSelect={handleSelectFormat} />
          {/* 凡例を兼ねたチップ（名前＋週の回数）。押すとそのフォーマットに絞る */}
          <ChipRow className="-mx-4">
            <Chip selected={selectedFormat === null} onClick={() => handleSelectFormat(null)}>
              すべて <span className="tabular-nums opacity-70">{weeklyEventCount}</span>
            </Chip>
            {sortedFormatCounts.map((f) => (
              <Chip
                key={f.key}
                selected={selectedFormat === f.key}
                onClick={() => handleSelectFormat(selectedFormat === f.key ? null : f.key)}
              >
                <span aria-hidden className="w-2 h-2 rounded-full" style={{ background: FORMAT_HEX[f.key] ?? FORMAT_HEX.other }} />
                {f.label} <span className="tabular-nums opacity-70">{f.count}</span>
              </Chip>
            ))}
          </ChipRow>
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xs font-bold text-slate-500">日別の開催数（今後7日）</h3>
          <WeekdayEventsChart
            dates={upcomingEvents
              .filter(
                (e) =>
                  !selectedFormat ||
                  (selectedFormat === 'other' ? OTHER_FORMAT_KEYS.includes(e.format) : e.format === selectedFormat)
              )
              .map((e) => e.held_at)}
            selectedDay={selectedDay}
            onSelectDay={handleSelectDay}
          />
        </div>
      </div>

      {filteredEvents.length > 0 ? (
        <>
          <div className="flex flex-col gap-1">
            {visibleEvents.map((event) => (
              <div key={event.id} className="flex items-center gap-3 text-sm py-1 border-t">
                <span className="w-28 flex-shrink-0 text-xs font-bold text-gray-900 tabular-nums">
                  {formatEventWhen(event.held_at, event.start_time)}
                </span>
                <span className="text-gray-700 truncate flex-1 min-w-0">{event.title}</span>
                <FormatBadge format={event.format} size="sm" />
                <ReminderButton
                  className="-mr-2"
                  source={{
                    shopId,
                    shopName,
                    title: event.title,
                    format: event.format,
                    heldAt: event.held_at,
                    startTime: event.start_time,
                  }}
                />
              </div>
            ))}
          </div>
          {filteredEvents.length > visibleCount && (
            <button
              onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
              className="w-full text-center text-sm font-medium text-blue-600 hover:underline pt-3"
            >
              もっと見る
            </button>
          )}
        </>
      ) : (
        (selectedFormat || selectedDay) && (
          <div className="text-xs text-slate-500 pt-2 border-t">条件に合うイベントはありません</div>
        )
      )}
    </div>
  )
}
