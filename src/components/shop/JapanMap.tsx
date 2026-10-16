'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { COUNT_STEPS, EMPTY_FILL, shortPrefectureName } from '@/lib/area'
import { JAPAN_VIEWBOX, OKINAWA_INSET, PREFECTURE_SHAPES } from './japanMapPaths'

type Region = { name: string; prefectures: string[] }
type Box = { x: number; y: number; w: number; h: number }

type Props = {
  regions: Region[]
  // 都道府県ごとの店舗数
  counts: Map<string, number>
  // 拡大中の地方（null＝全国）
  region: string | null
  onRegionChange: (region: string | null) => void
  onSelect: (prefecture: string) => void
  // 選択中の都道府県（複数選べる場面で、縁取りで示す）
  selected?: Set<string>
}

// 店舗数の段階（色だけに頼らないよう、地方を拡大すると数字も出す）
function stepOf(n: number) {
  return COUNT_STEPS.find((s) => n >= s.min) ?? null
}


// パス文字列から外接矩形を求める（座標は「M x yLx y…Z」の形）。
// 離島（伊豆諸島など）まで含めると拡大が甘くなるため、いちばん大きい輪郭だけで測る
function boxOfPath(d: string): Box {
  const boxes = d.split('M').filter(Boolean).map((part) => boxOfRing(part))
  return boxes.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a))
}

