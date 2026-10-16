// 都道府県の地方区分（店舗タブのエリア選択で使う）
export const REGIONS = [
  { name: '北海道・東北', prefectures: ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'] },
  { name: '関東', prefectures: ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県'] },
  { name: '甲信越・北陸', prefectures: ['新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県'] },
  { name: '東海', prefectures: ['岐阜県', '静岡県', '愛知県', '三重県'] },
  { name: '関西', prefectures: ['滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県'] },
  { name: '中国', prefectures: ['鳥取県', '島根県', '岡山県', '広島県', '山口県'] },
  { name: '四国', prefectures: ['徳島県', '香川県', '愛媛県', '高知県'] },
  { name: '九州・沖縄', prefectures: ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'] },
]

// 住所（都道府県は含まない）から市区町村を取り出す。政令市は区まで分けず「大阪市」のように市でまとめる。
// 郡は表示に要らないので「中頭郡北谷町」→「北谷町」にする
export function cityOf(address: string): string | null {
  const rest = address.trim()
  const m =
    rest.match(/^([^0-9０-９\s]{1,6}?[市区])/) ??
    rest.match(/^[^0-9０-９\s]{1,5}?郡([^0-9０-９\s]{1,5}?[町村])/) ??
    rest.match(/^([^0-9０-９\s]{1,4}?[町村])/)
  return m ? m[1] : null
}

// 都道府県ごとの店舗数の色（5段階の青）。塗り分け地図とMapLibreの地図で共通
export const COUNT_STEPS = [
  { min: 50, fill: '#1e3a8a', label: '50店〜' },
  { min: 20, fill: '#1d4ed8', label: '20〜49' },
  { min: 10, fill: '#3b82f6', label: '10〜19' },
  { min: 4, fill: '#93c5fd', label: '4〜9' },
  { min: 1, fill: '#dbeafe', label: '1〜3' },
]
export const EMPTY_FILL = '#eef1f5'

// 「東京都」→「東京」、「北海道」はそのまま（ラベルを短くする）
export function shortPrefectureName(prefecture: string) {
  return prefecture === '北海道' ? prefecture : prefecture.replace(/[都府県]$/, '')
}
