'use client'

import { useEffect, useState } from 'react'
import { Info, X } from 'lucide-react'

const STORAGE_KEY = 'shoptutor_event_notice_dismissed'

export default function EventNotice() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.localStorage.getItem(STORAGE_KEY)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- ブラウザ保存領域や端末の状態は描画後にしか読めないため（初回描画で読むとSSRと不一致になる）
      setVisible(true)
    }
  }, [])

  const dismiss = () => {
    window.localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
      <Info size={13} className="flex-shrink-0" />
      <span className="flex-1">開催状況は各店舗の公式ページでご確認ください</span>
      <button onClick={dismiss} aria-label="この注意書きを閉じる" className="p-1 -mr-1 text-slate-400 hover:text-slate-600">
        <X size={14} />
      </button>
    </div>
  )
}
