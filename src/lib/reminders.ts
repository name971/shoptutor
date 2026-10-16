'use client'

import { useSyncExternalStore } from 'react'
import { isEventPast } from './eventTime'

// イベントのリマインダー（アプリ内だけで知らせる）。ログインなしでも使えるよう端末のブラウザに保存する。
// events テーブルは毎日入れ替わりIDが変わるため、イベントの中身を写して保存し、
// 「店舗・開催日・開始時刻・イベント名」で同じイベントかを判定する
export type Reminder = {
  key: string
  shopId: string
  shopName: string
  title: string | null
  format: string
  heldAt: string
  startTime: string | null
}

type ReminderSource = Omit<Reminder, 'key'>

const STORAGE_KEY = 'shoptutor_reminders'
const CHANGE_EVENT = 'shoptutor-reminders-change'
const EMPTY: Reminder[] = []

export function reminderKey(e: Pick<Reminder, 'shopId' | 'heldAt' | 'startTime' | 'title'>): string {
  return [e.shopId, e.heldAt, e.startTime ?? '', e.title ?? ''].join('|')
}

let cachedRaw: string | null = null
let cachedList: Reminder[] = EMPTY

function read(): Reminder[] {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return EMPTY
  }
  // useSyncExternalStore は同じ内容なら同じ配列を返す必要があるため、文字列が変わったときだけ作り直す
  if (raw === cachedRaw) return cachedList
  cachedRaw = raw
  try {
    const parsed = raw ? (JSON.parse(raw) as Reminder[]) : []
    cachedList = parsed
      .filter((r) => !isEventPast(r.heldAt, r.startTime))
      .sort((a, b) => (a.heldAt + (a.startTime ?? '99')).localeCompare(b.heldAt + (b.startTime ?? '99')))
  } catch {
    cachedList = EMPTY
  }
  return cachedList
}

function write(list: Reminder[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // 保存できない環境（プライベートブラウズ等）では何もしない
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange)
  // 別のタブでの変更も反映する
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

// 開催前のリマインダー一覧（開催日時の早い順）。サーバー描画時は空
export function useReminders(): Reminder[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY)
}

export function toggleReminder(source: ReminderSource) {
  const key = reminderKey(source)
  const list = read()
  write(list.some((r) => r.key === key) ? list.filter((r) => r.key !== key) : [...list, { ...source, key }])
}

export function removeReminder(key: string) {
  write(read().filter((r) => r.key !== key))
}
