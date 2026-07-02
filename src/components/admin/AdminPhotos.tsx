'use client'

import { useEffect, useState } from 'react'

type Photo = {
  id: string
  url: string
  created_at: string
  shops: { id: string; name: string } | null
  profiles: { name: string } | null
}

type StorageUsage = {
  usedBytes: number
  limitBytes: number
  fileCount: number
}

function formatMB(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(1)
}

export default function AdminPhotos() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [usage, setUsage] = useState<StorageUsage | null>(null)
  const [usageLoading, setUsageLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/photos')
    const data = await res.json()
    setPhotos(data.photos ?? [])
    setLoading(false)
  }

  const loadUsage = async () => {
    setUsageLoading(true)
    const res = await fetch('/api/admin/storage-usage')
    if (res.ok) {
      setUsage(await res.json())
    }
    setUsageLoading(false)
  }

  useEffect(() => {
    load()
    loadUsage()
  }, [])

  const handleDelete = async (photoId: string) => {
    if (!window.confirm('この写真を削除しますか？この操作は取り消せません。')) return

    const res = await fetch(`/api/admin/photos/${photoId}`, { method: 'DELETE' })
    if (res.ok) {
      setPhotos((prev) => prev.filter((p) => p.id !== photoId))
    }
  }

  if (loading) return <div className="text-center text-gray-400 text-sm py-8">読み込み中...</div>

  const usagePercent = usage ? Math.min(100, (usage.usedBytes / usage.limitBytes) * 100) : 0

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white rounded-xl border p-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-medium text-gray-700">ストレージ使用量</span>
          {!usageLoading && usage && (
            <span className="text-gray-500">
              {formatMB(usage.usedBytes)} MB / {formatMB(usage.limitBytes)} MB（{usage.fileCount}枚）
            </span>
          )}
        </div>
        <div className="bg-gray-100 rounded-full h-1.5">
          <div
            className={`rounded-full h-1.5 transition-all ${usagePercent > 80 ? 'bg-red-400' : 'bg-blue-400'}`}
            style={{ width: usageLoading ? '0%' : `${usagePercent}%` }}
          />
        </div>
      </div>

      <div className="text-xs font-medium text-gray-500">新着の写真</div>

      <div className="grid grid-cols-3 gap-2">
      {photos.length === 0 ? (
        <div className="col-span-3 text-center text-gray-400 text-sm py-8">写真がありません</div>
      ) : (
        photos.map((photo) => (
          <div key={photo.id} className="bg-white rounded-xl border overflow-hidden">
            <div className="aspect-square">
              <img src={photo.url} alt="" loading="lazy" className="w-full h-full object-cover" />
            </div>
            <div className="p-1.5 text-[10px] text-gray-500">
              <div className="truncate">{photo.shops?.name}</div>
              <div className="truncate text-gray-400">{photo.profiles?.name ?? '匿名'}</div>
              <button
                onClick={() => handleDelete(photo.id)}
                className="text-red-500 hover:underline mt-1"
              >
                削除
              </button>
            </div>
          </div>
        ))
      )}
      </div>
    </div>
  )
}
