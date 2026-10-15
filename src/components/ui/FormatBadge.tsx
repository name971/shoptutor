import { FORMAT_LABELS, FORMAT_COLORS } from '@/types'

type Props = {
  format: string
  size?: 'sm' | 'md'
  count?: number
}

export default function FormatBadge({ format, size = 'md', count }: Props) {
  const label = FORMAT_LABELS[format] ?? 'その他'
  const colors = FORMAT_COLORS[format] ?? FORMAT_COLORS.other
  const sizeClass = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-0.5'

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap ${sizeClass} ${colors.bg} ${colors.text}`}>
      {label}
      {count !== undefined && <span className="tabular-nums opacity-80">{count}</span>}
    </span>
  )
}
