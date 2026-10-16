'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}

export default function BottomSheet({ open, title, onClose, children, footer }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="閉じる" onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[85dvh] pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-gray-200" />
        <div className="flex items-center justify-between px-4 pt-2 pb-3">
          <div className="font-bold text-base text-gray-900">{title}</div>
          <button type="button" onClick={onClose} aria-label="閉じる" className="p-1 -mr-1 text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-5">{children}</div>
        {footer && <div className="border-t px-4 py-3">{footer}</div>}
      </div>
    </div>
  )
}
