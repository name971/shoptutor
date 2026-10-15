'use client'

import { useEffect, useRef, useState } from 'react'
import { ShopListItem, FORMAT_HEX } from '@/types'
import { createShopMarkerIcon, createClusterIcon } from './ShopMarker'
import { getMainFormat, getFormatCount } from '@/lib/shopFormat'
import { Plus, Minus, LocateFixed, Maximize2 } from 'lucide-react'

export type MapBounds = {
  north: number
  south: number
  east: number
  west: number
}

const DEFAULT_CENTER: [number, number] = [36.5, 136.0]
const DEFAULT_ZOOM = 6
// これ未満のズームでは店名ラベルを出さない（広域で文字が重なって読めなくなるため）
const LABEL_MIN_ZOOM = 13

// 店舗が少ないときはピン同士が重なる場合だけまとめる（半径を小さく）
function getClusterRadius(shopCount: number): number {
  if (shopCount <= 30) return 24
  if (shopCount <= 100) return 40
  return 50
}

// これ以上ズームしたらまとめずに全ピンを出す
const DISABLE_CLUSTERING_ZOOM = 15

function createClusterLayer(L: any, radius: number, colorRef: { current: string | null }) {
  return L.markerClusterGroup({
    maxClusterRadius: radius,
    disableClusteringAtZoom: DISABLE_CLUSTERING_ZOOM,
    showCoverageOnHover: false,
    iconCreateFunction: (cluster: any) => createClusterIcon(cluster.getChildCount(), colorRef.current),
  })
}

// ピンの色と数字：フォーマットで絞り込み中はそのフォーマットの色・回数、それ以外は主力フォーマットの色・週のイベント数
function markerIcon(shop: ShopListItem, highlightFormat: string | null, selected: boolean) {
  return createShopMarkerIcon({
    format: highlightFormat ?? getMainFormat(shop),
    count: highlightFormat ? getFormatCount(shop, highlightFormat) : shop.weekly_event_count,
    selected,
  })
}

type Props = {
  shops: ShopListItem[]
  visibleCount?: number
  onShopSelect?: (shop: ShopListItem) => void
  // ピン以外の地図をタップしたとき（選択解除に使う）
  onMapClick?: () => void
  onBoundsChange?: (bounds: MapBounds) => void
  focusShop?: ShopListItem | null
  focusToken?: number
  // エリア絞り込み時に、この店舗群が収まるよう地図を合わせる（nullなら動かさない）
  fitShops?: ShopListItem[] | null
  selectedShopId?: string | null
  highlightFormat?: string | null
}

