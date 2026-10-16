'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { FORMAT_HEX, FORMAT_LABELS, FORMAT_COLORS } from '@/types'
import ReminderButton from './ReminderButton'
import type { Reminder } from '@/lib/reminders'

export type EventRowItem = {
  title: string | null
  format: string
  reminder?: Omit<Reminder, 'key'>
}

type Props = {
  href: string
  startTime: string | null
  shopName: string | undefined
  // 都道府県・距離など、店名の右に小さく出す補足
  meta?: React.ReactNode
  // 同じ店舗・同じ時刻のイベント。先頭を代表として出し、残りは「他N件」で開く
  items: EventRowItem[]
}

function FormatLabel({ format, title }: { format: string; title: string | null }) {
  return (
    <span className="flex items-center gap-1.5 text-xs min-w-0">
      <span aria-hidden className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: FORMAT_HEX[format] ?? FORMAT_HEX.other }} />
      <span className={`font-semibold flex-shrink-0 ${(FORMAT_COLORS[format] ?? FORMAT_COLORS.other).text}`}>
        {FORMAT_LABELS[format] ?? 'その他'}
      </span>
      {title && <span className="text-slate-500 truncate">{title}</span>}
    </span>
  )
}

// イベント一覧の1行。左に開始時刻、右は2段（店名＋補足／フォーマット＋イベント名）。ホームとお気に入りで共通
export default function EventRow({ href, startTime, shopName, meta, items }: Props) {
  const [open, setOpen] = useState(false)
  const [first, ...others] = items

  return (
    <div className="surface overflow-hidden">
      <div className="flex items-center pr-1">
        <Link href={href} className="flex-1 min-w-0 pl-3 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition-colors">
          <span className="w-12 flex-shrink-0 text-center text-base font-bold text-slate-900 tabular-nums">
            {startTime ?? '—'}
          </span>
          <span className="self-stretch w-px bg-slate-100" aria-hidden />
          <span className="flex-1 min-w-0 flex flex-col gap-0.5">
            <span className="flex items-baseline gap-2 min-w-0">
              <span className="flex-1 min-w-0 text-sm font-bold text-slate-900 truncate">{shopName}</span>
              {meta && <span className="flex-shrink-0 text-xs text-slate-400">{meta}</span>}
            </span>
            <FormatLabel format={first.format} title={first.title} />
          </span>
        </Link>
        {first.reminder && <ReminderButton source={first.reminder} />}
      </div>

      {others.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="w-full flex items-center gap-1 pl-[76px] pr-3 pb-2 text-xs font-semibold text-blue-600"
          >
            {open ? '閉じる' : `同じ時間に他${others.length}件`}
            <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open &&
            others.map((item, i) => (
              <div key={i} className="flex items-center pl-[76px] pr-1 border-t border-slate-100">
                <span className="flex-1 min-w-0 py-2">
                  <FormatLabel format={item.format} title={item.title} />
                </span>
                {item.reminder && <ReminderButton source={item.reminder} />}
              </div>
            ))}
        </>
      )}
    </div>
  )
}
