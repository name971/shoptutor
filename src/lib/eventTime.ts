// イベントの開催日時は常に日本時間（JST）で解釈する。
// サーバーの実行環境（Vercel等はUTC）やユーザーの端末設定に関わらず、
// 常に同じ「今日・現在時刻」を基準にするため、Intl.DateTimeFormatで明示的にJSTへ変換する。
function jstParts(d: Date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]))
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour === '24' ? '00' : parts.hour,
    minute: parts.minute,
  }
}

export function jstDateKey(d: Date = new Date()): string {
  const p = jstParts(d)
  return `${p.year}-${p.month}-${p.day}`
}

export function isEventPast(heldAt: string, startTime: string | null): boolean {
  const p = jstParts(new Date())
  const today = `${p.year}-${p.month}-${p.day}`

  if (heldAt < today) return true
  if (heldAt > today) return false

  // heldAt === today: 時刻が分かる場合のみ、現在時刻と比較する
  if (!startTime) return false
  const currentTime = `${p.hour}:${p.minute}`
  return startTime < currentTime
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

// "2026-10-17" → "今日" / "明日" / "10/17(金)"
export function formatEventDate(heldAt: string): string {
  if (heldAt === jstDateKey()) return '今日'
  if (heldAt === jstDateKey(new Date(Date.now() + 24 * 60 * 60 * 1000))) return '明日'
  const [y, m, d] = heldAt.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${m}/${d}(${weekday})`
}

// 一覧表示用の「日付＋開始時刻」 例: "今日 19:00〜" / "10/17(金) 18:30〜" / "10/18(土)"
export function formatEventWhen(heldAt: string, startTime: string | null): string {
  const date = formatEventDate(heldAt)
  return startTime ? `${date} ${startTime}〜` : date
}

// 現在時刻（JST）を "HH:MM" で返す。start_timeとの文字列比較に使う
export function jstTimeKey(d: Date = new Date()): string {
  const p = jstParts(d)
  return `${p.hour}:${p.minute}`
}

// "YYYY-MM-DD" にn日足した日付キー（タイムゾーンの影響を受けないようUTCで計算）
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

// "YYYY-MM-DD" の曜日（0=日〜6=土）
export function weekdayOfKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

// 日付見出し用 例: "10/15(水) 今日"
export function formatDayHeading(key: string): string {
  const [, m, d] = key.split('-').map(Number)
  const base = `${m}/${d}(${WEEKDAYS[weekdayOfKey(key)]})`
  const relative = formatEventDate(key)
  return relative === '今日' || relative === '明日' ? `${base} ${relative}` : base
}
