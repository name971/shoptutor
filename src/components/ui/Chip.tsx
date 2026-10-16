type Props = {
  selected?: boolean
  onClick?: () => void
  children: React.ReactNode
  className?: string
}

// 絞り込み・切り替え用のチップ。選択中は濃色の塗り＋白文字、非選択は白地＋薄い輪郭で全画面共通
export default function Chip({ selected = false, onClick, children, className = '' }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex items-center gap-1 h-8 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
        selected
          ? 'bg-slate-900 text-white shadow-sm'
          : 'bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:ring-slate-300'
      } ${className}`}
    >
      {children}
    </button>
  )
}
