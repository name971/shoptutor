'use client'

import { useState } from 'react'
import { LocateFixed, X } from 'lucide-react'
import BottomSheet from '@/components/ui/BottomSheet'
import Chip from '@/components/ui/Chip'
import JapanMap from '@/components/shop/JapanMap'
import { REGIONS, shortPrefectureName } from '@/lib/area'

// イベントタブの「どこで」。現在地の周辺・都道府県（複数可）・全国のどれか
export type EventArea =
  | { kind: 'near'; km: number }
  | { kind: 'prefectures'; prefectures: string[] }
  | { kind: 'all' }

export const NEAR_RADIUS_OPTIONS = [3, 5, 10] as const

export function areaLabel(area: EventArea | null): string {
  if (!area) return 'エリアを選ぶ'
  if (area.kind === 'near') return `現在地 ${area.km}km`
  if (area.kind === 'all') return '全国'
  const [first, ...rest] = area.prefectures
  if (rest.length === 0) return first
  if (rest.length === 1) return `${shortPrefectureName(first)}・${shortPrefectureName(rest[0])}`
  return `${shortPrefectureName(first)} 他${rest.length}県`
}

type Props = {
  open: boolean
  area: EventArea | null
  // 都道府県ごとの店舗数（地図の塗り分け・タイルに出す）
  shopCounts: Map<string, number>
  hasLocation: boolean
  locating: boolean
  onClose: () => void
  onApply: (area: EventArea) => void
  // 現在地を取得して「現在地の周辺」にする
  onUseLocation: () => void
}

export default function EventAreaSheet(props: Props) {
  if (!props.open) return null
  // 開くたびに今の条件から選び直す（閉じている間は描画しないので、ここで初期化される）
  return <SheetBody {...props} />
}

function SheetBody({ area, shopCounts, hasLocation, locating, onClose, onApply, onUseLocation }: Props) {
  const [draft, setDraft] = useState<EventArea | null>(area)
  const [region, setRegion] = useState<string | null>(null)

  const selectedPrefs = new Set(draft?.kind === 'prefectures' ? draft.prefectures : [])
  const visibleRegions = REGIONS.map((r) => ({
    name: r.name,
    prefectures: r.prefectures.filter((p) => (shopCounts.get(p) ?? 0) > 0),
  })).filter((r) => r.prefectures.length > 0)
  const shownRegions = region ? visibleRegions.filter((r) => r.name === region) : visibleRegions

  const togglePrefecture = (p: string) => {
    const next = new Set(selectedPrefs)
    if (next.has(p)) next.delete(p)
    else next.add(p)
    // 地方の順（北から）に並べておく
    const ordered = REGIONS.flatMap((r) => r.prefectures).filter((x) => next.has(x))
    setDraft(ordered.length > 0 ? { kind: 'prefectures', prefectures: ordered } : null)
  }

  return (
    <BottomSheet
      open
      title="どこのイベントを見る？"
      onClose={onClose}
      footer={
        <button
          type="button"
          disabled={!draft}
          onClick={() => draft && onApply(draft)}
          className="w-full h-11 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40"
        >
          {draft ? `${areaLabel(draft)}で見る` : 'エリアを選んでください'}
        </button>
      }
    >
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-bold text-gray-500">現在地の周辺</h3>
        {hasLocation ? (
          <div className="flex flex-wrap gap-2">
            {NEAR_RADIUS_OPTIONS.map((km) => (
              <Chip key={km} selected={draft?.kind === 'near' && draft.km === km} onClick={() => setDraft({ kind: 'near', km })}>
                {km}km以内
              </Chip>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={onUseLocation}
            disabled={locating}
            className="self-start h-9 px-3 rounded-full border border-gray-200 text-sm text-gray-800 inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            <LocateFixed size={16} className="text-blue-600" />
            {locating ? '取得中…' : '現在地を使う'}
          </button>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-xs font-bold text-gray-500">都道府県（複数選べます）</h3>
          {region && (
            <button type="button" onClick={() => setRegion(null)} className="text-xs font-bold text-blue-600">
              全国の地図に戻る
            </button>
          )}
        </div>

        {selectedPrefs.size > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {[...selectedPrefs].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => togglePrefecture(p)}
                aria-label={`${p}を外す`}
                className="inline-flex items-center gap-1 h-7 pl-3 pr-2 rounded-full text-xs font-bold bg-orange-50 text-orange-800"
              >
                {p}
                <X size={14} />
              </button>
            ))}
          </div>
        )}

        <JapanMap
          regions={visibleRegions}
          counts={shopCounts}
          region={region}
          onRegionChange={setRegion}
          onSelect={togglePrefecture}
          selected={selectedPrefs}
        />

        {shownRegions.map((r) => (
          <div key={r.name} className="flex flex-col gap-1.5">
            <div className="text-xs font-bold text-gray-900">{r.name}</div>
            <div className="flex flex-wrap gap-1.5">
              {r.prefectures.map((p) => (
                <Chip key={p} selected={selectedPrefs.has(p)} onClick={() => togglePrefecture(p)}>
                  {shortPrefectureName(p)}
                  <span className="ml-1 tabular-nums opacity-70">{shopCounts.get(p) ?? 0}</span>
                </Chip>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-bold text-gray-500">すべて</h3>
        <div>
          <Chip selected={draft?.kind === 'all'} onClick={() => setDraft({ kind: 'all' })}>
            全国
          </Chip>
        </div>
      </section>
    </BottomSheet>
  )
}
