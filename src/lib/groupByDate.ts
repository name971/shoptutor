// 日付（held_at）ごとにまとめる。入力は日付→開始時刻の順に並んでいる前提
export function groupByDate<T extends { held_at: string }>(items: T[]): { date: string; items: T[] }[] {
  const result: { date: string; items: T[] }[] = []
  items.forEach((item) => {
    const last = result[result.length - 1]
    if (last && last.date === item.held_at) last.items.push(item)
    else result.push({ date: item.held_at, items: [item] })
  })
  return result
}
