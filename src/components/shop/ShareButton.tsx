'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'

type Props = {
  title: string
  text: string
}

// 店舗ページの共有。スマホは端末の共有メニュー（LINE・X・メッセージ等）、使えない環境ではリンクをコピーする
export default function ShareButton({ title, text }: Props) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url })
      } catch {
        // 共有メニューを閉じた場合は何もしない
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('このリンクをコピーしてください', url)
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label="この店舗を共有"
      className="h-9 flex-shrink-0 inline-flex items-center gap-1 px-2.5 -mr-1 rounded-full text-sm font-semibold text-slate-700 hover:bg-slate-100"
    >
      {copied ? <Check size={18} className="text-green-600" /> : <Share2 size={18} />}
      <span className={copied ? 'text-green-700' : ''}>{copied ? 'コピーしました' : '共有'}</span>
    </button>
  )
}
