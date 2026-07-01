'use client'

import { useEffect, useState } from 'react'

type AdminUser = {
  id: string
  name: string
  email: string | null
  created_at: string
  banned_until: string | null
}

function isBanned(bannedUntil: string | null): boolean {
  if (!bannedUntil) return false
  return new Date(bannedUntil).getTime() > Date.now()
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async (query: string) => {
    setLoading(true)
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}`)
    const data = await res.json()
    setUsers(data.users ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleBan = async (user: AdminUser) => {
    const nextBanned = !isBanned(user.banned_until)
    if (nextBanned && !window.confirm(`${user.name}さんをBANしますか？`)) return

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
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load(q)}
          placeholder="ユーザー名で検索"
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2"
        />
        <button onClick={() => load(q)} className="px-4 py-2 text-sm rounded-lg bg-gray-100 text-gray-700">
          検索
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 text-sm py-8">読み込み中...</div>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((user) => {
            const banned = isBanned(user.banned_until)
            return (
              <div key={user.id} className="bg-white rounded-xl border p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{user.name}</div>
                  <div className="text-xs text-gray-500 truncate">{user.email}</div>
                  <div className={`text-xs ${banned ? 'text-red-500' : 'text-green-600'}`}>
                    {banned ? 'BAN中' : '有効'}
                  </div>
                </div>
                <button
                  onClick={() => toggleBan(user)}
                  className={`text-xs px-3 py-1.5 rounded-lg flex-shrink-0 ${
                    banned ? 'bg-gray-100 text-gray-700' : 'border border-red-300 text-red-500'
                  }`}
                >
                  {banned ? 'BAN解除' : 'BANする'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
