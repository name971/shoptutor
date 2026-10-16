'use client'

import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const MAP_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty'
const JAPAN_CENTER: [number, number] = [137.0, 36.5]

type Props = {
  lat: number | null
  lng: number | null
  // 地図をタップした位置を座標にする
  onPick: (lat: number, lng: number) => void
}

// 店舗の位置を確かめる小さな地図。タップでピンを動かして座標を直せる
export default function AdminLocationMap({ lat, lng, onPick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const onPickRef = useRef(onPick)

  useEffect(() => {
    onPickRef.current = onPick
  }, [onPick])

  useEffect(() => {
    if (!containerRef.current) return
    const hasPoint = lat !== null && lng !== null
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: hasPoint ? [lng, lat] : JAPAN_CENTER,
      zoom: hasPoint ? 15 : 4,
      dragRotate: false,
      attributionControl: { compact: true },
    })
    map.touchZoomRotate.disableRotation()
    map.on('click', (e) => onPickRef.current(Number(e.lngLat.lat.toFixed(6)), Number(e.lngLat.lng.toFixed(6))))
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // 地図は開いたときに一度だけ作る（座標の変更は下の effect でピンだけ動かす）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng)) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }
    if (!markerRef.current) markerRef.current = new maplibregl.Marker({ color: '#2563eb' })
    markerRef.current.setLngLat([lng, lat]).addTo(map)
    if (!map.getBounds().contains([lng, lat])) map.easeTo({ center: [lng, lat] })
  }, [lat, lng])

  return <div ref={containerRef} className="w-full h-48 rounded-xl overflow-hidden bg-slate-100 isolate" />
}