export default function ShopMap({
  shops,
  visibleCount,
  onShopSelect,
  onMapClick,
  onBoundsChange,
  focusShop,
  focusToken,
  fitShops,
  selectedShopId = null,
  highlightFormat = null,
}: Props) {
  const clusterCountBasis = visibleCount ?? shops.length
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const clusterRef = useRef<any>(null)
  const clusterRadiusRef = useRef<number | null>(null)
  const markersRef = useRef<Map<string, { marker: any; shop: ShopListItem }>>(new Map())
  const selectedIdRef = useRef<string | null>(selectedShopId)
  const highlightFormatRef = useRef<string | null>(highlightFormat)
  // フォーマットで絞り込み中は、クラスタもそのフォーマット色にする
  const clusterColorRef = useRef<string | null>(highlightFormat ? FORMAT_HEX[highlightFormat] ?? null : null)
  const onShopSelectRef = useRef(onShopSelect)
  const onMapClickRef = useRef(onMapClick)
  const onBoundsChangeRef = useRef(onBoundsChange)
  const locationMarkerRef = useRef<any>(null)
  const locationCircleRef = useRef<any>(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')

  useEffect(() => {
    onShopSelectRef.current = onShopSelect
    onMapClickRef.current = onMapClick
    onBoundsChangeRef.current = onBoundsChange
  }, [onShopSelect, onMapClick, onBoundsChange])

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
        zoomControl: false,
      })
      map.attributionControl.setPrefix(false)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      const radius = getClusterRadius(clusterCountBasis)
      const cluster = createClusterLayer(L, radius, clusterColorRef)
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

      const updateLabelVisibility = () => {
        mapRef.current?.classList.toggle('map-labels-hidden', map.getZoom() < LABEL_MIN_ZOOM)
      }

      map.on('moveend', emitBounds)
      map.on('moveend', saveView)
      map.on('zoomend', updateLabelVisibility)
      map.on('click', () => onMapClickRef.current?.())
      updateLabelVisibility()

      map.on('locationfound', (e: any) => {
        setLocating(false)
        setLocationError('')

        if (locationMarkerRef.current) map.removeLayer(locationMarkerRef.current)
        if (locationCircleRef.current) map.removeLayer(locationCircleRef.current)

        locationMarkerRef.current = L.circleMarker(e.latlng, {
          radius: 8,
          color: '#fff',
          weight: 2,
          fillColor: '#2563eb',
          fillOpacity: 1,
        }).addTo(map)

        locationCircleRef.current = L.circle(e.latlng, {
          radius: e.accuracy,
          color: '#2563eb',
          weight: 1,
          fillColor: '#2563eb',
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

  // ピンの再構築（shops・絞り込み中のフォーマットが変わるたび）
  useEffect(() => {
    if (typeof window === 'undefined') return

    let cancelled = false
    highlightFormatRef.current = highlightFormat
    clusterColorRef.current = highlightFormat ? FORMAT_HEX[highlightFormat] ?? null : null

    const rebuildMarkers = async () => {
      const L = (await import('leaflet')).default

      // 地図の初期化待ち
      while (!cancelled && !clusterRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      if (cancelled || !clusterRef.current || !mapInstanceRef.current) return

      const desiredRadius = getClusterRadius(clusterCountBasis)
      if (desiredRadius !== clusterRadiusRef.current) {
        mapInstanceRef.current.removeLayer(clusterRef.current)
        const newCluster = createClusterLayer(L, desiredRadius, clusterColorRef)
        mapInstanceRef.current.addLayer(newCluster)
        clusterRef.current = newCluster
        clusterRadiusRef.current = desiredRadius
      }

      clusterRef.current.clearLayers()
      markersRef.current.clear()
      const markers: any[] = []

      shops.forEach((shop) => {
        if (!shop.lat || !shop.lng) return

        const selected = shop.id === selectedIdRef.current
        const marker = L.marker([shop.lat, shop.lng], {
          icon: markerIcon(shop, highlightFormat, selected),
          zIndexOffset: selected ? 1000 : 0,
          title: shop.name,
          alt: shop.name,
        })

        marker.bindTooltip(shop.name, {
          permanent: true,
          direction: 'bottom',
          offset: [0, 4],
          className: 'shop-name-label',
        })

        marker.on('click', () => {
          onShopSelectRef.current?.(shop)
          // 下に出るプレビューカードに隠れないよう、ピンを画面の上寄りに収める
          mapInstanceRef.current?.panInside(marker.getLatLng(), {
            paddingTopLeft: [40, 80],
            paddingBottomRight: [40, 260],
          })
        })

        markers.push(marker)
        markersRef.current.set(shop.id, { marker, shop })
      })
      // 1件ずつ追加するとクラスタの再計算が毎回走るため、まとめて追加する
      clusterRef.current.addLayers(markers)
    }

    rebuildMarkers()

    return () => {
      cancelled = true
    }
  }, [shops, clusterCountBasis, highlightFormat])

  // 選択中のピンだけ大きく・前面に表示する
  useEffect(() => {
    const prevId = selectedIdRef.current
    selectedIdRef.current = selectedShopId
    ;[prevId, selectedShopId].forEach((id) => {
      if (!id) return
      const entry = markersRef.current.get(id)
      if (!entry) return
      const selected = id === selectedShopId
      entry.marker.setIcon(markerIcon(entry.shop, highlightFormatRef.current, selected))
      entry.marker.setZIndexOffset(selected ? 1000 : 0)
    })
  }, [selectedShopId])

  // 一覧の店舗クリックで、地図をその店舗の位置にズームインする
  useEffect(() => {
    if (!focusShop || focusShop.lat === null || focusShop.lng === null) return
    if (!mapInstanceRef.current) return

    mapInstanceRef.current.flyTo([focusShop.lat, focusShop.lng], 16, { duration: 0.6 })
  }, [focusShop, focusToken])

  useEffect(() => {
    if (!fitShops || !mapInstanceRef.current) return
    const points = fitShops
      .filter((s) => s.lat !== null && s.lng !== null)
      .map((s) => [s.lat, s.lng] as [number, number])
    if (points.length === 0) return
    mapInstanceRef.current.fitBounds(points, { padding: [40, 40], maxZoom: 14 })
  }, [fitShops])

  const handleLocate = () => {
    if (!mapInstanceRef.current) return
    setLocating(true)
    setLocationError('')
    mapInstanceRef.current.locate({ setView: true, maxZoom: 15 })
  }

  const handleResetView = () => {
    mapInstanceRef.current?.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, { duration: 0.6 })
  }

  const controlClass =
    'w-10 h-10 bg-white flex items-center justify-center text-gray-700 hover:bg-gray-50 disabled:opacity-50'

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="shop-map w-full h-full" />

      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
        <div className="hidden md:flex flex-col rounded-xl shadow-md border border-gray-200 overflow-hidden divide-y">
          <button type="button" onClick={() => mapInstanceRef.current?.zoomIn()} aria-label="拡大" className={controlClass}>
            <Plus size={18} />
          </button>
          <button type="button" onClick={() => mapInstanceRef.current?.zoomOut()} aria-label="縮小" className={controlClass}>
            <Minus size={18} />
          </button>
        </div>
        <button
          type="button"
          onClick={handleLocate}
          disabled={locating}
          aria-label="現在地を表示"
          title="現在地を表示"
          className={`${controlClass} rounded-xl shadow-md border border-gray-200 text-blue-600`}
        >
          {locating ? (
            <span className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
          ) : (
            <LocateFixed size={18} />
          )}
        </button>
        <button
          type="button"
          onClick={handleResetView}
          aria-label="全国を表示"
          title="全国を表示"
          className={`${controlClass} rounded-xl shadow-md border border-gray-200`}
        >
          <Maximize2 size={18} />
        </button>
      </div>

      {locationError && (
        <div className="absolute top-3 right-16 z-[1000] bg-white text-xs text-red-600 px-2.5 py-1.5 rounded-lg shadow-md border border-gray-200 whitespace-nowrap">
          {locationError}
        </div>
      )}
    </div>
  )
}
