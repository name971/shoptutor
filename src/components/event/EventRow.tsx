import Link from 'next/link'
import FormatBadge from '@/components/ui/FormatBadge'

type Props = {
  href: string
  startTime: string | null
  shopName: string | undefined
  title: string | null
  format: string
  // 都道府県・距離など、バッジの横に出す補足
  meta?: React.ReactNode
}

// イベント一覧の1行（左に開始時刻、右に店名・イベント名・フォーマット）。ホームとお気に入りで共通
export default function EventRow({ href, startTime, shopName, title, format, meta }: Props) {
  return (
    <Link href={href} className="surface p-3 flex gap-3 hover:shadow-md transition-shadow">
      <div className="w-14 flex-shrink-0 flex items-center justify-center border-r border-slate-100 pr-3">
        <span className="text-base font-bold text-slate-900 tabular-nums">{startTime ?? '—'}</span>
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="text-sm font-bold text-slate-900 truncate">{shopName}</div>
        {title && <div className="text-xs text-slate-600 truncate">{title}</div>}
        <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
          <FormatBadge format={format} size="sm" />
          {meta && <span className="truncate">{meta}</span>}
        </div>
      </div>
    </Link>
  )
}