function boxOfRing(part: string): Box {
  const nums = part.match(/-?[\d.]+/g)!.map(Number)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let i = 0; i < nums.length; i += 2) {
    minX = Math.min(minX, nums[i]); maxX = Math.max(maxX, nums[i])
    minY = Math.min(minY, nums[i + 1]); maxY = Math.max(maxY, nums[i + 1])
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

// 全国表示は下に地方名の吹き出しを置く余白を足す
const FULL: Box = fitSquare({ x: 0, y: 0, w: JAPAN_VIEWBOX.width, h: JAPAN_VIEWBOX.height + 80 }, 0.02)

// 全国表示での地方名の吹き出しの位置（地図の単位）。陸地に重ならないよう海の上に置き、線で地方とつなぐ
const REGION_CALLOUTS: Record<string, { x: number; y: number }> = {
  '北海道・東北': { x: 745, y: 440 },
  関東: { x: 740, y: 575 },
  東海: { x: 570, y: 715 },
  関西: { x: 470, y: 800 },
  四国: { x: 290, y: 820 },
  '九州・沖縄': { x: 140, y: 915 },
  中国: { x: 190, y: 545 },
  '甲信越・北陸': { x: 310, y: 440 },
}
const SHAPE_BOXES = new Map(PREFECTURE_SHAPES.map((s) => [s.name, boxOfPath(s.d)]))

function unionBox(boxes: Box[]): Box {
  const x = Math.min(...boxes.map((b) => b.x))
  const y = Math.min(...boxes.map((b) => b.y))
  const x2 = Math.max(...boxes.map((b) => b.x + b.w))
  const y2 = Math.max(...boxes.map((b) => b.y + b.h))
  return { x, y, w: x2 - x, h: y2 - y }
}

// 表示枠（正方形）に収まるよう余白をつける
function fitSquare(b: Box, padRatio = 0.08): Box {
  const size = Math.max(b.w, b.h) * (1 + padRatio * 2)
  return { x: b.x + b.w / 2 - size / 2, y: b.y + b.h / 2 - size / 2, w: size, h: size }
}

// 都道府県の塗り分け地図。全国→地方→都道府県の順にタップで選ぶ
export default function JapanMap({ regions, counts, region, onRegionChange, onSelect, selected }: Props) {
  const regionOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of regions) for (const p of r.prefectures) m.set(p, r.name)
    return m
  }, [regions])

  const regionBoxes = useMemo(() => {
    const m = new Map<string, Box>()
    for (const r of regions) {
      // 沖縄は左上の枠に移しているので、九州と一緒に拡大すると間が空きすぎる。沖縄を除いた範囲に合わせる
      const names = r.prefectures.filter((p) => p !== '沖縄県' || r.prefectures.length === 1)
      const boxes = names.map((p) => SHAPE_BOXES.get(p)).filter((b): b is Box => !!b)
      if (boxes.length > 0) m.set(r.name, fitSquare(unionBox(boxes)))
    }
    return m
  }, [regions])

  // 地方名の表示位置（その地方の都道府県の中心を面積で重み付け）
  const regionLabels = useMemo(
    () =>
      regions.map((r) => {
        const shapes = PREFECTURE_SHAPES.filter((s) => r.prefectures.includes(s.name) && s.name !== '沖縄県')
        const total = shapes.reduce((sum, s) => sum + s.area, 0) || 1
        const count = r.prefectures.reduce((sum, p) => sum + (counts.get(p) ?? 0), 0)
        const anchor = {
          x: shapes.reduce((sum, s) => sum + s.cx * s.area, 0) / total,
          y: shapes.reduce((sum, s) => sum + s.cy * s.area, 0) / total,
        }
        return {
          name: r.name,
          // 地方名（11px）＋店舗数（数字は約7px）＋左右の余白
          width: r.name.length * 11 + String(count).length * 7 + 20,
          count,
          anchor,
          ...(REGION_CALLOUTS[r.name] ?? anchor),
        }
      }),
    [regions, counts]
  )

  const target = (region && regionBoxes.get(region)) || FULL

  // 表示枠をなめらかに動かす
  const [view, setView] = useState<Box>(target)
  const viewRef = useRef(view)
  useEffect(() => {
    const from = viewRef.current
    const to = target
    if (from.x === to.x && from.y === to.y && from.w === to.w) return
    // 動きを減らす設定のときは一度で切り替える
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 350
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration)
      const e = 1 - Math.pow(1 - t, 3)
      const next = {
        x: from.x + (to.x - from.x) * e,
        y: from.y + (to.y - from.y) * e,
        w: from.w + (to.w - from.w) * e,
        h: from.h + (to.h - from.h) * e,
      }
      viewRef.current = next
      setView(next)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target.x, target.y, target.w, target.h]) // eslint-disable-line react-hooks/exhaustive-deps -- 枠の値が変わったときだけ動かす

  // 文字の大きさを画面上のpxで揃えるため、描画幅を測る
  const svgRef = useRef<SVGSVGElement>(null)
  const [pxWidth, setPxWidth] = useState(360)
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setPxWidth(entry.contentRect.width || 360))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const unit = view.w / pxWidth // 画面上の1pxが地図の何単位か
  const zoomed = region !== null

  const handleTap = (name: string) => {
    const r = regionOf.get(name)
    if (!r) return
    // 全国表示のときは地方を拡大。1県だけの地方（北海道など）や、拡大中の地方の県はそのまま選ぶ
    const regionDef = regions.find((x) => x.name === r)
    // 沖縄は左上の枠に移していて九州の拡大には入らないので、すぐ選ぶ
    if (name !== '沖縄県' && ((!zoomed && regionDef && regionDef.prefectures.length > 1) || (zoomed && r !== region))) {
      onRegionChange(r)
      return
    }
    onSelect(name)
  }

  return (
    <div className="flex flex-col gap-2">
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        className="w-full aspect-square touch-manipulation select-none"
        role="group"
        aria-label={zoomed ? `${region}の地図` : '日本地図'}
      >
        {/* 沖縄の枠（全国表示のときだけ） */}
        {!zoomed && (
          <rect
            x={OKINAWA_INSET.x}
            y={OKINAWA_INSET.y}
            width={OKINAWA_INSET.width}
            height={OKINAWA_INSET.height}
            rx={4}
            fill="none"
            stroke="#cbd5e1"
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {/* 選択中の県は縁取りが隣の県に隠れないよう最後に描く */}
        {[...PREFECTURE_SHAPES]
          .sort((a, b) => Number(selected?.has(a.name) ?? false) - Number(selected?.has(b.name) ?? false))
          .map((s) => {
          const n = counts.get(s.name) ?? 0
          const isSelected = selected?.has(s.name) ?? false
          const step = stepOf(n)
          const inRegion = !zoomed || regionOf.get(s.name) === region
          return (
            <path
              key={s.id}
              d={s.d}
              fill={step?.fill ?? EMPTY_FILL}
              fillOpacity={inRegion ? 1 : 0.25}
              stroke={isSelected ? '#f97316' : '#ffffff'}
              strokeWidth={isSelected ? 3 : 1}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              aria-pressed={selected ? isSelected : undefined}
              className="cursor-pointer outline-none hover:brightness-110 focus-visible:brightness-90"
              role="button"
              tabIndex={inRegion ? 0 : -1}
              aria-label={`${s.name} ${n}店`}
              onClick={() => handleTap(s.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleTap(s.name)
                }
              }}
            />
          )
        })}

        {/* 全国表示：地方ごとの店舗数。拡大表示：都道府県名と店舗数 */}
        {!zoomed
          ? regionLabels.map((l) => (
              <g key={l.name}>
                <line x1={l.anchor.x} y1={l.anchor.y} x2={l.x} y2={l.y} stroke="#94a3b8" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                <circle cx={l.anchor.x} cy={l.anchor.y} r={2.5 * unit} fill="#475569" />
              <g
                transform={`translate(${l.x} ${l.y})`}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label={`${l.name} ${l.count}店を拡大`}
                onClick={() => onRegionChange(l.name)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onRegionChange(l.name)
                  }
                }}
              >
                <rect
                  x={(-l.width / 2) * unit}
                  y={-11 * unit}
                  width={l.width * unit}
                  height={22 * unit}
                  rx={11 * unit}
                  fill="#ffffff"
                  fillOpacity={0.92}
                  stroke="#cbd5e1"
                  strokeWidth={0.75 * unit}
                />
                <text textAnchor="middle" dominantBaseline="central" fontSize={11 * unit} fontWeight={700} fill="#0f172a">
                  {l.name}
                  <tspan fill="#2563eb" dx={3 * unit}>{l.count}</tspan>
                </text>
              </g>
              </g>
            ))
          : PREFECTURE_SHAPES.filter((s) => regionOf.get(s.name) === region).map((s) => (
              // 隣の県と重ならないよう1行にし、白いふちどりでどの色の上でも読めるようにする
              <text
                key={s.id}
                x={s.cx}
                y={s.cy}
                textAnchor="middle"
                dominantBaseline="central"
                pointerEvents="none"
                stroke="#ffffff"
                strokeWidth={3 * unit}
                strokeLinejoin="round"
                paintOrder="stroke"
                fontSize={11 * unit}
                fontWeight={700}
                fill="#0f172a"
              >
                {shortPrefectureName(s.name)}
                <tspan dx={2 * unit} fontSize={13 * unit} fontWeight={800} fill="#1e3a8a">
                  {counts.get(s.name) ?? 0}
                </tspan>
              </text>
            ))}
      </svg>

      {/* 凡例 */}
      <div className="flex items-center justify-between gap-2 text-[11px] text-gray-500">
        <div className="flex items-center gap-1 flex-wrap" aria-label="色の意味：店舗数">
          {[...COUNT_STEPS].reverse().map((s) => (
            <span key={s.min} className="inline-flex items-center gap-1 mr-1">
              <span className="w-3 h-3 rounded-sm" style={{ background: s.fill }} />
              {s.label}
            </span>
          ))}
        </div>
        <span className="flex-shrink-0">出典：国土数値情報</span>
      </div>
    </div>
  )
}
