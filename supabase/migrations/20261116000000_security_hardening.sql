-- 全体レビュー（2026-11）で見つかった権限まわりの穴をふさぐ。DROP は使わない（MCP で確認待ちになるため）

-- 1. 関数：search_path を固定し、トリガー専用の関数は API から呼べないようにする
alter function public.handle_new_user() set search_path = public;
alter function public.update_shop_review_stats() set search_path = public;
alter function public.increment_shop_view(uuid) set search_path = public;
alter function public.shops_in_bounds(double precision, double precision, double precision, double precision) set search_path = public;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.update_shop_review_stats() from public, anon, authenticated;

-- 2. テーブル権限：RLS が効かない TRUNCATE などを外し、書き込みは必要な列だけに絞る
revoke truncate, trigger, references on
  public.shops, public.events, public.reviews, public.review_likes, public.profiles,
  public.shop_photos, public.photo_likes, public.shop_favorites,
  public.shop_view_stats, public.shop_view_formats
  from anon, authenticated;

-- 未ログインは読むだけ
revoke insert, update, delete on
  public.shops, public.events, public.reviews, public.review_likes, public.profiles,
  public.shop_photos, public.photo_likes, public.shop_favorites
  from anon;

-- 店舗・イベントは service role（取り込みスクリプト・管理画面）だけが書く
revoke insert, update, delete on public.shops, public.events from authenticated;
revoke all on public.shop_view_stats, public.shop_view_formats from anon, authenticated;
revoke insert, update, delete on public.shop_next_events, public.shop_favorite_counts from anon, authenticated;

-- レビュー：本人でも is_hidden・hidden_at・created_at・shop_id は書き換えられないようにする
revoke insert, update on public.reviews from authenticated;
grant insert (shop_id, user_id, stock_rating, price_rating, playspace_rating, staff_rating, access_rating, body)
  on public.reviews to authenticated;
grant update (stock_rating, price_rating, playspace_rating, staff_rating, access_rating, body, is_edited)
  on public.reviews to authenticated;

-- プロフィール：id・created_at は書き換え不可
revoke insert, update on public.profiles from authenticated;
grant insert (id, name, avatar_url, main_format, sub_formats) on public.profiles to authenticated;
grant update (name, name_changed_at, avatar_url, main_format, sub_formats, terms_agreed_at) on public.profiles to authenticated;

-- 写真：投稿後の書き換え（url の差し替え・is_deleted の解除）はさせない。削除は従来どおり本人可
revoke insert, update on public.shop_photos from authenticated;
grant insert (shop_id, user_id, url, caption) on public.shop_photos to authenticated;

-- いいね・お気に入りは追加と削除だけ
revoke update on public.review_likes, public.photo_likes, public.shop_favorites from authenticated;

-- 3. 入力の制約（画面側だけで見ていたものを DB でも守る）
alter table public.reviews
  add constraint reviews_body_length_check check (body is null or char_length(body) between 30 and 2000);
alter table public.profiles
  -- 上限だけ（新規登録時のトリガーが外部認証の表示名をそのまま入れるため、厳しくすると登録が失敗する）
  add constraint profiles_name_length_check check (name is null or char_length(name) <= 100),
  add constraint profiles_sub_formats_max_check check (cardinality(sub_formats) <= 2);
-- 写真の URL は自分がアップロードしたストレージのファイルだけ（外部の画像を全員に表示させない）
alter table public.shop_photos
  add constraint shop_photos_url_own_storage_check check (
    url like 'https://jwsyqvuykdkoihurpxjb.supabase.co/storage/v1/object/public/shop-photos/%'
    and position('/' || user_id::text || '-' in url) > 0
  );

-- 4. ストレージ：アップロード先を「店舗ID/自分のID-時刻-連番.webp」に限定（covers/ などへ書けないように）
alter policy "Authenticated users can upload shop photos" on storage.objects
  with check (
    bucket_id = 'shop-photos'
    and name ~ ('^[0-9a-f-]{36}/' || (select auth.uid())::text || '-[0-9]+-[0-9]+\.webp$')
  );

-- 5. RLS の速度：auth.uid() を行ごとに評価しないよう (select auth.uid()) にする
alter policy profiles_insert on public.profiles with check ((select auth.uid()) = id);
alter policy "Users can insert own profile" on public.profiles with check ((select auth.uid()) = id);
alter policy profiles_update on public.profiles using ((select auth.uid()) = id);
alter policy "Users can update own profile" on public.profiles using ((select auth.uid()) = id);
alter policy reviews_insert on public.reviews with check ((select auth.uid()) = user_id);
alter policy "Users can insert own review" on public.reviews with check ((select auth.uid()) = user_id);
alter policy reviews_update on public.reviews using ((select auth.uid()) = user_id);
alter policy "Users can update own review" on public.reviews using ((select auth.uid()) = user_id);
alter policy reviews_delete on public.reviews using ((select auth.uid()) = user_id);
alter policy "Users can delete own review" on public.reviews using ((select auth.uid()) = user_id);
alter policy likes_insert on public.review_likes with check ((select auth.uid()) = user_id);
alter policy "Users can like reviews" on public.review_likes with check ((select auth.uid()) = user_id);
alter policy likes_delete on public.review_likes using ((select auth.uid()) = user_id);
alter policy "Users can unlike reviews" on public.review_likes using ((select auth.uid()) = user_id);
alter policy photos_insert on public.shop_photos with check ((select auth.uid()) = user_id);
alter policy "Users can insert own photo" on public.shop_photos with check ((select auth.uid()) = user_id);
alter policy "Users can delete own photo" on public.shop_photos using ((select auth.uid()) = user_id);
alter policy shop_photos_update_own on public.shop_photos
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy photo_likes_insert on public.photo_likes with check ((select auth.uid()) = user_id);
alter policy "Users can like photos" on public.photo_likes with check ((select auth.uid()) = user_id);
alter policy photo_likes_delete on public.photo_likes using ((select auth.uid()) = user_id);
alter policy "Users can unlike photos" on public.photo_likes using ((select auth.uid()) = user_id);
alter policy favorites_insert on public.shop_favorites with check ((select auth.uid()) = user_id);
alter policy favorites_delete on public.shop_favorites using ((select auth.uid()) = user_id);

-- 6. インデックス：本人の行を引く問い合わせ（お気に入り・投稿写真・オーナー判定）用
create index if not exists shop_favorites_user_id_idx on public.shop_favorites (user_id);
create index if not exists shop_photos_user_id_idx on public.shop_photos (user_id);
create index if not exists review_likes_user_id_idx on public.review_likes (user_id);
create index if not exists photo_likes_user_id_idx on public.photo_likes (user_id);
create index if not exists shops_owner_user_id_idx on public.shops (owner_user_id) where owner_user_id is not null;
