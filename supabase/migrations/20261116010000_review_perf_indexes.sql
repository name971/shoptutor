-- 全体レビュー（2026-11）：新着順で読む問い合わせ用のインデックス（本番に適用済み）
create index if not exists reviews_shop_created_idx on public.reviews (shop_id, created_at desc);
create index if not exists reviews_created_at_idx on public.reviews (created_at desc);
create index if not exists events_scraped_at_idx on public.events (scraped_at desc);
