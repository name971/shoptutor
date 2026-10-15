import { FORMAT_HEX } from '@/types'

const EMPTY_COLOR = '#9ca3af'

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

type PinOptions = {
  name: string
  // ピンの色に使うフォーマット（nullならイベントなしのグレー）
  format: string | null
  // ピン中央の数字（週のイベント数）
  count: number
  selected?: boolean
}

// フォーマット色の丸ピン＋下向きの小さな三角＋店名ラベル（ラベルはズームに応じてCSSで出し分け）
export function renderPinHtml({ name, format, count, selected = false }: PinOptions): string {
  const color = format ? FORMAT_HEX[format] ?? EMPTY_COLOR : EMPTY_COLOR
  const size = selected ? 44 : count > 0 ? 32 : 22
  const label = count > 0 ? (count > 99 ? '99+' : String(count)) : ''
  const fontSize = label.length >= 3 ? 10 : selected ? 15 : 13
  const ring = selected ? `0 0 0 5px ${color}40,` : ''

  return `
    <div class="shop-pin${selected ? ' is-selected' : ''}" style="--pin:${color}">
      <div class="shop-pin-body" style="width:${size}px;height:${size}px;font-size:${fontSize}px;box-shadow:${ring}0 3px 8px rgba(15,23,42,.28)">${label}</div>
      <div class="shop-pin-tip"></div>
      <div class="shop-pin-label">${escapeHtml(name)}</div>
    </div>
  `
}

// クラスタ（複数店舗のまとまり）。数字は店舗数。colorを渡すとその色（フォーマット絞り込み中）
export function renderClusterHtml(count: number, color: string | null = null): string {
  const size = count >= 100 ? 54 : count >= 20 ? 46 : 40
  const colorStyle = color ? `background:${color};box-shadow:0 0 0 5px ${color}33,0 3px 8px rgba(15,23,42,.25);` : ''
  return `<div class="shop-cluster" style="width:${size}px;height:${size}px;${colorStyle}">${count}</div>`
}
