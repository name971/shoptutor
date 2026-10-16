'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'

type Props = {
  label: string
  value: number
  onChange: (value: number) => void
}

export default function StarRatingInput({ label, value, onChange }: Props) {
  const [hover, setHover] = useState(0)

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="flex" role="radiogroup" aria-label={label} onMouseLeave={() => setHover(0)}>
        {Array.from({ length: 5 }, (_, i) => {
          const n = i + 1
          const filled = n <= (hover || value)
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              onClick={() => onChange(n)}
              onMouseEnter={() => setHover(n)}
              className="w-9 h-9 flex items-center justify-center"
              aria-label={`${label} ${n}`}
            >
              <Star
                size={26}
                className={filled ? 'fill-yellow-400 text-yellow-400' : 'fill-slate-100 text-slate-300'}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
