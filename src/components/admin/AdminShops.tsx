'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Search, X, ExternalLink, MapPinOff, Pencil, Eye, EyeOff } from 'lucide-react'
import Chip from '@/components/ui/Chip'
import ChipRow from '@/components/ui/ChipRow'
import BottomSheet from '@/components/ui/BottomSheet'
import { SkeletonBlock } from '@/components/ui/Skeleton'
import { REGIONS } from '@/lib/area'

const AdminLocationMap = dynamic(() => import('./AdminLocationMap'), {
  ssr: false,
  loading: () => <div className="w-full h-48 rounded-xl bg-slate-100" />,
})

type Shop = {
  id: string
  name: string
  prefecture: string
  status: string
  is_wpn_premium: boolean
  is_teaching_meister: boolean
  is_premium: boolean
  pr_enabled: boolean
  owner_user_id: string | null
  owner_email: string | null
  address: string
  lat: number | null
  lng: number | null
  weekly_event_count: number
  review_count: number
  last_seen_at: string | null
}

const FILTERS = [
  { key: '', label: 'すべて' },
  { key: 'active', label: '公開中' },
  { key: 'inactive', label: '非公開' },
  { key: 'premium', label: 'プレミアム' },
  { key: 'nocoords', label: '座標なし（地図に出ない）' },
] as const
type FilterKey = (typeof FILTERS)[number]['key']

const PREFECTURES = REGIONS.flatMap((r) => r.prefectures)

function buildQuery(q: string, filter: FilterKey, prefecture: string, offset: number) {
  const params = new URLSearchParams({ offset: String(offset) })
  if (q.trim()) params.set('q', q.trim())
  if (filter === 'active' || filter === 'inactive') params.set('status', filter)
  if (filter === 'premium') params.set('premium', '1')
  if (filter === 'nocoords') params.set('nocoords', '1')
  if (prefecture) params.set('prefecture', prefecture)
  return params.toString()
}

const hasCoords = (s: Pick<Shop, 'lat' | 'lng'>) => s.lat !== null && s.lng !== null

