-- 同じ内容のRLSポリシーが2つずつあるので片方を消す（動作は変わらない。問い合わせごとの評価が半分になる）。2026-11-16 に Supabase MCP で適用済み
drop policy if exists "Anyone can read photo likes" on public.photo_likes;
drop policy if exists "Users can unlike photos" on public.photo_likes;
drop policy if exists "Users can like photos" on public.photo_likes;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Anyone can read review likes" on public.review_likes;
drop policy if exists "Users can like reviews" on public.review_likes;
drop policy if exists "Users can unlike reviews" on public.review_likes;
drop policy if exists "Users can update own review" on public.reviews;
drop policy if exists "Users can insert own review" on public.reviews;
drop policy if exists "Users can delete own review" on public.reviews;
drop policy if exists "Users can insert own photo" on public.shop_photos;
-- 写真の UPDATE 権限は外したので、このポリシーは使われない
drop policy if exists shop_photos_update_own on public.shop_photos;
