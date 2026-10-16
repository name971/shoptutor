'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { ShopListItem, FORMAT_HEX } from '@/types'
import { renderPinHtml, renderClusterHtml } from './ShopMarker'
import { getMainFormat, getFormatCount } from '@/lib/shopFormat'
import { Plus, Minus, LocateFixed, Maximize2 } from 'lucide-react'
import { COUNT_STEPS, EMPTY_FILL, shortPrefectureName } from '@/lib/area'

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
// 全国表示で収める範囲（九州〜北海道。沖縄は寄せて見る）[[西, 南], [東, 北]]
const JAPAN_BOUNDS: [[number, number], [number, number]] = [[129.5, 31.0], [145.8, 45.5]]
// これ未満のズームでは店名ラベルを出さない（広域で文字が重なって読めなくなるため）
const LABEL_MIN_ZOOM = 12
// これより拡大したらクラスタにまとめず全ピンを出す
const CLUSTER_MAX_ZOOM = 13
const VIEW_STORAGE_KEY = 'shoptutor_map_view_v2'
// これ未満のズームでは店舗ピンの代わりに都道府県の塗り分け（店舗数）を出す
const PREF_MAX_ZOOM = 6.5
// 都道府県をタップしたときに少なくともこのズームまで寄せる（ピンが出る大きさ）
const PREF_FOCUS_MIN_ZOOM = 7
const PREFECTURES_URL = '/geo/prefectures.json'

// 都道府県の塗り色（店舗数の段階）。MapLibreの式で書く
const PREF_FILL_COLOR: maplibregl.ExpressionSpecification = [
  'step',
  ['get', 'count'],
  EMPTY_FILL,
  ...[...COUNT_STEPS].reverse().flatMap((s) => [s.min, s.fill] as [number, string]),
]

type PrefLabel = { name: string; lngLat: [number, number] }