export default function AdminShops({ initialFilter }: { initialFilter?: string | null }) {
  const [shops, setShops] = useState<Shop[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<FilterKey>(FILTERS.some((f) => f.key === initialFilter) ? (initialFilter as FilterKey) : '')
  const [prefecture, setPrefecture] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [editing, setEditing] = useState<Shop | null>(null)
  const requestRef = useRef(0)

  const load = useCallback(async (offset: number) => {
    const res = await fetch(`/api/admin/shops?${buildQuery(q, filter, prefecture, offset)}`)
    const data = await res.json().catch(() => ({}))
    return { list: (data.shops ?? []) as Shop[], total: (data.total ?? 0) as number }
  }, [q, filter, prefecture])

  // 条件が変わったら最初から取り直す（検索語は打ち終わるまで少し待つ）
  useEffect(() => {
    const id = ++requestRef.current
    const timer = setTimeout(async () => {
      setLoading(true)
      const { list, total } = await load(0)
      if (id !== requestRef.current) return
      setShops(list)
      setTotal(total)
      setLoading(false)
    }, 250)
    return () => clearTimeout(timer)
  }, [load])

  const loadMore = async () => {
    setLoadingMore(true)
    const { list } = await load(shops.length)
    setShops((prev) => [...prev, ...list])
    setLoadingMore(false)
  }

  const patchShop = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/shops/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => null)
    return { ok: res.ok, error: data?.error as string | undefined }
  }

  const toggleStatus = async (shop: Shop) => {
    const nextStatus = shop.status === 'active' ? 'inactive' : 'active'
    const { ok } = await patchShop(shop.id, { status: nextStatus })
    if (ok) setShops((prev) => prev.map((s) => (s.id === shop.id ? { ...s, status: nextStatus } : s)))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col md:flex-row gap-2">
        <label className="flex-1 flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 h-10 focus-within:ring-2 focus-within:ring-blue-300">
          <Search size={16} className="text-slate-400 flex-shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="店名・住所で検索"
            aria-label="店名・住所で検索"
            className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none"
          />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="検索語を消す" className="text-slate-400">
              <X size={16} />
            </button>
          )}
        </label>
        <select
          value={prefecture}
          onChange={(e) => setPrefecture(e.target.value)}
          aria-label="都道府県"
          className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm"
        >
          <option value="">全都道府県</option>
          {PREFECTURES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <ChipRow innerClassName="px-0">
        {FILTERS.map((f) => (
          <Chip key={f.key} selected={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </Chip>
        ))}
      </ChipRow>

      <div className="text-xs text-slate-500">
        {loading ? '　' : <>該当 <span className="font-bold text-slate-900 tabular-nums">{total}</span>件</>}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-16" />
          ))}
        </div>
      ) : shops.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-8">該当する店舗はありません</p>
      ) : (
        <>
          {/* スマホ：カード */}
          <div className="flex flex-col gap-2 md:hidden">
            {shops.map((shop) => (
              <div key={shop.id} className={`surface p-3 flex flex-col gap-2 ${shop.status !== 'active' ? 'bg-slate-50' : ''}`}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <ShopName shop={shop} />
                    <div className="text-xs text-slate-500 truncate">{shop.prefecture} · {shop.address}</div>
                  </div>
                </div>
                <ShopBadgesRow shop={shop} />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(shop)}
                    className="flex-1 h-9 rounded-lg bg-blue-600 text-white text-xs font-bold inline-flex items-center justify-center gap-1"
                  >
                    <Pencil size={14} />
                    編集
                  </button>
                  <StatusButton shop={shop} onClick={() => toggleStatus(shop)} />
                </div>
              </div>
            ))}
          </div>

          {/* PC：表 */}
          <div className="hidden md:block surface overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">店舗</th>
                  <th className="px-3 py-2 font-medium">都道府県</th>
                  <th className="px-3 py-2 font-medium">状態</th>
                  <th className="px-3 py-2 font-medium text-right whitespace-nowrap">週の回数</th>
                  <th className="px-3 py-2 font-medium text-right whitespace-nowrap">レビュー</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {shops.map((shop) => (
                  <tr key={shop.id} className={`border-t border-slate-100 ${shop.status !== 'active' ? 'bg-slate-50' : ''}`}>
                    <td className="px-3 py-2 max-w-xs">
                      <ShopName shop={shop} />
                      <div className="text-xs text-slate-500 truncate">{shop.address}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600">{shop.prefecture}</td>
                    <td className="px-3 py-2">
                      <ShopBadgesRow shop={shop} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{shop.weekly_event_count}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{shop.review_count}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setEditing(shop)}
                          className="h-8 px-3 rounded-lg bg-blue-600 text-white text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          <Pencil size={13} />
                          編集
                        </button>
                        <StatusButton shop={shop} onClick={() => toggleStatus(shop)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {shops.length < total && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full h-11 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {loadingMore ? '読み込み中…' : `もっと見る（残り${total - shops.length}件）`}
            </button>
          )}
        </>
      )}

      {editing && (
        <ShopEditSheet
          key={editing.id}
          shop={editing}
          onClose={() => setEditing(null)}
          onSave={async (body) => {
            const result = await patchShop(editing.id, body)
            if (result.ok) {
              setShops((prev) =>
                prev.map((s) => {
                  if (s.id !== editing.id) return s
                  const { owner_email, ...fields } = body as Partial<Shop>
                  return { ...s, ...fields, owner_email: 'owner_email' in body ? owner_email || null : s.owner_email }
                })
              )
              setEditing(null)
            }
            return result
          }}
        />
      )}
    </div>
  )
}

function ShopName({ shop }: { shop: Shop }) {
  return (
    <Link
      href={`/shops/${shop.id}`}
      target="_blank"
      className="text-sm font-bold text-slate-900 hover:underline inline-flex items-center gap-1 max-w-full"
    >
      <span className="truncate">{shop.name}</span>
      <ExternalLink size={13} className="flex-shrink-0 text-slate-400" />
    </Link>
  )
}

function ShopBadgesRow({ shop }: { shop: Shop }) {
  return (
    <div className="flex flex-wrap gap-1">
      {shop.status === 'active' ? (
        <span className="text-[11px] font-bold px-1.5 rounded bg-green-50 text-green-700">公開中</span>
      ) : (
        <span className="text-[11px] font-bold px-1.5 rounded bg-slate-200 text-slate-600">非公開</span>
      )}
      {!hasCoords(shop) && (
        <span className="text-[11px] font-bold px-1.5 rounded bg-red-50 text-red-700 inline-flex items-center gap-0.5">
          <MapPinOff size={11} />
          座標なし
        </span>
      )}
      {shop.is_premium && <span className="text-[11px] font-bold px-1.5 rounded bg-sky-100 text-sky-800">プレミアム</span>}
      {shop.is_premium && !shop.pr_enabled && <span className="text-[11px] px-1.5 rounded bg-slate-100 text-slate-500">PR OFF</span>}
      {shop.is_wpn_premium && <span className="text-[11px] font-bold px-1.5 rounded bg-yellow-100 text-yellow-800">WPN</span>}
      {shop.is_teaching_meister && <span className="text-[11px] font-bold px-1.5 rounded bg-orange-100 text-orange-800">マイスター</span>}
    </div>
  )
}

