import { FORMAT_LABELS, FORMAT_COLORS } from '@/types'

type Props = {
  format: string
  size?: 'sm' | 'md'
}

export default function FormatBadge({ format, size = 'md' }: Props) {
  const label = FORMAT_LABELS[format] ?? 'その他'
  const colors = FORMAT_COLORS[format] ?? FORMAT_COLORS.other
  const sizeClass = size === 'sm' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${colors.bg} ${colors.text}`}>
      {label}
    </span>
  )
}