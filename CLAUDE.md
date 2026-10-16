@AGENTS.md
# ShopTutor - プロジェクト引き継ぎドキュメント

## サービス概要
マジック：ザ・ギャザリングの公認店舗レビューサイト。
対象店舗：mtg-jp.comの公認店舗（日本全国・店舗数はスクレイピングで自動増減。2026-10時点で約560店舗）

## 技術スタック
- フロントエンド：Next.js 16 (App Router) + TypeScript + Tailwind CSS
- DB・認証：Supabase (PostgreSQL)
- 地図：MapLibre GL + OpenFreeMap（ベクタータイル・無料・登録不要・利用回数の上限なし）
- ホスティング：Vercel（予定）
- スクレイピング：Python (BeautifulSoup) + GitHub Actions（1日1回 12:00 JST、スクレイピングラグ吸収のため8日分取得。ただし週イベント数・フォーマット別集計は直近7日間のみで計算）

## 環境変数（.env.local）
NEXT_PUBLIC_SUPABASE_URL=https://jwsyqvuykdkoihurpxjb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=（anon key）

## ディレクトリ構成
src/
app/
page.tsx              # ホーム＝イベント一覧（「どこで遊ぶ？」今日/明日/今週末/7日間）✅
shops/
page.tsx            # 店舗タブ（リスト／地図の切り替え・絞り込みシート）✅
[id]/
page.tsx          # 店舗詳細ページ ✅
components/
map/
ShopMap.tsx         # MapLibre GLマップ本体（クラスタ・HTMLピン） ✅
ShopMarker.ts       # カスタムピン（主力フォーマット色＋週イベント数）・クラスタアイコン ✅
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
supabase/
migrations/            # DB変更のSQL（Supabase MCPで適用済みのものを記録）

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
- `shop_next_events`（ビュー）- 店舗ごとの次のイベント（JSTで未開始の最も早いもの。security_invoker）
- `shop_favorite_counts`（ビュー）- 店舗ごとのお気に入り数（おすすめ順の計算用）。中身は関数`get_shop_favorite_counts()`（security definer・件数のみ返す）
- `shop_favorites`のSELECTは本人の行だけ（RLS）。他人のお気に入りは件数としてしか取得できない

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
- マップ画面（MapLibre GL・クラスタリング・色分けピン・フォーマットフィルター）
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
- [x] 日本語フォント（2026-10に方針変更：本文・UIはM PLUS 2、ロゴ・大見出しはDela Gothic One。`next/font/google`で自己ホストし`preload: false`。Google Fontsの日本語は文字ごとに約120分割され、画面に出る文字を含む分だけが読み込まれるため、文字集合が決まらなくても実用的な容量に収まる）
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
- 地図：MapLibre GL + OpenFreeMap（`https://tiles.openfreemap.org/styles/liberty`。Google Maps APIは使わない・完全無料）。地名は日本語表記（name:ja）を優先。`NEXT_PUBLIC_MAP_STYLE_URL`でスタイルを差し替え可能
- 認証：Google/X外部認証のみ（メール登録なし）
- レビュー：1店舗1レビュー・5軸評価・星のみ投稿可（テキストは30字以上必須）
- NEWバッジ：first_listed_atから30日以内
- inactive店舗：マップに表示しないがDBには残す・直接URLでアクセス可能
- 管理者：環境変数ADMIN_EMAILSで制御
- 写真圧縮：browser-image-compressionでWebP・最大1MB・最大幅1920px
- イベント注意書き：⑤イベントタブと⑥-bお気に入りイベントのみ表示（初回のみ）
- 都市部/郊外の距離切り替え：3km/5km/10km/制限なしでユーザーが手動選択
- UI共通ルール：絞り込みチップは`components/ui/Chip.tsx`（選択中＝濃紺塗り＋白文字）に統一。横に並べるときは`ChipRow`（はみ出すと端に◀▶ボタン、マウスホイールでも横スクロール）を使う。カードは`surface`、上部固定ヘッダーは`app-header`（どちらも`globals.css`の`@utility`）。文字は11px未満を使わない。アイコンは絵文字ではなく`lucide-react`。主ボタンは青（blue-600）
- フォント：本文は`font-sans`（M PLUS 2）。ロゴ・ページの大見出しだけ`font-display`（Dela Gothic One、太さは1種類なのでbold指定しない。擬似太字は`font-synthesis-weight: none`で無効）。店名やユーザー名など長い固有名詞には`font-display`を使わない
- ダークモード：未対応のためライト表示に固定（`globals.css`で`color-scheme: light`）
- タブ構成（4タブ）：イベント（`/`）・店舗（`/shops`）・お気に入り・マイページ。ホームはイベント中心（レビューが少ない時期でも毎日内容が変わるため）。旧URLの`/events`→`/`、`/map`→`/shops?view=map`は`next.config.ts`でリダイレクト
- ホーム（イベント）：開始時刻順・日付ごとの見出し。Supabaseの取得上限（既定1000件）を超えないよう50件ずつページ取得し、件数は`count: 'exact'`で取得。全国表示は店舗IDを並べずに`shops!inner(status)`で絞る（URL長対策）
- 店舗タブの絞り込み：上部はフォーマット1段＋「絞り込み」ボタンのみ。エリア（入口のエリア選択と同じ状態）・WPN・マイスター・並び順はボトムシート（`components/ui/BottomSheet.tsx`）。地図表示でエリアを選ぶと、そのエリアに地図を合わせる
- 地図の表示：ピンの色＝その店で一番多いフォーマット、数字＝週のイベント数（フォーマット絞り込み中はそのフォーマットの色・回数、クラスタも同色）。ピン・クラスタはHTMLマーカーで描き、GeoJSONソースのクラスタ機能でまとめる（ズーム13より拡大で全ピン）。店名ラベルはズーム12以上のみ。ピンをタップすると下に店舗カードを表示（ポップアップは使わない）。スマホは「この範囲の店舗 N件」から下に引き出すリスト、PCは右側に一覧
- マイページ：プロフィールカード（アバター・フォーマット・レビュー/写真/いいね数）、編集はボトムシート、投稿レビュー・写真、設定リスト（規約・ログアウト・アカウント削除）
- イベントタブと店舗タブの役割分け：イベント＝「いつ遊ぶか」（時間が主役）、店舗＝「どこへ行くか」（場所と店の特徴が主役）。同じ見た目にしない
  - イベントタブ：上部に7日分の日付ストリップ（`components/event/DateStrip.tsx`、日ごとの件数つき＋「7日間すべて」）。件数はRPC`event_counts_by_day`（JSTで開始済みの今日分は除く）。一覧は左に時刻・時間軸の線のタイムライン（`EventRow`）、1時間以内に始まるものは「まもなく」
  - 店舗タブ：MTGの店舗は主要な街に集まっているため、地図ではなく「エリアから探す」（`components/shop/AreaPicker.tsx`、地方ごとに都道府県タイル＋店舗数、前回見た都道府県・全国すべて）から始める。都道府県を選ぶと一覧＋市区町村チップ（住所から`lib/area.ts`の`cityOf`で取り出す。政令市は市でまとめる）。地図はヘッダーの切り替えで見られ、選んだエリアに合わせて表示。店舗カードはサムネイル（公式写真、なければ主力フォーマット色に頭文字）＋フォーマット内訳の細い帯＋「◯◯中心」。次回イベントはカードに出さない（ビュー`shop_next_events`は未使用で残置）
