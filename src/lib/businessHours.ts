export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export type DayHours = {
  closed: boolean
  open: string
  close: string
}

export type BusinessHours = Record<DayKey, DayHours>

export const DAY_ORDER: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

// 時刻入力を30分刻みの選択式にするための候補一覧（ネイティブtime inputより操作感が安定するため）
export const TIME_OPTIONS: string[] = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2)
  const minute = i % 2 === 0 ? '00' : '30'
  return `${String(hour).padStart(2, '0')}:${minute}`
})

export const DAY_LABELS: Record<DayKey, string> = {
  mon: '月',
  tue: '火',
  wed: '水',
  thu: '木',
  fri: '金',
  sat: '土',
  sun: '日',
}

export function defaultBusinessHours(): BusinessHours {
  const day: DayHours = { closed: false, open: '10:00', close: '20:00' }
  return { mon: { ...day }, tue: { ...day }, wed: { ...day }, thu: { ...day }, fri: { ...day }, sat: { ...day }, sun: { ...day } }
}

// DBには business_hours カラム（text）にJSON文字列として保存する。
// 壊れた/未設定データは全曜日デフォルトにフォールバックする。
export function parseBusinessHours(raw: string | null): BusinessHours {
  if (!raw) return defaultBusinessHours()
  try {
    const parsed = JSON.parse(raw)
    const fallback = defaultBusinessHours()
    const result = { ...fallback }
    for (const day of DAY_ORDER) {
      if (parsed[day]) {
        result[day] = {
          closed: !!parsed[day].closed,
          open: typeof parsed[day].open === 'string' ? parsed[day].open : fallback[day].open,
          close: typeof parsed[day].close === 'string' ? parsed[day].close : fallback[day].close,
        }
      }
    }
    return result
  } catch {
    return defaultBusinessHours()
  }
}

export function serializeBusinessHours(hours: BusinessHours): string {
  return JSON.stringify(hours)
}

// 表示用: 連続して同じ営業時間の曜日をまとめる（例: 月〜金 12:00〜22:00）
export function summarizeBusinessHours(hours: BusinessHours): { label: string; text: string }[] {
  const groups: { days: DayKey[]; text: string }[] = []

  for (const day of DAY_ORDER) {
    const text = hours[day].closed ? '定休日' : `${hours[day].open}〜${hours[day].close}`
    const last = groups[groups.length - 1]
    if (last && last.text === text) {
      last.days.push(day)
    } else {
      groups.push({ days: [day], text })
    }
  }

  return groups.map((g) => ({
    label:
      g.days.length === 1
        ? DAY_LABELS[g.days[0]]
        : `${DAY_LABELS[g.days[0]]}〜${DAY_LABELS[g.days[g.days.length - 1]]}`,
    text: g.text,
  }))
}
