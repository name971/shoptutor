import L from 'leaflet'

function getMarkerColor(avgTotal: number | null): string {
  if (avgTotal === null) return '#9ca3af'
  if (avgTotal >= 4.0) return '#22c55e'
  if (avgTotal >= 3.0) return '#f59e0b'
  return '#ef4444'
}

function getStrokeColor(avgTotal: number | null): string {
  if (avgTotal === null) return '#6b7280'
  if (avgTotal >= 4.0) return '#16a34a'
  if (avgTotal >= 3.0) return '#d97706'
  return '#dc2626'
}

export function createShopMarkerIcon(avgTotal: number | null): L.DivIcon {
  const fill = getMarkerColor(avgTotal)
  const stroke = getStrokeColor(avgTotal)
  const label = avgTotal !== null ? avgTotal.toFixed(1) : '—'

  const svg = `
    <svg width="44" height="54" viewBox="0 0 52 64" xmlns="http://www.w3.org/2000/svg">
      <path d="M26 2C14.95 2 6 10.95 6 22c0 15 20 40 20 40s20-25 20-40C46 10.95 37.05 2 26 2z"
        fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
      <text x="26" y="26" text-anchor="middle" font-size="13" font-weight="500"
        fill="white" font-family="sans-serif">${label}</text>
    </svg>
  `

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [44, 54],
    iconAnchor: [22, 54],
    popupAnchor: [0, -54],
  })
}