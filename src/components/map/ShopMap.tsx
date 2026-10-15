'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { ShopListItem, FORMAT_HEX } from '@/types'
import { renderPinHtml, renderClusterHtml } from './ShopMarker'
import { getMainFormat, getFormatCount } from '@/lib/shopFormat'
import { Plus, Minus, LocateFixed, Maximize2 } from 'lucide-react'

export type MapBounds = {
  north: number
  south: number
  east: number
  west: number
}

// OpenFreeMap（無料・登録不要・利用回数の上限なし）のベクタースタイル
const MAP_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty'

// [経度, 緯度]
const DEFAULT_CENTER: [number, number] = [136.0, 36.5]
const DEFAULT_ZOOM = 4.6
// これ未満のズームでは店名ラベルを出さない（広域で文字が重なって読めなくなるため）
const LABEL_MIN_ZOOM = 12
// これより拡大したらクラスタにまとめず全ピンを出す
const CLUSTER_MAX_ZOOM = 13
const VIEW_STORAGE_KEY = 'shoptutor_map_view_v2'

// 店舗が少ないときはピン同士が重なる場合だけまとめる（半径を小さく）
function getClusterRadius(shopCount: number): number {
  if (shopCount <= 30) return 30
  if (shopCount <= 100) return 45
  return 55
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
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const shopByIdRef = useRef<Map<string, ShopListItem>>(new Map())
  const selectedIdRef = useRef<string | null>(selectedShopId)
  const highlightFormatRef = useRef<string | null>(highlightFormat)
  const onShopSelectRef = useRef(onShopSelect)
  const onMapClickRef = useRef(onMapClick)
  const onBoundsChangeRef = useRef(onBoundsChange)
  const locationMarkerRef = useRef<maplibregl.Marker | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')

  useEffect(() => {
    onShopSelectRef.current = onShopSelect
    onMapClickRef.current = onMapClick
    onBoundsChangeRef.current = onBoundsChange
  }, [onShopSelect, onMapClick, onBoundsChange])

  // ピンの見た目：フォーマットで絞り込み中はそのフォーマットの色・回数、それ以外は主力フォーマットの色・週のイベント数
  const pinHtml = (shop: ShopListItem, selected: boolean) => {
    const format = highlightFormatRef.current
    return renderPinHtml({
      name: shop.name,
      format: format ?? getMainFormat(shop),
      count: format ? getFormatCount(shop, format) : shop.weekly_event_count,
      selected,
    })
  }

  // 地図本体の初期化（一度だけ）
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let center = DEFAULT_CENTER
    let zoom = DEFAULT_ZOOM
    try {
      const saved = window.sessionStorage.getItem(VIEW_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed?.center) && typeof parsed.zoom === 'number') {
          center = parsed.center
          zoom = parsed.zoom
        }
      }
    } catch {
      // 復元失敗時はデフォルト値のまま
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center,
      zoom,
      minZoom: 3.5,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: { compact: true },
    })
    map.touchZoomRotate.disableRotation()
    mapRef.current = map
    const markers = markersRef.current

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
        const c = map.getCenter()
        window.sessionStorage.setItem(
          VIEW_STORAGE_KEY,
          JSON.stringify({ center: [c.lng, c.lat], zoom: map.getZoom() })
        )
      } catch {
        // 保存失敗は無視
      }
    }

    const updateLabelVisibility = () => {
      containerRef.current?.classList.toggle('map-labels-hidden', map.getZoom() < LABEL_MIN_ZOOM)
    }

    map.on('load', () => {
      // 地名・駅名などは日本語表記を優先する
      map.getStyle().layers.forEach((layer) => {
        if (layer.type !== 'symbol') return
        const textField = map.getLayoutProperty(layer.id, 'text-field')
        if (textField && JSON.stringify(textField).includes('name')) {
          map.setLayoutProperty(layer.id, 'text-field', [
            'coalesce',
            ['get', 'name:ja'],
            ['get', 'name'],
          ])
        }
      })
      setMapReady(true)
      emitBounds()
    })
    map.on('moveend', emitBounds)
    map.on('moveend', saveView)
    map.on('zoom', updateLabelVisibility)
    map.on('click', () => onMapClickRef.current?.())
    updateLabelVisibility()

    return () => {
      markers.forEach((m) => m.remove())
      markers.clear()
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [])

  // 店舗データ（GeoJSON・クラスタ設定）の反映
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    highlightFormatRef.current = highlightFormat
    shopByIdRef.current = new Map(shops.map((s) => [s.id, s]))

    const data: GeoJSON.FeatureCollection<GeoJSON.Point> = {
      type: 'FeatureCollection',
      features: shops
        .filter((s) => s.lat !== null && s.lng !== null)
        .map((s) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [s.lng as number, s.lat as number] },
          properties: { id: s.id },
        })),
    }

    // クラスタ半径はソース作成時にしか指定できないため、作り直す
    if (map.getLayer('shops-hidden')) map.removeLayer('shops-hidden')
    if (map.getSource('shops')) map.removeSource('shops')
    map.addSource('shops', {
      type: 'geojson',
      data,
      cluster: true,
      clusterMaxZoom: CLUSTER_MAX_ZOOM,
      clusterRadius: getClusterRadius(clusterCountBasis),
    })
    // どのレイヤーからも参照されないソースはタイルが作られずquerySourceFeaturesで取れないため、
    // 見えないレイヤーを1つ置く（実際の見た目はHTMLマーカーで描く）
    map.addLayer({
      id: 'shops-hidden',
      type: 'circle',
      source: 'shops',
      paint: { 'circle-radius': 0, 'circle-opacity': 0 },
    })

    // 見た目が変わるので既存のHTMLマーカーは作り直す
    markersRef.current.forEach((m) => m.remove())
    markersRef.current.clear()
  }, [shops, clusterCountBasis, highlightFormat, mapReady])

  // 表示中のクラスタ・店舗に合わせてHTMLマーカーを出し入れする
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const sync = () => {
      if (!map.getSource('shops') || !map.isSourceLoaded('shops')) return
      const clusterColor = highlightFormatRef.current ? FORMAT_HEX[highlightFormatRef.current] ?? null : null
      const nextKeys = new Set<string>()

      map.querySourceFeatures('shops').forEach((feature) => {
        const props = feature.properties ?? {}
        const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates

        if (props.cluster) {
          const key = `c:${props.cluster_id}:${props.point_count}`
          nextKeys.add(key)
          if (markersRef.current.has(key)) return
          const el = document.createElement('button')
          el.type = 'button'
          el.className = 'shop-cluster-button'
          el.setAttribute('aria-label', `${props.point_count}店舗をまとめて表示中。拡大する`)
          el.innerHTML = renderClusterHtml(props.point_count, clusterColor)
          el.addEventListener('click', async (e) => {
            e.stopPropagation()
            const source = map.getSource('shops') as maplibregl.GeoJSONSource
            const expansionZoom = await source.getClusterExpansionZoom(props.cluster_id)
            map.easeTo({ center: [lng, lat], zoom: expansionZoom + 0.3 })
          })
          markersRef.current.set(key, new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map))
          return
        }

        const shop = shopByIdRef.current.get(props.id)
        if (!shop) return
        const key = `s:${shop.id}`
        nextKeys.add(key)
        if (markersRef.current.has(key)) return
        const el = document.createElement('button')
        el.type = 'button'
        el.className = 'shop-pin-button'
        el.setAttribute('aria-label', shop.name)
        const selected = shop.id === selectedIdRef.current
        el.innerHTML = pinHtml(shop, selected)
        if (selected) el.style.zIndex = '10'
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          onShopSelectRef.current?.(shop)
          // 下に出る店舗カードに隠れる位置なら、ピンが見える位置まで地図を動かす
          const point = map.project([lng, lat])
          const { clientHeight } = map.getContainer()
          if (point.y > clientHeight - 240 || point.y < 90) {
            map.easeTo({ center: [lng, lat], offset: [0, -60] })
          }
        })
        markersRef.current.set(
          key,
          new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(map)
        )
      })

      markersRef.current.forEach((marker, key) => {
        if (!nextKeys.has(key)) {
          marker.remove()
          markersRef.current.delete(key)
        }
      })
    }

    map.on('render', sync)
    sync()
    return () => {
      map.off('render', sync)
    }
  }, [mapReady])

  // 選択中のピンだけ大きく・前面に表示する
  useEffect(() => {
    const prevId = selectedIdRef.current
    selectedIdRef.current = selectedShopId
    ;[prevId, selectedShopId].forEach((id) => {
      if (!id) return
      const marker = markersRef.current.get(`s:${id}`)
      const shop = shopByIdRef.current.get(id)
      if (!marker || !shop) return
      const selected = id === selectedShopId
      const el = marker.getElement()
      el.innerHTML = pinHtml(shop, selected)
      el.style.zIndex = selected ? '10' : ''
    })
  }, [selectedShopId])

  // 一覧の店舗クリックで、地図をその店舗の位置にズームインする
  useEffect(() => {
    if (!focusShop || focusShop.lat === null || focusShop.lng === null) return
    mapRef.current?.flyTo({ center: [focusShop.lng, focusShop.lat], zoom: 15, duration: 700 })
  }, [focusShop, focusToken])

  useEffect(() => {
    const map = mapRef.current
    if (!fitShops || !map || !mapReady) return
    const points = fitShops.filter((s) => s.lat !== null && s.lng !== null)
    if (points.length === 0) return
    const bounds = new maplibregl.LngLatBounds()
    points.forEach((s) => bounds.extend([s.lng as number, s.lat as number]))
    map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 700 })
  }, [fitShops, mapReady])

  const handleLocate = () => {
    const map = mapRef.current
    if (!map) return
    if (!navigator.geolocation) {
      setLocationError('この端末では位置情報を利用できません')
      return
    }
    setLocating(true)
    setLocationError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        const lngLat: [number, number] = [pos.coords.longitude, pos.coords.latitude]
        if (!locationMarkerRef.current) {
          const el = document.createElement('div')
          el.className = 'current-location-dot'
          locationMarkerRef.current = new maplibregl.Marker({ element: el })
        }
        locationMarkerRef.current.setLngLat(lngLat).addTo(map)
        map.flyTo({ center: lngLat, zoom: 14, duration: 800 })
      },
      () => {
        setLocating(false)
        setLocationError('位置情報を取得できませんでした')
      }
    )
  }

  const handleResetView = () => {
    mapRef.current?.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 700 })
  }

  const controlClass =
    'w-10 h-10 bg-white flex items-center justify-center text-gray-700 hover:bg-gray-50 disabled:opacity-50'

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="shop-map w-full h-full" />

      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
        <div className="hidden md:flex flex-col rounded-2xl shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/5 overflow-hidden divide-y divide-slate-100">
          <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="拡大" className={controlClass}>
            <Plus size={18} />
          </button>
          <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="縮小" className={controlClass}>
            <Minus size={18} />
          </button>
        </div>
        <button
          type="button"
          onClick={handleLocate}
          disabled={locating}
          aria-label="現在地を表示"
          title="現在地を表示"
          className={`${controlClass} rounded-2xl shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/5 text-blue-600`}
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
          className={`${controlClass} rounded-2xl shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/5`}
        >
          <Maximize2 size={18} />
        </button>
      </div>

      {locationError && (
        <div className="absolute top-3 right-16 z-10 bg-white text-xs text-red-600 px-3 py-2 rounded-xl shadow-lg ring-1 ring-slate-900/5 whitespace-nowrap">
          {locationError}
        </div>
      )}
    </div>
  )
}
