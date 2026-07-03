'use client'

import { useEffect, useState } from 'react'

type Props = {
  urls: string[]
  alt: string
}

export default function CoverPhotoGrid({ urls, alt }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  useEffect(() => {
    if (openIndex === null) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenIndex(null)
      if (e.key === 'ArrowLeft') setOpenIndex((i) => (i === null ? null : (i - 1 + urls.length) % urls.length))
      if (e.key === 'ArrowRight') setOpenIndex((i) => (i === null ? null : (i + 1) % urls.length))
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [openIndex, urls.length])

  if (urls.length === 0) return null

  return (
    <>
      <div className="grid grid-cols-3 gap-1.5">
        {urls.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="relative aspect-square rounded-lg overflow-hidden border bg-gray-100"
          >
            <img src={url} alt={alt} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setOpenIndex(null)}
        >
          <button
            type="button"
            onClick={() => setOpenIndex(null)}
            className="absolute top-4 right-4 text-white text-2xl leading-none"
          >
            ×
          </button>

          {urls.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setOpenIndex((i) => (i === null ? null : (i - 1 + urls.length) % urls.length))
              }}
              className="absolute left-2 text-white text-3xl leading-none px-2"
            >
              ‹
            </button>
          )}

          <img
            src={urls[openIndex]}
            alt={alt}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {urls.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setOpenIndex((i) => (i === null ? null : (i + 1) % urls.length))
              }}
              className="absolute right-2 text-white text-3xl leading-none px-2"
            >
              ›
            </button>
          )}
        </div>
      )}
    </>
  )
}
