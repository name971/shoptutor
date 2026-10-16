-- ホームのカレンダー帯に出す、日ごとのイベント件数（絞り込み条件つき）。7日分を1回の問い合わせで返す。
-- 今日の分は、開始時刻を過ぎたものを除く（時刻不明は残す）
create or replace function public.event_counts_by_day(
  p_from date,
  p_to date,
  p_formats text[] default null,
  p_shop_ids uuid[] default null
)
returns table (held_at date, event_count int)
language sql
stable
security invoker
set search_path = public
as $$
  select e.held_at, count(*)::int
  from public.events e
  join public.shops s on s.id = e.shop_id
  where e.held_at between p_from and p_to
    and s.status = 'active'
    and (p_formats is null or e.format = any (p_formats))
    and (p_shop_ids is null or e.shop_id = any (p_shop_ids))
    and (
      e.held_at > (now() at time zone 'Asia/Tokyo')::date
      or e.start_time is null
      or e.start_time >= to_char(now() at time zone 'Asia/Tokyo', 'HH24:MI')
    )
  group by e.held_at
  order by e.held_at
$$;

grant execute on function public.event_counts_by_day(date, date, text[], uuid[]) to anon, authenticated;
