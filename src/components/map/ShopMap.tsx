'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShopListItem } from '@/types'
import { createShopMarkerIcon } from './ShopMarker'
import ShopPopup from './ShopPopup'
import { renderToString } from 'react-dom/server'

export type MapBounds = {
  north: number
  south: number
  east: number
  west: number
}

const DEFAULT_CENTER: [number, number] = [36.5, 136.0]
const DEFAULT_ZOOM = 6

// 0 はクラスタリングなし（個別ピン表示）を意味する
function getClusterRadius(shopCount: number): number {
  if (shopCount <= 20) return 0
  if (shopCount <= 100) return 30
  return 40
}

function createClusterLayer(L: any, radius: number) {
  return radius === 0 ? L.layerGroup() : L.markerClusterGroup({ maxClusterRadius: radius })
}

type Props = {
  shops: ShopListItem[]
  visibleCount?: number
  onShopSelect?: (shop: ShopListItem) => void
  onBoundsChange?: (bounds: MapBounds) => void
  focusShop?: ShopListItem | null
  focusToken?: number
}

export default function ShopMap({ shops, visibleCount, onShopSelect, onBoundsChange, focusShop, focusToken }: Props) {
  const clusterCountBasis = visibleCount ?? shops.length
  const router = useRouter()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const clusterRef = useRef<any>(null)
  const clusterRadiusRef = useRef<number | null>(null)
  const onShopSelectRef = useRef(onShopSelect)
  const onBoundsChangeRef = useRef(onBoundsChange)
  const locationMarkerRef = useRef<any>(null)
  const locationCircleRef = useRef<any>(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')

  useEffect(() => {
    onShopSelectRef.current = onShopSelect
  }, [onShopSelect])

  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange
  }, [onBoundsChange])

  // 地図本体の初期化（一度だけ）
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (mapInstanceRef.current) return
    if (!mapRef.current) return
    if ((mapRef.current as any)._leaflet_id) return

    let cancelled = false

    const initMap = async () => {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      await import('leaflet.markercluster')
      await import('leaflet.markercluster/dist/MarkerCluster.css')
      await import('leaflet.markercluster/dist/MarkerCluster.Default.css')

      if (cancelled || !mapRef.current || (mapRef.current as any)._leaflet_id) return

      let initialCenter: [number, number] = DEFAULT_CENTER
      let initialZoom = DEFAULT_ZOOM
      try {
        const saved = window.sessionStorage.getItem('shoptutor_map_view')
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed?.center && typeof parsed.zoom === 'number') {
            initialCenter = parsed.center
            initialZoom = parsed.zoom
          }
        }
      } catch {
        // 復元失敗時はデフォルト値のまま
      }

      const map = L.map(mapRef.current!, {
        center: initialCenter,
        zoom: initialZoom,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      const radius = getClusterRadius(clusterCountBasis)
      const cluster = createClusterLayer(L, radius)
      map.addLayer(cluster)
      clusterRadiusRef.current = radius

      const emitBounds = () => {
        const b = map.getBounds()
        onBoundsChangeRef.current?.({
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest(),
        })
      }

      const saveView = () => {
        try {
          const center = map.getCenter()
          window.sessionStorage.setItem(
            'shoptutor_map_view',
            JSON.stringify({ center: [center.lat, center.lng], zoom: map.getZoom() })
          )
        } catch {
          // 保存失敗は無視
        }
      }

      map.on('moveend', emitBounds)
      map.on('moveend', saveView)

      map.on('locationfound', (e: any) => {
        setLocating(false)
        setLocationError('')

        if (locationMarkerRef.current) map.removeLayer(locationMarkerRef.current)
        if (locationCircleRef.current) map.removeLayer(locationCircleRef.current)

        locationMarkerRef.current = L.circleMarker(e.latlng, {
          radius: 8,
          color: '#fff',
          weight: 2,
          fillColor: '#3b82f6',
          fillOpacity: 1,
        }).addTo(map)

        locationCircleRef.current = L.circle(e.latlng, {
          radius: e.accuracy,
          color: '#3b82f6',
          weight: 1,
          fillColor: '#3b82f6',
          fillOpacity: 0.1,
        }).addTo(map)
      })

      map.on('locationerror', () => {
        setLocating(false)
        setLocationError('位置情報を取得できませんでした')
      })

      mapInstanceRef.current = map
      clusterRef.current = cluster

      emitBounds()
    }

    initMap()

    return () => {
      cancelled = true
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        clusterRef.current = null
      }
    }
  }, [])

  // ピンの再構築（shopsが変わるたび）
  useEffect(() => {
    if (typeof window === 'undefined') return

    let cancelled = false

    const rebuildMarkers = async () => {
      const L = (await import('leaflet')).default

      // 地図の初期化待ち
      if (!clusterRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      if (cancelled || !clusterRef.current || !mapInstanceRef.current) return

      const desiredRadius = getClusterRadius(clusterCountBasis)
      if (desiredRadius !== clusterRadiusRef.current) {
        mapInstanceRef.current.removeLayer(clusterRef.current)
        const newCluster = createClusterLayer(L, desiredRadius)
        mapInstanceRef.current.addLayer(newCluster)
        clusterRef.current = newCluster
        clusterRadiusRef.current = desiredRadius
      }

      clusterRef.current.clearLayers()

      shops.forEach((shop) => {
        if (!shop.lat || !shop.lng) return

        const icon = createShopMarkerIcon(shop.avg_total)
        const marker = L.marker([shop.lat, shop.lng], { icon })

        const popupHtml = renderToString(<ShopPopup shop={shop} />)
        marker.bindPopup(popupHtml)

        marker.on('popupopen', (e: any) => {
          const link = e.popup
            .getElement()
            ?.querySelector(`[data-shop-detail-link="${shop.id}"]`)
          link?.addEventListener('click', (evt: MouseEvent) => {
            evt.preventDefault()
            router.push(`/shops/${shop.id}`)
          })
        })

        marker.bindTooltip(shop.name, {
          permanent: true,
          direction: 'top',
          offset: [0, -50],
          className: 'shop-name-label',
        })

        marker.on('click', () => {
          onShopSelectRef.current?.(shop)
        })

        clusterRef.current.addLayer(marker)
      })
    }

    rebuildMarkers()

    return () => {
      cancelled = true
    }
  }, [shops, clusterCountBasis])

  // サイドバー一覧の店舗クリックで、地図をその店舗の位置にズームインする
  useEffect(() => {
    if (!focusShop || focusShop.lat === null || focusShop.lng === null) return
    if (!mapInstanceRef.current) return

    mapInstanceRef.current.flyTo([focusShop.lat, focusShop.lng], 16, { duration: 0.6 })
  }, [focusShop, focusToken])

  const handleLocate = () => {
    if (!mapInstanceRef.current) return
    setLocating(true)
    setLocationError('')
    mapInstanceRef.current.locate({ setView: true, maxZoom: 15 })
  }

  const handleResetView = () => {
    if (!mapInstanceRef.current) return
    mapInstanceRef.current.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, { duration: 0.6 })
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />

      <div className="absolute bottom-6 right-16 z-[1000] flex flex-col items-center gap-1">
        <span className="bg-white text-[10px] text-gray-600 px-1.5 py-0.5 rounded-full shadow-md border border-gray-200 whitespace-nowrap">
          初期表示に戻る
        </span>
        <button
          onClick={handleResetView}
          aria-label="初期表示に戻る"
          className="w-10 h-10 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center text-blue-600"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
          </svg>
        </button>
      </div>

      <div className="absolute bottom-6 right-3 z-[1000] flex flex-col items-center gap-1">
        <span className="bg-white text-[10px] text-gray-600 px-1.5 py-0.5 rounded-full shadow-md border border-gray-200 whitespace-nowrap">
          現在地
        </span>
        <button
          onClick={handleLocate}
          disabled={locating}
          aria-label="現在地を表示"
          className="w-10 h-10 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center text-blue-600 disabled:opacity-50"
        >
          {locating ? (
            <span className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {locationError && (
        <div className="absolute bottom-24 right-3 z-[1000] bg-white text-xs text-red-500 px-2 py-1 rounded-lg shadow-md border border-gray-200 whitespace-nowrap">
          {locationError}
        </div>
      )}
    </div>
  )
}
