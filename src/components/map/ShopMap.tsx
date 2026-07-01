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

type Props = {
  shops: Shop[]
  onShopSelect?: (shop: Shop) => void
  onBoundsChange?: (bounds: MapBounds) => void
}

export default function ShopMap({ shops, onShopSelect, onBoundsChange }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const clusterRef = useRef<any>(null)
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

    const initMap = async () => {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      await import('leaflet.markercluster')
      await import('leaflet.markercluster/dist/MarkerCluster.css')
      await import('leaflet.markercluster/dist/MarkerCluster.Default.css')

      const map = L.map(mapRef.current!, {
        center: [36.5, 136.0],
        zoom: 6,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      const cluster = (L as any).markerClusterGroup({ maxClusterRadius: 40 })
      map.addLayer(cluster)

      const emitBounds = () => {
        const b = map.getBounds()
        onBoundsChangeRef.current?.({
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest(),
        })
      }

      map.on('moveend', emitBounds)

      mapInstanceRef.current = map
      clusterRef.current = cluster

      emitBounds()
    }

    initMap()

    return () => {
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
      if (cancelled || !clusterRef.current) return

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
  }, [shops])

  return (
    <div ref={mapRef} className="w-full h-full" />
  )
}
