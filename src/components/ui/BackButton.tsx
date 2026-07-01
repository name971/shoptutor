'use client'

import { useRouter } from 'next/navigation'

export default function BackButton() {
  const router = useRouter()

  return (
    <button
      onClick={() => router.back()}
      className="text-gray-500 hover:text-gray-700"
      aria-label="戻る"
    >
      ←
    </button>
  )
}
