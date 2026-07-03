'use client'

import { useRef, useState } from 'react'

const MAX_PHOTOS = 3

type Props = {
  initialUrls: string[]
}

export default function OwnerCoverUpload({ initialUrls }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [urls, setUrls] = useState(initialUrls)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const remaining = Math.max(0, MAX_PHOTOS - urls.length)

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []).slice(0, remaining)
    if (selected.length === 0) return

    setUploading(true)
    setError('')

    const { default: imageCompression } = await import('browser-image-compression')
    const formData = new FormData()

    for (let i = 0; i < selected.length; i++) {
      const compressed = await imageCompression(selected[i], {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        fileType: 'image/webp',
        useWebWorker: true,
      })
      formData.append('files', compressed, `cover-${i}.webp`)
    }

    const res = await fetch('/api/owner/cover', { method: 'POST', body: formData })

    if (!res.ok) {
      setError('アップロードに失敗しました。もう一度お試しください。')
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    const data = await res.json()
    setUrls(data.cover_photo_urls)
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleRemove = async (url: string) => {
    setError('')
    const res = await fetch('/api/owner/cover', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })

    if (!res.ok) {
      setError('削除に失敗しました。もう一度お試しください。')
      return
    }

    const data = await res.json()
    setUrls(data.cover_photo_urls)
  }

  return (
    <div className="bg-white rounded-xl border p-3 flex flex-col gap-3">
      <div className="font-medium text-sm">店舗写真（公式）</div>
      <p className="text-xs text-gray-500">
        店舗詳細ページの店舗名の下に表示される写真です。最大{MAX_PHOTOS}枚まで設定できます。
      </p>

      {urls.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {urls.map((url) => (
            <div key={url} className="relative aspect-square rounded-lg overflow-hidden border bg-gray-100">
              <img src={url} alt="店舗写真" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => handleRemove(url)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleSelect}
        className="hidden"
      />

      {error && <p className="text-xs text-red-500">{error}</p>}

      {remaining > 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {uploading ? 'アップロード中...' : `📷 写真を追加（あと${remaining}枚まで）`}
        </button>
      ) : (
        <p className="text-xs text-gray-400">すでに{MAX_PHOTOS}枚設定済みです</p>
      )}
    </div>
  )
}
