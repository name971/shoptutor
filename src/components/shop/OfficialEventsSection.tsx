'use client'

import { useState } from 'react'
import { Event } from '@/types'
import FormatBadge from '@/components/ui/FormatBadge'

type FormatCount = {
  key: string
  label: string
  count: number
}

type Props = {
  weeklyEventCount: number
  formatCounts: FormatCount[]
  events: Event[]
}

const PAGE_SIZE = 10

// shops.other_countは other/vintage/unknown をまとめた集計値なので、
// 「その他」で絞り込む際もこの3つをまとめて対象にする
const OTHER_FORMAT_KEYS = ['other', 'vintage', 'unknown']

export default function OfficialEventsSection({ weeklyEventCount, formatCounts, events }: Props) {
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const filteredEvents = selectedFormat
    ? events.filter((e) =>
        selectedFormat === 'other' ? OTHER_FORMAT_KEYS.includes(e.format) : e.format === selectedFormat
      )
    : events
  const visibleEvents = filteredEvents.slice(0, visibleCount)

  const handleSelectFormat = (format: string | null) => {
    setSelectedFormat(format)
    setVisibleCount(PAGE_SIZE)
  }

  if (weeklyEventCount === 0) {
    return (
      <div className="bg-white rounded-xl border p-3">
        <div className="font-medium text-sm mb-3 flex items-center gap-1">📅 公式イベント情報</div>
        <div className="text-xs text-gray-400">今週のイベント情報はありません</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border p-3">
      <div className="font-medium text-sm mb-3 flex items-center gap-1">📅 公式イベント情報</div>

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
              <div key={event.id} className="flex items-center justify-between text-xs py-1 border-t">
                <span className="text-gray-700 truncate flex-1">{event.title}</span>
                <div className="flex items-center gap-2 ml-2">
                  <FormatBadge format={event.format} size="sm" />
                  <span className="text-gray-600 whitespace-nowrap">
                    {event.held_at}
                    {event.start_time && ` ${event.start_time}〜`}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {filteredEvents.length > visibleCount && (
            <button
              onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
              className="w-full text-center text-xs text-blue-600 hover:underline pt-2"
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
