'use client'

import { useMemo, useState } from 'react'
import { Event, OTHER_FORMAT_KEYS, FORMAT_HEX } from '@/types'
import Chip from '@/components/ui/Chip'
import ChipRow from '@/components/ui/ChipRow'
import FormatShareBar from '@/components/charts/FormatShareBar'
import WeekdayEventsChart from '@/components/charts/WeekdayEventsChart'
import EventRow from '@/components/event/EventRow'
import { groupByDate } from '@/lib/groupByDate'
import { groupSameShopAndTime } from '@/lib/groupEvents'
import { isEventPast, isStartingSoon, formatDayHeading } from '@/lib/eventTime'

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
          {/* イベントタブと同じタイムライン（店名は出さない） */}
          <div className="flex flex-col gap-3 border-t border-slate-100 pt-3">
            {groupByDate(visibleEvents).map((group) => (
              <section key={group.date} className="flex flex-col">
                <h3 className="text-sm font-bold text-slate-900 pb-1">{formatDayHeading(group.date)}</h3>
                {groupSameShopAndTime(group.items).map((bundle) => (
                  <EventRow
                    key={bundle[0].id}
                    startTime={bundle[0].start_time}
                    soon={isStartingSoon(bundle[0].held_at, bundle[0].start_time)}
                    items={bundle.map((e) => ({
                      title: e.title,
                      format: e.format,
                      reminder: {
                        shopId,
                        shopName,
                        title: e.title,
                        format: e.format,
                        heldAt: e.held_at,
                        startTime: e.start_time,
                      },
                    }))}
                  />
                ))}
              </section>
            ))}
          </div>
          {filteredEvents.length > visibleCount && (
            <button
              onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
              className="w-full h-10 mt-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              もっと見る（残り{filteredEvents.length - visibleCount}件）
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
