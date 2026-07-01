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
    const filled = i < Math.round(value)
    return (
      <span key={i} className={filled ? 'text-yellow-400' : 'text-gray-300'}>
        ★
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