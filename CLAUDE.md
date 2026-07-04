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
- スクレイピング：Python (BeautifulSoup) + GitHub Actions（1日1回 12:00 JST、スクレイピングラグ吸収のため8日分取得。ただし週イベント数・フォーマット別集計は直近7日間のみで計算）

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
- `profiles` - ユーザープロフィール（main_format単一 + sub_formats最大2件）
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
- [x] ミドルウェア（main_format未設定→オンボーディングにリダイレクト）（Next.js 16では`proxy.ts`）

### レビュー機能
- [x] レビュー投稿フォーム（/shops/[id]/review）
- [x] レビュー編集
- [x] レビュー削除（確認ダイアログあり）
- [x] レビューいいね（トグル）
- [x] レビューのフォーマット絞り込み
- [x] レビューのいいね数/最新順ソート

### イベントタブ
- [x] /events ページ（現在地周辺のイベント一覧）
- [x] フォーマット絞り込み
- [x] 日付指定（今日から7日以内）
- [x] イベント注意書き（初回のみ表示・ローカルストレージ）

### お気に入り
- [x] お気に入り登録/解除（星マーク）
- [x] /favorites ページ（店舗一覧・今週のイベント切り替え）

### マイページ
- [x] /mypage ページ
- [x] プロフィール編集（名前・フォーマット・月1回制限）
- [x] 投稿レビュー一覧・編集・削除
- [x] 獲得いいね数表示
- [x] ログアウト
- [x] アカウント削除（全データ物理削除）

### 店舗写真
- [x] 写真アップロード（1投稿3枚まで・WebP変換・1MB圧縮）
- [x] 写真いいね
- [x] 写真一覧（いいね順・5枚まで表示→もっと見る）

### 管理画面
- [x] /admin ページ（管理者メール認証）
- [x] 店舗管理（一覧・active/inactive切り替え・手動編集）
- [x] レビュー管理（新着順・非表示・復元・削除）
- [x] 写真管理（一覧・削除）
- [x] ユーザーBAN機能

### PWA・軽量化
- [x] PWA対応（`next-pwa`はTurbopack非対応のため削除し、Next.js標準の`manifest.ts`+`apple-icon.tsx`で「ホーム画面に追加」に対応。オフライン/Service Workerは対象外）
- [x] 日本語フォント（現状維持で決定：ユーザー投稿・スクレイピングデータで文字集合が確定できないためサブセット化は非現実的。OS標準フォントのフォールバックのまま、追加Webフォントは導入しない）
- [x] WebP変換（browser-image-compression）

### プレミアム店舗オーナー機能
- [x] 管理画面から店舗オーナーを手動付与（`is_premium`+`owner_user_id`）
- [x] /owner ダッシュボード（店舗情報編集・営業時間・駐車場・公式写真最大3枚・レビュー概要・訪問者分析）
- [x] おすすめ順PRブースト（★評価は非改変、オーナーがON/OFF切替可、ラベル表示）
- [x] 訪問者分析（お気に入り済み/未お気に入り/未ログイン内訳、時間帯・曜日別、メイン/サブフォーマット別、CSV出力）

### その他
- [x] 検索機能（店舗名・エリア）
- [x] 404ページ（not-found.tsx）
- [x] 利用規約・プライバシーポリシーページ
- [x] OGP設定（サイト名：ShopTutor）
- [x] Vercelデプロイ（本番: https://shoptutor.vercel.app）
- [x] GitHub Actions（スクレイピング自動化・1日1回12:00 JST、8日分取得）

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