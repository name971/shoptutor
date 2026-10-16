'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Props = {
  children: React.ReactNode
  // 外枠（幅・余白）のクラス
  className?: string
  // 内側のスクロール領域の左右余白（端のチップが見切れないように）
  innerClassName?: string
}

// 横スクロールのチップ列。スクロールバーは隠すため、はみ出しているときは端に◀▶ボタンを出す。
// マウスのホイール（縦回転）でも横に動かせるようにする
export default function ChipRow({ children, className = '', innerClassName = 'px-4' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      setCanLeft(el.scrollLeft > 4)
      setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
    }
    const onWheel = (e: WheelEvent) => {
      // 横にはみ出しているときだけ、縦ホイールを横スクロールに変える
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    el.addEventListener('wheel', onWheel, { passive: false })
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      el.removeEventListener('wheel', onWheel)
      observer.disconnect()
    }
  }, [])

  const scrollBy = (direction: 1 | -1) => {
    const el = ref.current
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.7, behavior: 'smooth' })
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={ref} className={`flex gap-2 overflow-x-auto no-scrollbar ${innerClassName}`}>
        {children}
      </div>
      {canLeft && (
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label="前のチップを表示"
          className="absolute left-0 inset-y-0 w-11 flex items-center justify-start pl-1 bg-gradient-to-r from-white via-white/90 to-transparent text-slate-600"
        >
          <span className="w-7 h-7 rounded-full bg-white shadow ring-1 ring-slate-200 flex items-center justify-center">
            <ChevronLeft size={16} />
          </span>
        </button>
      )}
      {canRight && (
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label="続きのチップを表示"
          className="absolute right-0 inset-y-0 w-11 flex items-center justify-end pr-1 bg-gradient-to-l from-white via-white/90 to-transparent text-slate-600"
        >
          <span className="w-7 h-7 rounded-full bg-white shadow ring-1 ring-slate-200 flex items-center justify-center">
            <ChevronRight size={16} />
          </span>
        </button>
      )}
    </div>
  )
}
