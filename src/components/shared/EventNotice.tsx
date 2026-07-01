'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'shoptutor_event_notice_dismissed'

export default function EventNotice() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.localStorage.getItem(STORAGE_KEY)) {
      setVisible(true)
    }
  }, [])

  const dismiss = () => {
    window.localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-lg p-3 mb-3 flex items-start gap-2">
      <span>ℹ️</span>
      <div className="flex-1 leading-relaxed">
        イベント情報は公式サイトから自動取得したものです。実際の開催状況は各店舗の公式ページでご確認ください。
      </div>
      <button onClick={dismiss} className="text-blue-400 hover:text-blue-600 flex-shrink-0">✕</button>
    </div>
  )
}
