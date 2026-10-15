type Props = {
  selected?: boolean
  onClick?: () => void
  children: React.ReactNode
  className?: string
}

// 絞り込み・切り替え用のチップ。選択中は塗り＋白文字、非選択は枠線のみで全画面共通
export default function Chip({ selected = false, onClick, children, className = '' }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex items-center gap-1 h-8 px-3 rounded-full text-xs font-medium border whitespace-nowrap flex-shrink-0 transition-colors ${
        selected
          ? 'bg-blue-600 border-blue-600 text-white'
          : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
      } ${className}`}
    >
      {children}
    </button>
  )
}
