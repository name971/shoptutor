'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const MAX_PHOTOS = 3

type Props = {
  shopId: string
  onUploaded: (photos: { id: string; url: string; user_id: string; like_count: number }[]) => void
}

export default function PhotoUpload({ shopId, onUploaded }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  // 選択した写真のプレビューURL。選び直し・アンマウント時に解放する
  const previewUrls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => () => previewUrls.forEach((url) => URL.revokeObjectURL(url)), [previewUrls])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [existingCount, setExistingCount] = useState<number | null>(null)

  useEffect(() => {
    const loadCount = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setExistingCount(0)
        return
      }

      const { count } = await supabase
        .from('shop_photos')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .eq('user_id', user.id)
        .eq('is_deleted', false)

      setExistingCount(count ?? 0)
    }
    loadCount()
  }, [shopId])

  const remaining = existingCount === null ? MAX_PHOTOS : Math.max(0, MAX_PHOTOS - existingCount)

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    setError('')
    if (selected.length > remaining) {
      setError(`この店舗にはあと${remaining}枚までアップロードできます`)
    }
    setFiles(selected.slice(0, remaining))
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    setUploading(true)
    setError('')

    const uploaded: { id: string; url: string; user_id: string; like_count: number }[] = []
    const { default: imageCompression } = await import('browser-image-compression')

    for (let i = 0; i < files.length; i++) {
      const compressed = await imageCompression(files[i], {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        fileType: 'image/webp',
        useWebWorker: true,
      })

      const path = `${shopId}/${user.id}-${Date.now()}-${i}.webp`

      const { error: uploadError } = await supabase.storage
        .from('shop-photos')
        .upload(path, compressed, { contentType: 'image/webp' })

      if (uploadError) {
        setError('アップロードに失敗しました。もう一度お試しください。')
        setUploading(false)
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('shop-photos').getPublicUrl(path)

      const { data: photoRow, error: insertError } = await supabase
        .from('shop_photos')
        .insert({ shop_id: shopId, user_id: user.id, url: publicUrl })
        .select()
        .single()

      if (insertError || !photoRow) {
        setError('保存に失敗しました。もう一度お試しください。')
        setUploading(false)
        return
      }

      uploaded.push({ id: photoRow.id, url: photoRow.url, user_id: user.id, like_count: 0 })
    }

    onUploaded(uploaded)
    setExistingCount((prev) => (prev ?? 0) + uploaded.length)
    setFiles([])
    if (inputRef.current) inputRef.current.value = ''
    setUploading(false)
  }

  if (remaining === 0) {
    return (
      <p className="text-xs text-gray-400">
        この店舗にはすでに{MAX_PHOTOS}枚投稿済みです
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleSelect}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full h-11 rounded-xl border-2 border-dashed border-slate-200 text-sm font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors inline-flex items-center justify-center gap-2"
      >
        <Camera size={16} />
        写真を追加（あと{remaining}枚まで）
      </button>

      {files.length > 0 && (
        <div className="flex gap-2">
          {previewUrls.map((url, i) => (
            <div key={url} className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 ring-1 ring-slate-900/5">
              {/* eslint-disable-next-line @next/next/no-img-element -- ローカルのblob URLのプレビューのため */}
              <img src={url} alt={`選択した写真${i + 1}`} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5">{error}</p>}

      {files.length > 0 && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full h-11 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {uploading ? 'アップロード中...' : `${files.length}枚アップロードする`}
        </button>
      )}
    </div>
  )
}