// 都道府県のラベル位置：いちばん大きい輪郭の重心（離島に引っ張られないように）
function labelPointOf(feature: GeoJSON.Feature): [number, number] {
  const g = feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  let best: { area: number; c: [number, number] } | null = null
  for (const poly of polys) {
    const ring = poly[0]
    let a = 0, cx = 0, cy = 0
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i]
      const [x2, y2] = ring[i + 1]
      const f = x1 * y2 - x2 * y1
      a += f
      cx += (x1 + x2) * f
      cy += (y1 + y2) * f
    }
    if (a === 0) continue
    const c: [number, number] = [cx / (3 * a), cy / (3 * a)]
    if (!best || Math.abs(a) > best.area) best = { area: Math.abs(a), c }
  }
  return best?.c ?? (polys[0][0][0] as [number, number])
}

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
  // 広域では都道府県の塗り分けを出す（エリアを絞り込んでいるときは出さない）
  showPrefectures?: boolean
  // 都道府県の塗り分け表示に入った／出たとき（凡例の切り替えに使う）
  onPrefectureModeChange?: (prefectureMode: boolean) => void
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
  showPrefectures = true,
  onPrefectureModeChange,
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
  const onPrefModeRef = useRef(onPrefectureModeChange)
  const showPrefecturesRef = useRef(showPrefectures)
  const prefGeoRef = useRef<GeoJSON.FeatureCollection | null>(null)
  const prefLabelsRef = useRef<PrefLabel[]>([])
  const prefCountsRef = useRef<Map<string, number>>(new Map())
  const prefMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const [prefGeoReady, setPrefGeoReady] = useState(false)
  const locationMarkerRef = useRef<maplibregl.Marker | null>(null)
  const focusPrefectureRef = useRef<(name: string) => void>(() => {})
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')

  useEffect(() => {
    onShopSelectRef.current = onShopSelect
    onMapClickRef.current = onMapClick
    onBoundsChangeRef.current = onBoundsChange
    onPrefModeRef.current = onPrefectureModeChange
  }, [onShopSelect, onMapClick, onBoundsChange, onPrefectureModeChange])

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
    let restored = false
    try {
      const saved = window.sessionStorage.getItem(VIEW_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed?.center) && typeof parsed.zoom === 'number') {
          center = parsed.center
          zoom = parsed.zoom
          restored = true
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
    // 初めて開いたときは画面の大きさに合わせて日本全体を収める
    if (!restored) map.fitBounds(JAPAN_BOUNDS, { padding: 24, duration: 0 })
    mapRef.current = map
    const markers = markersRef.current
    const prefMarkers = prefMarkersRef.current

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

      // 都道府県の境界（約55KB）。地図の文字より下に塗る
      fetch(PREFECTURES_URL)
        .then((r) => r.json() as Promise<GeoJSON.FeatureCollection>)
        .then((geo) => {
          if (mapRef.current !== map) return
          prefGeoRef.current = geo
          prefLabelsRef.current = geo.features.map((f) => ({
            name: String(f.properties?.name ?? ''),
            lngLat: labelPointOf(f),
          }))
          const firstSymbol = map.getStyle().layers.find((l) => l.type === 'symbol')?.id
          map.addSource('prefectures', { type: 'geojson', data: geo })
          const fadeOut: maplibregl.ExpressionSpecification = [
            'interpolate', ['linear'], ['zoom'], PREF_MAX_ZOOM - 0.6, 1, PREF_MAX_ZOOM, 0,
          ]
          map.addLayer(
            {
              id: 'pref-fill',
              type: 'fill',
              source: 'prefectures',
              maxzoom: PREF_MAX_ZOOM,
              paint: {
                'fill-color': PREF_FILL_COLOR,
                'fill-opacity': ['interpolate', ['linear'], ['zoom'], PREF_MAX_ZOOM - 0.6, 0.85, PREF_MAX_ZOOM, 0],
              },
            },
            firstSymbol
          )
          map.addLayer(
            {
              id: 'pref-line',
              type: 'line',
              source: 'prefectures',
              maxzoom: PREF_MAX_ZOOM,
              paint: { 'line-color': '#ffffff', 'line-width': 1, 'line-opacity': fadeOut },
            },
            firstSymbol
          )
          map.on('click', 'pref-fill', (e) => {
            const name = e.features?.[0]?.properties?.name
            if (typeof name === 'string') focusPrefecture(name)
          })
          map.on('mouseenter', 'pref-fill', () => (map.getCanvas().style.cursor = 'pointer'))
          map.on('mouseleave', 'pref-fill', () => (map.getCanvas().style.cursor = ''))
          setPrefGeoReady(true)
        })
        .catch(() => {
          // 境界が取れなくても、いつもの店舗ピンの地図として使える
        })
    })

    // 都道府県をタップ：その県の店舗が収まるところまで寄せる（ピンが出る大きさまでは必ず寄せる）
    const focusPrefecture = (name: string) => {
      const points = [...shopByIdRef.current.values()].filter(
        (s) => s.prefecture === name && s.lat !== null && s.lng !== null
      )
      const label = prefLabelsRef.current.find((l) => l.name === name)
      if (points.length === 0) {
        if (label) map.easeTo({ center: label.lngLat, zoom: PREF_FOCUS_MIN_ZOOM })
        return
      }
      const bounds = new maplibregl.LngLatBounds()
      points.forEach((s) => bounds.extend([s.lng as number, s.lat as number]))
      const camera = map.cameraForBounds(bounds, { padding: 60, maxZoom: 12 })
      if (!camera) return
      map.easeTo({ ...camera, zoom: Math.max(camera.zoom ?? PREF_FOCUS_MIN_ZOOM, PREF_FOCUS_MIN_ZOOM), duration: 700 })
    }
    focusPrefectureRef.current = focusPrefecture
    map.on('moveend', emitBounds)
    map.on('moveend', saveView)
    map.on('zoom', updateLabelVisibility)
    map.on('click', () => onMapClickRef.current?.())
    updateLabelVisibility()

    return () => {
      markers.forEach((m) => m.remove())
      markers.clear()
      prefMarkers.forEach((m) => m.remove())
      prefMarkers.clear()
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

  // 都道府県ごとの店舗数を塗り分けに反映（フォーマットなどの絞り込みも反映される）
  useEffect(() => {
    const map = mapRef.current
    const geo = prefGeoRef.current
    showPrefecturesRef.current = showPrefectures
    if (!map || !mapReady || !prefGeoReady || !geo) return
    const counts = new Map<string, number>()
    for (const s of shops) counts.set(s.prefecture, (counts.get(s.prefecture) ?? 0) + 1)
    prefCountsRef.current = counts
    ;(map.getSource('prefectures') as maplibregl.GeoJSONSource | undefined)?.setData({
      ...geo,
      features: geo.features.map((f) => ({
        ...f,
        properties: { ...f.properties, count: counts.get(String(f.properties?.name)) ?? 0 },
      })),
    })
    const visibility = showPrefectures ? 'visible' : 'none'
    if (map.getLayer('pref-fill')) map.setLayoutProperty('pref-fill', 'visibility', visibility)
    if (map.getLayer('pref-line')) map.setLayoutProperty('pref-line', 'visibility', visibility)
    // ラベルの数字が変わるので作り直す
    prefMarkersRef.current.forEach((m) => m.remove())
    prefMarkersRef.current.clear()
    map.triggerRepaint()
  }, [shops, showPrefectures, mapReady, prefGeoReady])

  // 表示中のクラスタ・店舗に合わせてHTMLマーカーを出し入れする
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    let lastPrefMode: boolean | null = null

    // 都道府県の店舗数ラベル。重なるものは店舗数の少ない方を出さない（拡大すると出てくる）
    const syncPrefLabels = (show: boolean) => {
      const placed: { x1: number; y1: number; x2: number; y2: number }[] = []
      const counts = prefCountsRef.current
      const labels = show
        ? [...prefLabelsRef.current].sort((a, b) => (counts.get(b.name) ?? 0) - (counts.get(a.name) ?? 0))
        : []
      const keep = new Set<string>()
      for (const l of labels) {
        const n = counts.get(l.name) ?? 0
        if (n === 0) continue
        const p = map.project(l.lngLat)
        const text = `${shortPrefectureName(l.name)} ${n}`
        const w = text.length * 11 + 12
        const box = { x1: p.x - w / 2, y1: p.y - 11, x2: p.x + w / 2, y2: p.y + 11 }
        if (placed.some((b) => box.x1 < b.x2 && box.x2 > b.x1 && box.y1 < b.y2 && box.y2 > b.y1)) continue
        placed.push(box)
        keep.add(l.name)
        if (prefMarkersRef.current.has(l.name)) continue
        const el = document.createElement('button')
        el.type = 'button'
        el.className = 'pref-label-button'
        el.setAttribute('aria-label', `${l.name} ${n}店。拡大する`)
        el.innerHTML = `<span class="pref-label"><span>${shortPrefectureName(l.name)}</span><b>${n}</b></span>`
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          focusPrefectureRef.current(l.name)
        })
        prefMarkersRef.current.set(l.name, new maplibregl.Marker({ element: el }).setLngLat(l.lngLat).addTo(map))
      }
      prefMarkersRef.current.forEach((m, name) => {
        if (!keep.has(name)) {
          m.remove()
          prefMarkersRef.current.delete(name)
        }
      })
    }

    const sync = () => {
      const prefMode = showPrefecturesRef.current && prefLabelsRef.current.length > 0 && map.getZoom() < PREF_MAX_ZOOM
      if (prefMode !== lastPrefMode) {
        lastPrefMode = prefMode
        onPrefModeRef.current?.(prefMode)
      }
      syncPrefLabels(prefMode)
      if (prefMode) {
        // 広域では店舗ピン・まとめの丸は出さない
        markersRef.current.forEach((m) => m.remove())
        markersRef.current.clear()
        return
      }
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
    mapRef.current?.fitBounds(JAPAN_BOUNDS, { padding: 24, duration: 700 })
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
