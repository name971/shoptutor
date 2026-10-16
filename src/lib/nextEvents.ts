import type { SupabaseClient } from '@supabase/supabase-js'
import { cached } from './clientCache'

export type NextEvent = {
  shop_id: string
  title: string | null
  format: string | null
  held_at: string
  start_time: string | null
}

// 店舗ごとの次のイベント（ビュー shop_next_events）。取得に失敗しても一覧表示は続けられるよう空で返す。
// 「次回」は時刻で変わるため、保持は2分だけ
export async function fetchNextEvents(supabase: SupabaseClient): Promise<Map<string, NextEvent>> {
  try {
    return await cached('next-events', 2 * 60 * 1000, async () => {
      const { data, error } = await supabase
        .from('shop_next_events')
        .select('shop_id, title, format, held_at, start_time')
      if (error) throw error
      return new Map((data as NextEvent[]).map((e) => [e.shop_id, e]))
    })
  } catch {
    return new Map()
  }
}
