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
