// 同じ日付の中で、同じ店舗・同じ開始時刻のイベントを1つにまとめる（最初に出てきた順を保つ）
export function groupSameShopAndTime<T extends { shop_id: string; start_time: string | null }>(items: T[]): T[][] {
  const groups = new Map<string, T[]>()
  items.forEach((item) => {
    const key = `${item.shop_id}|${item.start_time ?? ''}`
    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  })
  return Array.from(groups.values())
}
