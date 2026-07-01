'use client'

import { useEffect, useRef } from 'react'
import { Shop } from '@/types'
import { createShopMarkerIcon } from './ShopMarker'
import ShopPopup from './ShopPopup'
import { renderToString } from 'react-dom/server'

export type MapBounds = {
  north: number
  south: number
  east: number
  west: number
}

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
  shops: Shop[]
  visibleCount?: number
  onShopSelect?: (shop: Shop) => void
  onBoundsChange?: (bounds: MapBounds) => void
}

export default function ShopMap({ shops, visibleCount, onShopSelect, onBoundsChange }: Props) {
  const clusterCountBasis = visibleCount ?? shops.length
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const clusterRef = useRef<any>(null)
  const clusterRadiusRef = useRef<number | null>(null)
  const onShopSelectRef = useRef(onShopSelect)
  const onBoundsChangeRef = useRef(onBoundsChange)

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

      let initialCenter: [number, number] = [36.5, 136.0]
      let initialZoom = 6
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

  return (
    <div ref={mapRef} className="w-full h-full" />
  )
}
