-- ホームのイベント一覧（開催日→開始時刻の順に範囲取得）向け
create index if not exists events_held_at_start_time_idx on public.events (held_at, start_time);
-- 店舗ごとの次のイベント（shop_next_events の distinct on）と店舗詳細のイベント一覧向け
create index if not exists events_shop_held_at_start_time_idx on public.events (shop_id, held_at, start_time);

-- 店舗ごとのお気に入り数（おすすめ順の計算用）。全お気に入り行を取得して数える代わりに件数だけ返す
create or replace view public.shop_favorite_counts
with (security_invoker = true) as
select shop_id, count(*)::int as favorite_count
from public.shop_favorites
group by shop_id;

grant select on public.shop_favorite_counts to anon, authenticated;
