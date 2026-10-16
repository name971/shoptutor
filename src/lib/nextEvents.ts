import type { SupabaseClient } from '@supabase/supabase-js'

export type NextEvent = {
  shop_id: string
  title: string | null
  format: string | null
  held_at: string
  start_time: string | null
}

// 店舗ごとの次のイベント（ビュー shop_next_events）。取得に失敗しても一覧表示は続けられるよう空で返す
export async function fetchNextEvents(supabase: SupabaseClient): Promise<Map<string, NextEvent>> {
  const { data, error } = await supabase
    .from('shop_next_events')
    .select('shop_id, title, format, held_at, start_time')
  if (error || !data) return new Map()
  return new Map((data as NextEvent[]).map((e) => [e.shop_id, e]))
}
