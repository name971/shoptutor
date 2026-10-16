'use client'

import { useCallback, useState } from 'react'
import BottomSheet from './BottomSheet'

type ConfirmOptions = {
  title: string
  message?: string
  confirmLabel?: string
  // 取り消せない操作は赤いボタンにする
  danger?: boolean
  // 入力しないと実行できない確認文字（アカウント削除など重い操作用）
  requireText?: string
}

type PendingConfirm = ConfirmOptions & { resolve: (ok: boolean) => void }

// window.confirmの代わりに、アプリ内のボトムシートで確認する
// 使い方: const { confirm, confirmDialog } = useConfirm(); if (!(await confirm({...}))) return; ...JSXに{confirmDialog}を置く
export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const [typed, setTyped] = useState('')

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setTyped('')
        setPending({ ...options, resolve })
      }),
    []
  )

  const close = (ok: boolean) => {
    pending?.resolve(ok)
    setPending(null)
  }

  const canConfirm = !pending?.requireText || typed.trim() === pending.requireText

  const confirmDialog = (
    <BottomSheet
      open={pending !== null}
      title={pending?.title ?? ''}
      onClose={() => close(false)}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => close(false)}
            className="h-12 rounded-xl text-sm font-bold text-slate-700 bg-white ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            disabled={!canConfirm}
            className={`h-12 rounded-xl text-sm font-bold text-white disabled:opacity-40 ${
              pending?.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {pending?.confirmLabel ?? 'OK'}
          </button>
        </div>
      }
    >
      {pending?.message && <p className="text-sm text-slate-600 leading-relaxed">{pending.message}</p>}
      {pending?.requireText && (
        <div className="flex flex-col gap-2">
          <label htmlFor="confirm-text" className="text-xs font-bold text-slate-500">
            確認のため「{pending.requireText}」と入力してください
          </label>
          <input
            id="confirm-text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="w-full h-12 text-base bg-slate-50 rounded-xl px-4 ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      )}
    </BottomSheet>
  )

  return { confirm, confirmDialog }
}
