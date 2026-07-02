@AGENTS.md
# ShopTutor - プロジェクト引き継ぎドキュメント

## サービス概要
マジック：ザ・ギャザリングの公認店舗レビューサイト。
対象店舗：mtg-jp.comの公認店舗約563店舗（日本全国）

## 技術スタック
- フロントエンド：Next.js 16 (App Router) + TypeScript + Tailwind CSS
- DB・認証：Supabase (PostgreSQL)
- 地図：Leaflet + OpenStreetMap + leaflet.markercluster
- ホスティング：Vercel（予定）
- スクレイピング：Python (BeautifulSoup) + GitHub Actions（2日に1回 12:00 JST）

## 環境変数（.env.local）
NEXT_PUBLIC_SUPABASE_URL=https://jwsyqvuykdkoihurpxjb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=（anon key）

## ディレクトリ構成
src/
app/
page.tsx              # マップ画面（メイン）✅
shops/
[id]/
page.tsx          # 店舗詳細ページ ✅
components/
map/
ShopMap.tsx         # Leafletマップ本体 ✅
ShopMarker.tsx      # カスタムピン（評価数値+色分け） ✅
ShopPopup.tsx       # ピンクリック時のポップアップ ✅
shop/
ShopCard.tsx        # 店舗カード（リスト表示用） ✅
ui/
FormatBadge.tsx     # フォーマットバッジ（色分けあり） ✅
StarRating.tsx      # 星評価表示 ✅
ShopBadges.tsx      # WPN・マイスター・NEWバッジ ✅
lib/
supabase.ts           # Supabaseクライアント ✅
types/
index.ts              # 型定義・フォーマット色定義 ✅
scripts/
import.py              # shops.json・events_weekly.jsonをSupabaseにインポート ✅

## DBスキーマ（Supabase）
主要テーブル：
- `shops` - 店舗マスタ（緯度経度・WPN・マイスター・イベント集計・レビュー集計）
- `events` - 週次スクレイピングしたイベント（format・held_at）
- `reviews` - 5軸評価（stock/price/playspace/staff/access）+ テキスト
- `review_likes` - レビューいいね（複合PK）
- `profiles` - ユーザープロフィール（main_formats配列）
- `shop_photos` - 店舗写真（Supabase Storage）
- `photo_likes` - 写真いいね
- `shop_favorites` - お気に入り店舗

## フォーマット色分け
- commander: Purple
- standard: Blue
- modern: Green
- pioneer: Teal
- legacy: Red
- limited: Amber
- vintage: Pink
- other: Gray

## 評価軸（5軸）
1. stock_rating - 品揃え・在庫
2. price_rating - 価格設定・買取査定
3. playspace_rating - 対戦スペースの環境
4. staff_rating - 接客・店員の対応
5. access_rating - アクセス・利便性

## 実装済み ✅
- Supabaseスキーマ作成・データインポート（563店舗・1898イベント）
- マップ画面（Leaflet・クラスタリング・色分けピン・フォーマットフィルター）
- 店舗詳細ページ（基本情報・イベント情報・レビュー概要・レビュー一覧）
- 共通UIコンポーネント（FormatBadge・StarRating・ShopBadges・ShopCard）

## 残り実装リスト
### 認証
- [x] Google/X OAuth（Supabase Auth）
- [x] 初回ログイン時オンボーディング（フォーマット選択強制）
- [x] ミドルウェア（main_formats未設定→オンボーディングにリダイレクト）（Next.js 16では`proxy.ts`）

### レビュー機能
- [x] レビュー投稿フォーム（/shops/[id]/review）
- [x] レビュー編集
- [x] レビュー削除（確認ダイアログあり）
- [x] レビューいいね（トグル）
- [x] レビューのフォーマット絞り込み
- [x] レビューのいいね数/最新順ソート

### イベントタブ
- [ ] /events ページ（現在地周辺のイベント一覧）
- [ ] フォーマット絞り込み
- [ ] 日付指定（今日から7日以内）
- [ ] イベント注意書き（初回のみ表示・ローカルストレージ）

### お気に入り
- [ ] お気に入り登録/解除（星マーク）
- [ ] /favorites ページ（店舗一覧・今週のイベント切り替え）

### マイページ
- [ ] /mypage ページ
- [ ] プロフィール編集（名前・フォーマット・月1回制限）
- [ ] 投稿レビュー一覧・編集・削除
- [ ] 獲得いいね数表示
- [ ] ログアウト
- [ ] アカウント削除（全データ物理削除）

### 店舗写真
- [ ] 写真アップロード（1投稿3枚まで・WebP変換・1MB圧縮）
- [ ] 写真いいね
- [ ] 写真一覧（いいね順・5枚まで表示→もっと見る）

### 管理画面
- [ ] /admin ページ（管理者メール認証）
- [ ] 店舗管理（一覧・active/inactive切り替え・手動編集）
- [ ] レビュー管理（新着順・非表示・復元・削除）
- [ ] 写真管理（一覧・削除）
- [ ] ユーザーBAN機能

### PWA・軽量化
- [ ] next-pwa設定
- [ ] 日本語フォントのサブセット化
- [ ] WebP変換（browser-image-compression）

### その他
- [ ] 検索機能（店舗名・エリア）
- [ ] 404ページ
- [ ] 利用規約・プライバシーポリシーページ
- [ ] OGP設定（サイト名確定済み：ShopTutor）
- [ ] Vercelデプロイ
- [x] GitHub Actions（スクレイピング自動化・2日に1回12:00 JST）

## 設計上の重要な決定事項
- スクレイピング：WotCの利用規約グレーゾーン。問題があればイベント自動取得を停止し手動に切り替え
- 地図：Leaflet + OpenStreetMap（Google Maps APIは使わない・完全無料）
- 認証：Google/X外部認証のみ（メール登録なし）
- レビュー：1店舗1レビュー・5軸評価・星のみ投稿可（テキストは30字以上必須）
- NEWバッジ：first_listed_atから30日以内
- inactive店舗：マップに表示しないがDBには残す・直接URLでアクセス可能
- 管理者：環境変数ADMIN_EMAILSで制御
- 写真圧縮：browser-image-compressionでWebP・最大1MB・最大幅1920px
- イベント注意書き：⑤イベントタブと⑥-bお気に入りイベントのみ表示（初回のみ）
- 都市部/郊外の距離切り替え：3km/5km/10km/制限なしでユーザーが手動選択