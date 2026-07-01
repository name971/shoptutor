type Props = {
  value: number | null
  size?: 'sm' | 'md' | 'lg'
  showNumber?: boolean
}

export default function StarRating({ value, size = 'md', showNumber = true }: Props) {
  if (value === null || value === undefined) {
    return <span className="text-gray-400 text-xs">未評価</span>
  }

  const sizeClass = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }[size]

  const stars = Array.from({ length: 5 }, (_, i) => {
    const fillPercent = Math.max(0, Math.min(1, value - i)) * 100
    return (
      <span key={i} className="relative inline-block">
        <span className="text-gray-300">★</span>
        <span
          className="absolute inset-0 text-yellow-400 overflow-hidden whitespace-nowrap"
          style={{ width: `${fillPercent}%` }}
        >
          ★
        </span>
      </span>
    )
  })

  return (
    <span className={`inline-flex items-center gap-0.5 ${sizeClass}`}>
      {stars}
      {showNumber && (
        <span className="ml-1 font-medium text-gray-700">{value.toFixed(1)}</span>
      )}
    </span>
  )
}