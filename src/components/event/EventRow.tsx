import Link from 'next/link'
import { FORMAT_HEX, FORMAT_LABELS, FORMAT_COLORS } from '@/types'

type Props = {
  href: string
  startTime: string | null
  shopName: string | undefined
  title: string | null
  format: string
  // 都道府県・距離など、店名の右に小さく出す補足
  meta?: React.ReactNode
}

// イベント一覧の1行。左に開始時刻、右は2段（店名＋補足／フォーマット＋イベント名）。ホームとお気に入りで共通
export default function EventRow({ href, startTime, shopName, title, format, meta }: Props) {
  const color = FORMAT_HEX[format] ?? FORMAT_HEX.other
  return (
    <Link href={href} className="surface px-3 py-2.5 flex items-center gap-3 hover:shadow-md transition-shadow">
      <span className="w-12 flex-shrink-0 text-center text-base font-bold text-slate-900 tabular-nums">
        {startTime ?? '—'}
      </span>
      <span className="self-stretch w-px bg-slate-100" aria-hidden />
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="flex-1 min-w-0 text-sm font-bold text-slate-900 truncate">{shopName}</span>
          {meta && <span className="flex-shrink-0 text-xs text-slate-400">{meta}</span>}
        </div>
        <div className="flex items-center gap-1.5 text-xs min-w-0">
          <span aria-hidden className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className={`font-semibold flex-shrink-0 ${(FORMAT_COLORS[format] ?? FORMAT_COLORS.other).text}`}>
            {FORMAT_LABELS[format] ?? 'その他'}
          </span>
          {title && <span className="text-slate-500 truncate">{title}</span>}
        </div>
      </div>
    </Link>
  )
}
