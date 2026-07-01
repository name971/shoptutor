'use client'

import { useEffect, useState } from 'react'

type Photo = {
  id: string
  url: string
  created_at: string
  shops: { id: string; name: string } | null
  profiles: { name: string } | null
}

export default function AdminPhotos() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/photos')
    const data = await res.json()
    setPhotos(data.photos ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleDelete = async (photoId: string) => {
    if (!window.confirm('この写真を削除しますか？この操作は取り消せません。')) return

    const res = await fetch(`/api/admin/photos/${photoId}`, { method: 'DELETE' })
    if (res.ok) {
      setPhotos((prev) => prev.filter((p) => p.id !== photoId))
    }
  }

  if (loading) return <div className="text-center text-gray-400 text-sm py-8">読み込み中...</div>

  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.length === 0 ? (
        <div className="col-span-3 text-center text-gray-400 text-sm py-8">写真がありません</div>
      ) : (
        photos.map((photo) => (
          <div key={photo.id} className="bg-white rounded-xl border overflow-hidden">
            <div className="aspect-square">
              <img src={photo.url} alt="" className="w-full h-full object-cover" />
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
  )
}
