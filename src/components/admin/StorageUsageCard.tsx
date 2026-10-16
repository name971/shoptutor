'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

type StorageUsage = {
  usedBytes: number
  limitBytes: number
  fileCount: number
}

function formatMB(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(1)
}

// 写真ストレージの使用量（無料枠1GBに対する割合）
export default function StorageUsageCard() {
  const [usage, setUsage] = useState<StorageUsage | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/admin/storage-usage')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setUsage(data)
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const percent = usage ? Math.min(100, (usage.usedBytes / usage.limitBytes) * 100) : 0
  const nearLimit = percent > 80

  return (
    <div className="surface p-4 flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold text-slate-900">写真ストレージ</span>
        {loaded && usage ? (
          <span className="text-xs text-slate-500 tabular-nums">
            {formatMB(usage.usedBytes)} MB / {formatMB(usage.limitBytes)} MB（{usage.fileCount}枚）
          </span>
        ) : loaded ? (
          <span className="text-xs text-slate-400">取得できませんでした</span>
        ) : null}
      </div>
      <div
        className="bg-slate-100 rounded-full h-2"
        role="meter"
        aria-label="写真ストレージの使用率"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
      >
        <div
          className={`rounded-full h-2 transition-all ${nearLimit ? 'bg-red-500' : 'bg-blue-600'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {nearLimit && (
        <p className="text-xs font-bold text-red-700 inline-flex items-center gap-1">
          <AlertTriangle size={14} />
          無料枠の80%を超えています
        </p>
      )}
    </div>
  )
}
