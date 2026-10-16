-- 店舗ごとの「次のイベント」（日本時間で、まだ始まっていない最も早いイベント）
-- security_invoker により、eventsテーブルのRLSがそのまま適用される
create or replace view public.shop_next_events
with (security_invoker = true) as
select distinct on (e.shop_id)
  e.shop_id,
  e.title,
  e.format,
  e.held_at,
  e.start_time
from public.events e
where e.held_at > (now() at time zone 'Asia/Tokyo')::date
   or (
     e.held_at = (now() at time zone 'Asia/Tokyo')::date
     and (e.start_time is null or e.start_time >= to_char(now() at time zone 'Asia/Tokyo', 'HH24:MI'))
   )
order by e.shop_id, e.held_at, e.start_time nulls last;

grant select on public.shop_next_events to anon, authenticated;
