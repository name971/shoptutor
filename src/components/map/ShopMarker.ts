import L from 'leaflet'
import { FORMAT_HEX } from '@/types'

type MarkerOptions = {
  // ピンの色に使うフォーマット（nullならイベントなしのグレー）
  format: string | null
  // ピン中央の数字（週のイベント数）
  count: number
  selected?: boolean
}

const EMPTY_COLOR = '#9ca3af'

// フォーマット色の丸ピン＋下向きの小さな三角。数字は週のイベント数
export function createShopMarkerIcon({ format, count, selected = false }: MarkerOptions): L.DivIcon {
  const color = format ? FORMAT_HEX[format] ?? EMPTY_COLOR : EMPTY_COLOR
  const size = selected ? 42 : count > 0 ? 32 : 22
  const label = count > 0 ? (count > 99 ? '99+' : String(count)) : ''
  const fontSize = label.length >= 3 ? 10 : selected ? 15 : 13
  const ring = selected ? `0 0 0 4px ${color}55,` : ''

  const html = `
    <div class="shop-pin" style="--pin:${color};width:${size}px;height:${size + 6}px">
      <div class="shop-pin-body" style="width:${size}px;height:${size}px;font-size:${fontSize}px;box-shadow:${ring}0 2px 6px rgba(0,0,0,.35)">${label}</div>
      <div class="shop-pin-tip"></div>
    </div>
  `

  return L.divIcon({
    html,
    className: '',
    iconSize: [size, size + 6],
    iconAnchor: [size / 2, size + 6],
  })
}

// クラスタ（複数店舗のまとまり）のアイコン。数字は店舗数。colorを渡すとその色（フォーマット絞り込み中）
export function createClusterIcon(count: number, color: string | null = null): L.DivIcon {
  const size = count >= 100 ? 52 : count >= 20 ? 44 : 38
  const colorStyle = color ? `background:${color};box-shadow:0 0 0 4px ${color}33,0 2px 6px rgba(0,0,0,.3);` : ''
  return L.divIcon({
    html: `<div class="shop-cluster" style="width:${size}px;height:${size}px;${colorStyle}">${count}</div>`,
    className: '',
    iconSize: [size, size],
  })
}
