'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BellRing, X } from 'lucide-react'
import { FORMAT_HEX } from '@/types'
import { formatEventWhen, isEventPast } from '@/lib/eventTime'
import { removeReminder, useReminders } from '@/lib/reminders'

const COLLAPSED_COUNT = 3

// ホーム上部に出す、リマインド中のイベント（開催日時の早い順）。1件もなければ何も出さない
export default function ReminderList() {
  const reminders = useReminders().filter((r) => !isEventPast(r.heldAt, r.startTime))
  const [expanded, setExpanded] = useState(false)
  if (reminders.length === 0) return null

  const visible = expanded ? reminders : reminders.slice(0, COLLAPSED_COUNT)

  return (
    <section className="surface p-3 flex flex-col gap-1" aria-label="リマインド中のイベント">
      <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 px-1">
        <BellRing size={16} className="text-blue-600 fill-blue-100" />
        リマインド中
        <span className="text-slate-400 font-semibold tabular-nums">{reminders.length}</span>
      </h2>
      <ul className="flex flex-col">
        {visible.map((r) => (
          <li key={r.key} className="flex items-center gap-2 border-t border-slate-100 first:border-t-0">
            <Link href={`/shops/${r.shopId}`} className="flex-1 min-w-0 flex items-center gap-2 py-2 px-1 hover:bg-slate-50 rounded-lg">
              <span aria-hidden className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: FORMAT_HEX[r.format] ?? FORMAT_HEX.other }} />
              <span className="text-xs font-bold text-slate-900 whitespace-nowrap tabular-nums">
                {formatEventWhen(r.heldAt, r.startTime)}
              </span>
              <span className="text-xs text-slate-600 truncate">
                {r.shopName}
                {r.title && <span className="text-slate-400">　{r.title}</span>}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => removeReminder(r.key)}
              aria-label={`${r.shopName}のリマインドを外す`}
              className="p-2 text-slate-300 hover:text-slate-500 flex-shrink-0"
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
      {reminders.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-semibold text-blue-600 self-start px-1 pt-1"
        >
          {expanded ? '閉じる' : `すべて見る（${reminders.length}件）`}
        </button>
      )}
    </section>
  )
}
