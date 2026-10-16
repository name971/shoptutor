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
  // 1時間以内に始まる（「まもなく」を出す）
  soon?: boolean
}

function FormatTag({ format }: { format: string }) {
  return (
    <span className={`flex-shrink-0 text-[11px] font-bold ${(FORMAT_COLORS[format] ?? FORMAT_COLORS.other).text}`}>
      {FORMAT_LABELS[format] ?? 'その他'}
    </span>
  )
}

// イベント一覧の1行（タイムライン）。左に開始時刻と時間軸の線、右のカードは
// 1段目「何を（フォーマット＋イベント名）」、2段目「どこで（店名＋距離）」。ホームとお気に入りで共通
export default function EventRow({ href, startTime, shopName, meta, items, soon = false }: Props) {
  const [open, setOpen] = useState(false)
  const [first, ...others] = items
  const color = FORMAT_HEX[first.format] ?? FORMAT_HEX.other

  return (
    <div className="flex gap-2">
      {/* 時刻 */}
      <div className="w-12 flex-shrink-0 pt-3 text-right">
        <div className="text-[15px] font-bold text-slate-900 tabular-nums leading-none">{startTime ?? '—'}</div>
        {soon && <div className="mt-1 text-[11px] font-bold text-amber-600">まもなく</div>}
      </div>

      {/* 時間軸の線と点 */}
      <div className="relative w-3 flex-shrink-0 flex justify-center" aria-hidden>
        <span className="absolute inset-y-0 w-px bg-slate-200" />
        <span
          className={`relative mt-3.5 w-2.5 h-2.5 rounded-full ring-4 ring-background ${soon ? 'animate-pulse' : ''}`}
          style={{ background: color }}
        />
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0 py-1">
        <div className="surface overflow-hidden">
          <div className="flex items-center pr-1">
            <Link href={href} className="flex-1 min-w-0 px-3 py-2 flex flex-col gap-0.5 hover:bg-slate-50 transition-colors">
              <span className="flex items-center gap-1.5 min-w-0">
                <FormatTag format={first.format} />
                <span className="text-sm font-bold text-slate-900 truncate">{first.title ?? FORMAT_LABELS[first.format] ?? 'イベント'}</span>
              </span>
              <span className="flex items-baseline gap-2 min-w-0 text-xs text-slate-500">
                <span className="flex-1 min-w-0 truncate">{shopName}</span>
                {meta && <span className="flex-shrink-0 text-slate-400">{meta}</span>}
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
                className="w-full flex items-center gap-1 px-3 pb-2 text-xs font-semibold text-blue-600"
              >
                {open ? '閉じる' : `同じ時間に他${others.length}件`}
                <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
              {open &&
                others.map((item, i) => (
                  <div key={i} className="flex items-center pl-3 pr-1 border-t border-slate-100">
                    <span className="flex-1 min-w-0 py-2 flex items-center gap-1.5">
                      <FormatTag format={item.format} />
                      <span className="text-xs text-slate-600 truncate">{item.title}</span>
                    </span>
                    {item.reminder && <ReminderButton source={item.reminder} />}
                  </div>
                ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
