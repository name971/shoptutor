'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

export default function BackButton() {
  const router = useRouter()

  const handleBack = () => {
    // 共有リンク等から直接開いた場合は戻り先がないためホームへ
    if (window.history.length > 1) router.back()
    else router.push('/')
  }

  return (
    <button
      onClick={handleBack}
      className="-ml-2 p-2 text-gray-600 hover:text-gray-900"
      aria-label="戻る"
    >
      <ChevronLeft size={22} />
    </button>
  )
}
