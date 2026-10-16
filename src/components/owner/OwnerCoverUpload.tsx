'use client'

import { useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { useConfirm } from '@/components/ui/ConfirmDialog'

const MAX_PHOTOS = 3

type Props = {
  initialUrls: string[]
}

export default function OwnerCoverUpload({ initialUrls }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [urls, setUrls] = useState(initialUrls)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const { confirm, confirmDialog } = useConfirm()

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
    const ok = await confirm({ title: 'この写真を外しますか？', message: '店舗ページに表示されなくなります。', confirmLabel: '外す', danger: true })
    if (!ok) return
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
    <div className="surface p-4 flex flex-col gap-3">
      <h2 className="text-sm font-bold text-slate-900">店舗写真（公式）</h2>
      <p className="text-xs text-slate-500">
        店舗詳細ページの店舗名の下に表示される写真です。最大{MAX_PHOTOS}枚まで設定できます。
      </p>

      {urls.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {urls.map((url) => (
            <div key={url} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element -- 投稿写真はアップロード時にWebP・1MB以下へ圧縮済みのため、画像最適化は使わない */}
              <img src={url} alt="店舗写真" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => handleRemove(url)}
                aria-label="この写真を外す"
                className="absolute top-1.5 right-1.5 w-8 h-8 rounded-full bg-slate-900/70 text-white flex items-center justify-center hover:bg-slate-900"
              >
                <X size={16} />
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
          className="w-full h-11 rounded-xl border-2 border-dashed border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-1.5"
        >
          <Camera size={16} />
          {uploading ? 'アップロード中…' : `写真を追加（あと${remaining}枚まで）`}
        </button>
      ) : (
        <p className="text-xs text-slate-500">すでに{MAX_PHOTOS}枚設定済みです（外すと追加できます）</p>
      )}
      {confirmDialog}
    </div>
  )
}
