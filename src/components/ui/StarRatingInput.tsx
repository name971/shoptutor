'use client'

import { useState } from 'react'

type Props = {
  label: string
  value: number
  onChange: (value: number) => void
}

export default function StarRatingInput({ label, value, onChange }: Props) {
  const [hover, setHover] = useState(0)

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex gap-0.5" onMouseLeave={() => setHover(0)}>
        {Array.from({ length: 5 }, (_, i) => {
          const n = i + 1
          const filled = n <= (hover || value)
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              onMouseEnter={() => setHover(n)}
              className={`text-2xl leading-none ${filled ? 'text-yellow-400' : 'text-gray-300'}`}
              aria-label={`${label} ${n}`}
            >
              ★
            </button>
          )
        })}
      </div>
    </div>
  )
}
