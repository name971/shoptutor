'use client'

import { useState } from 'react'
import { FORMAT_HEX } from '@/types'

type Item = { key: string; label: string; count: number }

type Props = {
  items: Item[]
  selected: string | null
  onSelect: (key: string | null) => void
}

// フォーマットの内訳（100%積み上げ横棒）。色だけに頼らないよう、幅が十分な区間には名前を入れ、
// 下のチップ（名前＋回数）を凡例として併用する。押すとそのフォーマットで絞り込む
export default function FormatShareBar({ items, selected, onSelect }: Props) {
  const [hovered, setHovered] = useState<string | null>(null)
  const total = items.reduce((sum, i) => sum + i.count, 0)
  if (total === 0) return null

  const sorted = [...items].sort((a, b) => b.count - a.count)
  const active = sorted.find((i) => i.key === (hovered ?? selected))
  const pct = (n: number) => Math.round((n / total) * 100)

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="flex h-7 gap-[2px] rounded-lg overflow-hidden"
        role="group"
        aria-label={`フォーマットの内訳：${sorted.map((i) => `${i.label}${pct(i.count)}%`).join('、')}`}
        onMouseLeave={() => setHovered(null)}
      >
        {sorted.map((item) => {
          const share = (item.count / total) * 100
          const dimmed = selected !== null && selected !== item.key
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(selected === item.key ? null : item.key)}
              onMouseEnter={() => setHovered(item.key)}
              onFocus={() => setHovered(item.key)}
              onBlur={() => setHovered(null)}
              aria-pressed={selected === item.key}
              aria-label={`${item.label} 週${item.count}回（${pct(item.count)}%）`}
              className="h-full min-w-[6px] flex items-center justify-center overflow-hidden transition-opacity focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
              style={{ width: `${share}%`, background: FORMAT_HEX[item.key] ?? FORMAT_HEX.other, opacity: dimmed ? 0.3 : 1 }}
            >
              {share >= 22 && (
                <span className="px-1 text-[11px] font-bold text-white truncate">{item.label}</span>
              )}
            </button>
          )
        })}
      </div>
      <div className="h-4 text-xs text-slate-500" aria-live="polite">
        {active ? (
          <>
            <span className="font-bold text-slate-900">{active.label}</span> 週
            <span className="tabular-nums">{active.count}</span>回・
            <span className="tabular-nums">{pct(active.count)}</span>%
          </>
        ) : null}
      </div>
    </div>
  )
}
