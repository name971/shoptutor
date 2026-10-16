'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, X, Ban, Undo2, MessageSquare, Image as ImageIcon } from 'lucide-react'
import { SkeletonBlock } from '@/components/ui/Skeleton'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { FORMAT_LABELS } from '@/types'
import { formatDate } from './types'

type AdminUser = {
  id: string
  name: string
  email: string | null
  avatar_url: string | null
  main_format: string | null
  created_at: string
  banned_until: string | null
  review_count: number
  photo_count: number
}

function isBanned(bannedUntil: string | null): boolean {
  if (!bannedUntil) return false
  return new Date(bannedUntil).getTime() > Date.now()
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const requestRef = useRef(0)
  const { confirm, confirmDialog } = useConfirm()

  const load = useCallback(
    async (offset: number) => {
      const params = new URLSearchParams({ offset: String(offset) })
      if (q.trim()) params.set('q', q.trim())
      const res = await fetch(`/api/admin/users?${params}`)
      const data = await res.json().catch(() => ({}))
      return { list: (data.users ?? []) as AdminUser[], total: (data.total ?? 0) as number }
    },
    [q]
  )

  useEffect(() => {
    const id = ++requestRef.current
    const timer = setTimeout(async () => {
      setLoading(true)
      const { list, total } = await load(0)
      if (id !== requestRef.current) return
      setUsers(list)
      setTotal(total)
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [load])

  const loadMore = async () => {
    setLoadingMore(true)
    const { list } = await load(users.length)
    setUsers((prev) => [...prev, ...list])
    setLoadingMore(false)
  }

  const toggleBan = async (user: AdminUser) => {
    const nextBanned = !isBanned(user.banned_until)
    const ok = await confirm(
      nextBanned
        ? {
            title: `${user.name}さんをBANしますか？`,
            message: 'BANするとログインできなくなります。投稿済みのレビュー・写真は残るので、必要ならレビュー・写真タブで非表示や削除をしてください。',
            confirmLabel: 'BANする',
            danger: true,
          }
        : { title: `${user.name}さんのBANを解除しますか？`, confirmLabel: '解除する' }
    )
    if (!ok) return

    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banned: nextBanned }),
    })
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, banned_until: nextBanned ? new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() : null }
            : u
        )
      )
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 h-10 focus-within:ring-2 focus-within:ring-blue-300">
        <Search size={16} className="text-slate-400 flex-shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="名前・メールアドレスで検索"
          aria-label="名前・メールアドレスで検索"
          className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none"
        />
        {q && (
          <button type="button" onClick={() => setQ('')} aria-label="検索語を消す" className="text-slate-400">
            <X size={16} />
          </button>
        )}
      </label>
      <div className="text-xs text-slate-500">
        {loading ? '　' : <>該当 <span className="font-bold text-slate-900 tabular-nums">{total}</span>人（登録の新しい順）</>}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-16" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-8">該当するユーザーはいません</p>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-2">
            {users.map((user) => {
              const banned = isBanned(user.banned_until)
              return (
                <div key={user.id} className={`surface p-3 flex items-center gap-3 ${banned ? 'bg-red-50/50' : ''}`}>
                  <span className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center flex-shrink-0 text-sm font-bold text-slate-500">
                    {user.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- 外部認証のアイコン画像（小さく表示するだけ）
                      <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      user.name.slice(0, 1)
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate flex items-center gap-1.5">
                      <span className="truncate">{user.name}</span>
                      {banned && (
                        <span className="flex-shrink-0 text-[11px] font-bold px-1.5 rounded bg-red-100 text-red-700 inline-flex items-center gap-0.5">
                          <Ban size={11} />
                          BAN中
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 truncate">{user.email ?? '（メールなし）'}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                      <span>{formatDate(user.created_at)}登録</span>
                      {user.main_format && <span>{FORMAT_LABELS[user.main_format] ?? user.main_format}</span>}
                      <span className="inline-flex items-center gap-0.5">
                        <MessageSquare size={11} />
                        {user.review_count}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <ImageIcon size={11} />
                        {user.photo_count}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleBan(user)}
                    className={`flex-shrink-0 h-9 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${
                      banned ? 'border border-slate-200 text-slate-700 hover:bg-slate-50' : 'border border-red-200 text-red-600 hover:bg-red-50'
                    }`}
                  >
                    {banned ? <Undo2 size={14} /> : <Ban size={14} />}
                    {banned ? '解除' : 'BAN'}
                  </button>
                </div>
              )
            })}
          </div>
          {users.length < total && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full h-11 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {loadingMore ? '読み込み中…' : `もっと見る（残り${total - users.length}人）`}
            </button>
          )}
        </>
      )}
      {confirmDialog}
    </div>
  )
}
