'use client'

import { useState } from 'react'
import type { OwnedShop } from '@/lib/owner-auth'
import Chip from '@/components/ui/Chip'
import {
  BusinessHours,
  DAY_ORDER,
  DAY_LABELS,
  TIME_OPTIONS,
  parseBusinessHours,
  serializeBusinessHours,
} from '@/lib/businessHours'

type Props = {
  shop: OwnedShop
}

const PARKING_OPTIONS = [
  { value: 'unset', label: '未設定' },
  { value: 'yes', label: 'あり' },
  { value: 'no', label: 'なし' },
] as const

function toParkingValue(parkingAvailable: boolean | null): string {
  if (parkingAvailable === null) return 'unset'
  return parkingAvailable ? 'yes' : 'no'
}

function Switch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`flex-shrink-0 w-10 h-6 rounded-full transition-colors relative ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

export default function OwnerShopForm({ shop }: Props) {
  const [prEnabled, setPrEnabled] = useState(shop.pr_enabled)
  const [hoursEnabled, setHoursEnabled] = useState(shop.business_hours !== null)
  const [hours, setHours] = useState<BusinessHours>(parseBusinessHours(shop.business_hours))
  const [parking, setParking] = useState(toParkingValue(shop.parking_available))
  const [parkingNote, setParkingNote] = useState(shop.parking_note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const updateDay = (day: keyof BusinessHours, patch: Partial<BusinessHours[keyof BusinessHours]>) => {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }))
  }

  const invalidDays = hoursEnabled
    ? DAY_ORDER.filter((day) => !hours[day].closed && hours[day].open >= hours[day].close)
    : []

  const handleSave = async () => {
    if (invalidDays.length > 0) {
      setError('営業時間が正しくない曜日があります（開始時刻は終了時刻より前にしてください）')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    const res = await fetch('/api/owner/shop', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pr_enabled: prEnabled,
        business_hours: hoursEnabled ? serializeBusinessHours(hours) : null,
        parking_available: parking === 'unset' ? null : parking === 'yes',
        parking_note: parkingNote.trim() === '' ? null : parkingNote.trim(),
      }),
    })

    if (!res.ok) {
      setError('保存に失敗しました。もう一度お試しください。')
      setSaving(false)
      return
    }

    setMessage('保存しました')
    setSaving(false)
  }

  return (
    <div className="surface p-4 flex flex-col gap-5">
      <h2 className="text-sm font-bold text-slate-900">店舗情報</h2>

      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-800">PR表示・おすすめ順ブースト</div>
          <p className="text-xs text-slate-500 mt-0.5">
            OFFにするとPRラベルは表示されず、おすすめ順の優遇もされなくなります
          </p>
        </div>
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 flex-shrink-0">
          {prEnabled ? 'ON' : 'OFF'}
          <Switch checked={prEnabled} onChange={() => setPrEnabled((v) => !v)} />
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-bold text-slate-800">営業時間</label>
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            {hoursEnabled ? '設定する' : '設定しない'}
            <Switch checked={hoursEnabled} onChange={() => setHoursEnabled((v) => !v)} />
          </label>
        </div>

        {hoursEnabled && (
          <div className="flex flex-col gap-2">
            {DAY_ORDER.map((day) => (
              <div key={day} className="flex items-center gap-2 text-sm">
                <span className="w-5 font-bold text-slate-700 flex-shrink-0">{DAY_LABELS[day]}</span>
                <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-bold flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => updateDay(day, { closed: false })}
                    className={`px-2.5 h-9 transition-colors ${
                      !hours[day].closed ? 'bg-blue-600 text-white' : 'bg-white text-gray-500'
                    }`}
                  >
                    営業
                  </button>
                  <button
                    type="button"
                    onClick={() => updateDay(day, { closed: true })}
                    className={`px-2.5 h-9 transition-colors ${
                      hours[day].closed ? 'bg-gray-500 text-white' : 'bg-white text-gray-500'
                    }`}
                  >
                    定休日
                  </button>
                </div>
                {!hours[day].closed && (
                  <>
                    <select
                      value={hours[day].open}
                      onChange={(e) => updateDay(day, { open: e.target.value })}
                      className={`h-9 text-sm border rounded-lg px-2 bg-white ${
                        invalidDays.includes(day) ? 'border-red-400' : 'border-slate-200'
                      }`}
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <span className="text-gray-400 text-xs">〜</span>
                    <select
                      value={hours[day].close}
                      onChange={(e) => updateDay(day, { close: e.target.value })}
                      className={`h-9 text-sm border rounded-lg px-2 bg-white ${
                        invalidDays.includes(day) ? 'border-red-400' : 'border-slate-200'
                      }`}
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="text-sm font-bold text-slate-800 mb-2 block">駐車場</label>
        <div className="flex gap-2" role="radiogroup" aria-label="駐車場">
          {PARKING_OPTIONS.map((o) => (
            <Chip key={o.value} selected={parking === o.value} onClick={() => setParking(o.value)}>
              {o.label}
            </Chip>
          ))}
        </div>
      </div>

      {parking === 'yes' && (
        <div>
          <label className="text-sm font-bold text-slate-800 mb-2 block">駐車場の備考（台数など）</label>
          <input
            value={parkingNote}
            onChange={(e) => setParkingNote(e.target.value)}
            placeholder="例: 店舗前に5台まで"
            className="w-full h-10 text-sm border border-slate-200 rounded-xl px-3 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
      {message && <p className="text-sm text-green-600">{message}</p>}

      <button
        onClick={handleSave}
        disabled={saving || invalidDays.length > 0}
        className="w-full h-11 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {saving ? '保存中…' : '保存する'}
      </button>
    </div>
  )
}