function StatusButton({ shop, onClick }: { shop: Shop; onClick: () => void }) {
  const active = shop.status === 'active'
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-9 md:h-8 px-3 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center gap-1 whitespace-nowrap"
    >
      {active ? <EyeOff size={14} /> : <Eye size={14} />}
      {active ? '非公開にする' : '公開にする'}
    </button>
  )
}

type SaveResult = { ok: boolean; error?: string }

function ShopEditSheet({
  shop,
  onClose,
  onSave,
}: {
  shop: Shop
  onClose: () => void
  onSave: (body: Record<string, unknown>) => Promise<SaveResult>
}) {
  const [draft, setDraft] = useState({
    name: shop.name,
    address: shop.address,
    prefecture: shop.prefecture,
    lat: shop.lat,
    lng: shop.lng,
    is_wpn_premium: shop.is_wpn_premium,
    is_teaching_meister: shop.is_teaching_meister,
    is_premium: shop.is_premium,
  })
  const [ownerEmail, setOwnerEmail] = useState(shop.owner_email ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setSaving(true)
    setError('')
    const body: Record<string, unknown> = { ...draft }
    // オーナーは変わったときだけ送る（空欄にすると解除）
    if (ownerEmail.trim() !== (shop.owner_email ?? '')) body.owner_email = ownerEmail.trim()
    const result = await onSave(body)
    setSaving(false)
    if (!result.ok) setError(result.error ?? '保存に失敗しました')
  }

  const input = 'w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300'

  return (
    <BottomSheet
      open
      title="店舗を編集"
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-200 text-sm font-bold text-slate-700">
              キャンセル
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !draft.name.trim()}
              className="h-11 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      }
    >
      <section className="flex flex-col gap-2">
        <Field label="店舗名">
          <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className={input} />
        </Field>
        <Field label="都道府県">
          <select value={draft.prefecture} onChange={(e) => setDraft((d) => ({ ...d, prefecture: e.target.value }))} className={input}>
            {PREFECTURES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="住所（都道府県より後）">
          <input value={draft.address} onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} className={input} />
        </Field>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-xs font-bold text-slate-500">位置（地図をタップすると動かせます）</h3>
          {(draft.lat !== null || draft.lng !== null) && (
            <button type="button" onClick={() => setDraft((d) => ({ ...d, lat: null, lng: null }))} className="text-xs text-slate-500 underline">
              座標を消す
            </button>
          )}
        </div>
        <AdminLocationMap lat={draft.lat} lng={draft.lng} onPick={(lat, lng) => setDraft((d) => ({ ...d, lat, lng }))} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="緯度">
            <input
              type="number"
              step="any"
              value={draft.lat ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, lat: e.target.value === '' ? null : Number(e.target.value) }))}
              className={input}
            />
          </Field>
          <Field label="経度">
            <input
              type="number"
              step="any"
              value={draft.lng ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, lng: e.target.value === '' ? null : Number(e.target.value) }))}
              className={input}
            />
          </Field>
        </div>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(draft.prefecture + draft.address)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start text-xs font-bold text-blue-600 inline-flex items-center gap-1"
        >
          住所をGoogleマップで確認
          <ExternalLink size={12} />
        </a>
      </section>

      <section className="flex flex-col">
        <h3 className="text-xs font-bold text-slate-500 mb-1">店舗の特徴・プラン</h3>
        <Toggle label="WPNプレミアム" checked={draft.is_wpn_premium} onChange={(v) => setDraft((d) => ({ ...d, is_wpn_premium: v }))} />
        <Toggle label="ティーチングマイスター" checked={draft.is_teaching_meister} onChange={(v) => setDraft((d) => ({ ...d, is_teaching_meister: v }))} />
        <Toggle
          label="プレミアム会員（PR枠・オーナーダッシュボード）"
          checked={draft.is_premium}
          onChange={(v) => setDraft((d) => ({ ...d, is_premium: v }))}
        />
      </section>

      <section className="flex flex-col gap-1">
        <Field label="オーナーのメールアドレス（空欄でオーナー解除）">
          <input
            type="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            placeholder="owner@example.com"
            className={input}
          />
        </Field>
        <p className="text-[11px] text-slate-500">ShopTutorにログインしたことのあるメールアドレスを入れてください</p>
      </section>
    </BottomSheet>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3 py-3 border-b border-slate-100 text-sm text-slate-800 text-left"
    >
      {label}
      <span className={`relative flex-shrink-0 w-10 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  )
}
