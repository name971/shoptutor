'use client'

import { useEffect, useState } from 'react'

type Props = {
  shopName: string
  // ページ内の店名（h1）のid。これが画面外に出たらヘッダーに店名を出す
  targetId: string
}

// 店舗詳細のヘッダー見出し。店名はすぐ下のカードにあるため、最初は「店舗の詳細」と出し、
// スクロールして店名が見えなくなったら店名に切り替える
export default function DetailHeaderTitle({ shopName, targetId }: Props) {
  const [showName, setShowName] = useState(false)

  useEffect(() => {
    const target = document.getElementById(targetId)
    if (!target) return
    // ヘッダー（約96px）の下に隠れた時点で「画面外」とみなす
    const observer = new IntersectionObserver(([entry]) => setShowName(!entry.isIntersecting), {
      rootMargin: '-96px 0px 0px 0px',
    })
    observer.observe(target)
    return () => observer.disconnect()
  }, [targetId])

  return (
    <div className="flex-1 min-w-0 text-sm truncate" aria-live="polite">
      {showName ? (
        <span className="font-bold text-slate-900">{shopName}</span>
      ) : (
        <span className="font-semibold text-slate-500">店舗の詳細</span>
      )}
    </div>
  )
}
