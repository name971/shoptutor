'use client'

import { useState } from 'react'
import type { OwnedShop } from '@/lib/owner-auth'
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
      className={`w-9 h-5 rounded-full transition-colors relative ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
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
    <div className="bg-white rounded-xl border p-3 flex flex-col gap-3">
      <div className="font-medium text-sm">店舗情報</div>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">PR表示・おすすめ順ブースト</div>
          <p className="text-[10px] text-gray-400 mt-0.5">
            OFFにするとPRラベルは表示されず、おすすめ順の優遇もされなくなります
          </p>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 flex-shrink-0">
          {prEnabled ? 'ON' : 'OFF'}
          <Switch checked={prEnabled} onChange={() => setPrEnabled((v) => !v)} />
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-gray-500">営業時間</label>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            {hoursEnabled ? '設定する' : '設定しない'}
            <Switch checked={hoursEnabled} onChange={() => setHoursEnabled((v) => !v)} />
          </label>
        </div>

        {hoursEnabled && (
          <div className="flex flex-col gap-1.5">
            {DAY_ORDER.map((day) => (
              <div key={day} className="flex items-center gap-2 text-sm">
                <span className="w-4 text-gray-600 flex-shrink-0">{DAY_LABELS[day]}</span>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => updateDay(day, { closed: false })}
                    className={`px-2 py-1 transition-colors ${
                      !hours[day].closed ? 'bg-blue-600 text-white' : 'bg-white text-gray-500'
                    }`}
                  >
                    営業
                  </button>
                  <button
                    type="button"
                    onClick={() => updateDay(day, { closed: true })}
                    className={`px-2 py-1 transition-colors ${
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
                      className={`text-xs border rounded px-1.5 py-1 bg-white ${
                        invalidDays.includes(day) ? 'border-red-400' : 'border-gray-200'
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
                      className={`text-xs border rounded px-1.5 py-1 bg-white ${
                        invalidDays.includes(day) ? 'border-red-400' : 'border-gray-200'
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
        <label className="text-xs text-gray-500 mb-1 block">駐車場</label>
        <div className="flex gap-3">
          {PARKING_OPTIONS.map((o) => (
            <label key={o.value} className="flex items-center gap-1.5 text-sm text-gray-700">
              <input
                type="radio"
                name="parking"
                value={o.value}
                checked={parking === o.value}
                onChange={() => setParking(o.value)}
              />
              {o.label}
            </label>
          ))}
        </div>
      </div>

      {parking === 'yes' && (
        <div>
          <label className="text-xs text-gray-500 mb-1 block">駐車場の備考（台数など）</label>
          <input
            value={parkingNote}
            onChange={(e) => setParkingNote(e.target.value)}
            placeholder="例: 店舗前に5台まで"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
          />
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
      {message && <p className="text-sm text-green-600">{message}</p>}

      <button
        onClick={handleSave}
        disabled={saving || invalidDays.length > 0}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {saving ? '保存中...' : '保存する'}
      </button>
    </div>
  )
}
