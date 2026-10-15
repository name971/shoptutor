'use client'

import { useMemo, useState } from 'react'
import { Event, OTHER_FORMAT_KEYS } from '@/types'
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
}

const PAGE_SIZE = 10

export default function OfficialEventsSection({ formatCounts, events, weeklyEventCount }: Props) {
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const upcomingEvents = useMemo(
    () => events.filter((e) => !isEventPast(e.held_at, e.start_time)),
    [events]
  )

  const filteredEvents = selectedFormat
    ? upcomingEvents.filter((e) =>
        selectedFormat === 'other' ? OTHER_FORMAT_KEYS.includes(e.format) : e.format === selectedFormat
      )
    : upcomingEvents
  const visibleEvents = filteredEvents.slice(0, visibleCount)

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
      <h2 className="font-bold text-base text-gray-900 mb-3">イベント</h2>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          onClick={() => handleSelectFormat(null)}
          className={`text-left rounded-lg p-2 transition-colors ${
            selectedFormat === null ? 'bg-blue-50 ring-1 ring-blue-300' : 'bg-gray-50'
          }`}
        >
          <div className="text-xs text-gray-500">週イベント</div>
          <div className="text-xl font-medium">
            {weeklyEventCount}<span className="text-xs text-gray-400">回</span>
          </div>
        </button>
        {formatCounts.map((f) => (
          <button
            key={f.key}
            onClick={() => handleSelectFormat(selectedFormat === f.key ? null : f.key)}
            className={`text-left rounded-lg p-2 transition-colors ${
              selectedFormat === f.key ? 'bg-blue-50 ring-1 ring-blue-300' : 'bg-gray-50'
            }`}
          >
            <div className="text-xs text-gray-500">{f.label}</div>
            <div className="text-xl font-medium">
              {f.count}<span className="text-xs text-gray-400">回/週</span>
            </div>
          </button>
        ))}
      </div>

      {filteredEvents.length > 0 ? (
        <>
          <div className="flex flex-col gap-1">
            {visibleEvents.map((event) => (
              <div key={event.id} className="flex items-center gap-3 text-sm py-2 border-t">
                <span className="w-28 flex-shrink-0 text-xs font-bold text-gray-900 tabular-nums">
                  {formatEventWhen(event.held_at, event.start_time)}
                </span>
                <span className="text-gray-700 truncate flex-1 min-w-0">{event.title}</span>
                <FormatBadge format={event.format} size="sm" />
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
        selectedFormat && (
          <div className="text-xs text-gray-400 pt-1 border-t">
            該当するイベントの詳細情報はありません
          </div>
        )
      )}
    </div>
  )
}
