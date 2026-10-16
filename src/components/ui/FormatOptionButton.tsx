import { FORMAT_COLORS, FORMAT_LABELS } from '@/types'

type Props = {
  format: string
  selected: boolean
  disabled?: boolean
  onClick: () => void
}

// フォーマット選択の大きめボタン（オンボーディング・プロフィール編集で共通）
export default function FormatOptionButton({ format, selected, disabled = false, onClick }: Props) {
  const colors = FORMAT_COLORS[format] ?? FORMAT_COLORS.other
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`h-11 rounded-xl px-3 text-sm font-semibold transition-colors disabled:opacity-40 ${
        selected
          ? `${colors.bg} ${colors.text} ring-2 ring-inset ring-current`
          : 'bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:ring-slate-300'
      }`}
    >
      {FORMAT_LABELS[format]}
    </button>
  )
}
