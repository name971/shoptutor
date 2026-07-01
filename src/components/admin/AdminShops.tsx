'use client'

import { useEffect, useState } from 'react'

type Shop = {
  id: string
  name: string
  prefecture: string
  status: string
  is_wpn_premium: boolean
  is_teaching_meister: boolean
  address: string
  lat: number | null
  lng: number | null
}

export default function AdminShops() {
  const [shops, setShops] = useState<Shop[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<Shop>>({})

  const load = async (query: string) => {
    setLoading(true)
    const res = await fetch(`/api/admin/shops?q=${encodeURIComponent(query)}`)
    const data = await res.json()
    setShops(data.shops ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleStatus = async (shop: Shop) => {
    const nextStatus = shop.status === 'active' ? 'inactive' : 'active'
    const res = await fetch(`/api/admin/shops/${shop.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
    if (res.ok) {
      setShops((prev) => prev.map((s) => (s.id === shop.id ? { ...s, status: nextStatus } : s)))
    }
  }

  const startEdit = (shop: Shop) => {
    setEditingId(shop.id)
    setEditDraft(shop)
  }

  const saveEdit = async () => {
    if (!editingId) return
    const res = await fetch(`/api/admin/shops/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editDraft),
    })
    if (res.ok) {
      setShops((prev) =>
        prev.map((s) => (s.id === editingId ? { ...s, ...editDraft } as Shop : s))
      )
      setEditingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load(q)}
          placeholder="店舗名で検索"
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2"
        />
        <button
          onClick={() => load(q)}
          className="px-4 py-2 text-sm rounded-lg bg-gray-100 text-gray-700"
        >
          検索
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 text-sm py-8">読み込み中...</div>
      ) : (
        <div className="flex flex-col gap-2">
          {shops.map((shop) => (
            <div key={shop.id} className="bg-white rounded-xl border p-3">
              {editingId === shop.id ? (
                <div className="flex flex-col gap-2">
                  <input
                    value={editDraft.name ?? ''}
                    onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1"
                    placeholder="店舗名"
                  />
                  <input
                    value={editDraft.address ?? ''}
                    onChange={(e) => setEditDraft((d) => ({ ...d, address: e.target.value }))}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1"
                    placeholder="住所"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={editDraft.lat ?? ''}
                      onChange={(e) => setEditDraft((d) => ({ ...d, lat: e.target.value ? Number(e.target.value) : null }))}
                      className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1"
                      placeholder="緯度"
                    />
                    <input
                      type="number"
                      value={editDraft.lng ?? ''}
                      onChange={(e) => setEditDraft((d) => ({ ...d, lng: e.target.value ? Number(e.target.value) : null }))}
                      className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1"
                      placeholder="経度"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={!!editDraft.is_wpn_premium}
                      onChange={(e) => setEditDraft((d) => ({ ...d, is_wpn_premium: e.target.checked }))}
                    />
                    WPNプレミアム
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={!!editDraft.is_teaching_meister}
                      onChange={(e) => setEditDraft((d) => ({ ...d, is_teaching_meister: e.target.checked }))}
                    />
                    ティーチングマイスター
                  </label>
                  <div className="flex gap-2">
                    <button onClick={saveEdit} className="flex-1 text-xs bg-blue-600 text-white rounded-lg py-1.5">
                      保存
                    </button>
                    <button onClick={() => setEditingId(null)} className="flex-1 text-xs bg-gray-100 text-gray-600 rounded-lg py-1.5">
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{shop.name}</div>
                    <div className="text-xs text-gray-500">
                      {shop.prefecture} ·{' '}
                      <span className={shop.status === 'active' ? 'text-green-600' : 'text-gray-400'}>
                        {shop.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => startEdit(shop)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => toggleStatus(shop)}
                      className="text-xs text-gray-500 hover:underline"
                    >
                      {shop.status === 'active' ? '非公開にする' : '公開にする'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
