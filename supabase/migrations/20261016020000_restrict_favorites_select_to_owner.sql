-- 店舗ごとのお気に入り数だけを返す関数（誰が登録したかは返さない）。
-- お気に入りの読み取りを本人に限定しても件数を集計できるよう、関数の所有者権限で実行する
create or replace function public.get_shop_favorite_counts()
returns table (shop_id uuid, favorite_count int)
language sql
stable
security definer
set search_path = public
as $$
  select f.shop_id, count(*)::int
  from public.shop_favorites f
  group by f.shop_id
$$;

revoke all on function public.get_shop_favorite_counts() from public;
grant execute on function public.get_shop_favorite_counts() to anon, authenticated;

-- 件数のビューは上の関数経由に（本人限定のRLSの影響を受けずに全店舗の件数を返す）
create or replace view public.shop_favorite_counts
with (security_invoker = true) as
select shop_id, favorite_count from public.get_shop_favorite_counts();

-- お気に入りは本人の分だけ読めるようにする（他人がどの店をお気に入りにしたか取得できないように）
alter policy favorites_select on public.shop_favorites using ((select auth.uid()) = user_id);
