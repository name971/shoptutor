function localDateKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isEventPast(heldAt: string, startTime: string | null): boolean {
  if (!startTime) return false
  const now = new Date()
  if (heldAt !== localDateKey(now)) return false
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return startTime < currentTime
}