- 確認ダイアログ：`window.confirm`は使わず`useConfirm()`（`components/ui/ConfirmDialog.tsx`）。アカウント削除は「削除」と入力して実行
- 読み込み中：「読み込み中...」の文字ではなく`components/ui/Skeleton.tsx`の仮表示。店舗詳細は`loading.tsx`
- 店舗詳細のメタ情報：`generateMetadata`で店名入りのタイトル・説明文・OGP（カバー写真があれば画像に使う）
- lint：エラー・警告0を維持。ストレージ復元のための effect 内 setState と、圧縮済み投稿写真の`<img>`は理由付きの eslint-disable で許容
- 情報量：カードは3段まで（店舗カード＝店名＋評価／フォーマット内訳の帯／場所・週回数・主力・バッジ、イベント行＝フォーマット＋イベント名／店名＋距離）。説明文は1行に収める
- グラフ（`components/charts/`）：店舗詳細のイベント欄に「遊ばれているフォーマット（100%積み上げ横棒）」と「日別の開催数（今後7日・単色の縦棒）」。どちらも押すと一覧を絞り込む。フォーマット色はCVD検証で一部の組（コマンダー/スタンダード、モダン/パイオニア）が見分けにくいため、色だけに頼らず名前入りチップを凡例として棒の直下に置く
- 店舗詳細のヘッダー：最初は「店舗の詳細」と表示し、ページ内の店名（h1）がスクロールで隠れたら店名に切り替える（`DetailHeaderTitle`）
- イベント行のまとめ：同じ日付・同じ店舗・同じ開始時刻のイベントは1行にまとめ「同じ時間に他N件」で開く（`lib/groupEvents.ts`・`EventRow`の`items`）
- リマインダー（アプリ内だけ）：イベントのベルで付け外し。端末のブラウザ（localStorage）に保存しログイン不要。eventsは毎日入れ替わりIDが変わるため、店舗・開催日・開始時刻・イベント名で判定し中身を写して保存（`lib/reminders.ts`）。ホーム上部に「リマインド中」、今日の件数は下部ナビのイベントタブにバッジ。開催時刻を過ぎたものは表示しない。プッシュ通知・メールはしない
- 店舗詳細の共有ボタン：スマホは端末の共有メニュー（Web Share API）、使えない環境はリンクをコピー
- Supabase MCPでの注意：`DROP`を含むSQLはユーザー確認待ちになりタイムアウトしやすい。ポリシーは`ALTER POLICY`、ビュー・関数は`CREATE OR REPLACE`で変更する
- 高速化：
  - `proxy.ts`はログイン確認に`getClaims()`（非対称鍵なら手元でJWT検証）を使い、オンボーディング済みかは一度DBで確認したらCookie`st_onboarded`（値＝ユーザーID）に覚えて以降は問い合わせない
  - `lib/clientCache.ts`でタブ移動時の再取得を防ぐ（店舗一覧・お気に入り数は5分、店舗座標は10分）。戻ってきたときは`peekCached`で即表示
  - ホームは店名・都道府県をイベントと一緒に取得し、全店舗の座標は現在地を使うときだけ取得。現在地は再読み込みまでメモリに保持（保存はしない）
  - 店舗詳細は`generateMetadata`と本体で店舗の取得を`cache()`で共有
  - eventsに`(held_at, start_time)`と`(shop_id, held_at, start_time)`の複合インデックス
- 店舗詳細：下部ナビの代わりにアクションバー（お気に入り・レビュー・経路）を固定表示。経路はGoogleマップへリンク
- ホーム（イベント）の位置情報：いきなり許可ダイアログを出さず、説明カードの「現在地を使う」で取得（一度許可したら次回から自動）。ログイン中で保存済み条件がなければメインフォーマットで初期絞り込み