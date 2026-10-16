"""都道府県の塗り分け地図（店舗タブ「エリアから探す」）のSVGパスを作る。

元データ：国土数値情報（行政区域）由来の dataofjapan/land の japan.geojson
  https://github.com/dataofjapan/land
事前に mapshaper で簡略化しておく:
  npx mapshaper japan.geojson -filter-islands min-area=20km2 -simplify 3% keep-shapes \
    -filter-fields nam_ja,id -o format=geojson precision=0.001 pref.json
使い方:
  python3 scripts/build_japan_map.py pref.json > src/components/shop/japanMapPaths.ts

離島（小笠原・奄美など）は省き、沖縄は左上の枠に移して表示する。
"""

import json
import math
import sys

LAT0 = 37.0
KX = math.cos(math.radians(LAT0))
# 本州・四国・九州・北海道の範囲（これより外の島は省く）
MAIN = (128.5, 30.9, 146.0, 45.6)
# 沖縄本島周辺の範囲と、移す先（左上の枠）
OKINAWA = (126.6, 26.0, 128.4, 27.0)
OKINAWA_SHIFT = (5.6, 13.8)  # 経度・緯度を足して左上へ

SCALE = 60  # 1度 ≒ 60単位


def project(lon, lat):
    return (lon * KX * SCALE, -lat * SCALE)


def ring_area(ring):
    a = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        a += x1 * y2 - x2 * y1
    return a / 2


def ring_centroid(ring):
    a = ring_area(ring)
    if a == 0:
        return ring[0]
    cx = cy = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        f = x1 * y2 - x2 * y1
        cx += (x1 + x2) * f
        cy += (y1 + y2) * f
    return (cx / (6 * a), cy / (6 * a))


def inside(box, lon, lat):
    return box[0] <= lon <= box[2] and box[1] <= lat <= box[3]


def main(path):
    data = json.load(open(path, encoding='utf-8'))
    prefs = []
    for f in data['features']:
        name = f['properties']['nam_ja']
        pid = f['properties']['id']
        g = f['geometry']
        polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        kept = []
        for poly in polys:
            lon, lat = poly[0][0]
            if name == '沖縄県':
                if not inside(OKINAWA, lon, lat):
                    continue
                poly = [[(x + OKINAWA_SHIFT[0], y + OKINAWA_SHIFT[1]) for x, y in r] for r in poly]
            elif not inside(MAIN, lon, lat):
                continue
            kept.append([[project(x, y) for x, y in r] for r in poly])
        prefs.append((pid, name, kept))

    xs = [x for _, _, ps in prefs for p in ps for r in p for x, _ in r]
    ys = [y for _, _, ps in prefs for p in ps for r in p for _, y in r]
    minx, miny = min(xs), min(ys)
    pad = 6

    def fmt(v):
        return str(round(v, 1)).rstrip('0').rstrip('.')

    out = []
    for pid, name, polys in sorted(prefs):
        d = []
        best = None
        for p in polys:
            for i, r in enumerate(p):
                pts = [(x - minx + pad, y - miny + pad) for x, y in r]
                d.append('M' + 'L'.join(f'{fmt(x)} {fmt(y)}' for x, y in pts) + 'Z')
                if i == 0:
                    a = abs(ring_area(pts))
                    if best is None or a > best[0]:
                        best = (a, ring_centroid(pts))
        area = sum(abs(ring_area([(x, y) for x, y in p[0]])) for p in polys)
        cx, cy = best[1]
        out.append(
            f"  {{ id: {pid}, name: '{name}', d: '{''.join(d)}', cx: {fmt(cx)}, cy: {fmt(cy)}, area: {round(area)} }},"
        )

    w = max(xs) - minx + pad * 2
    h = max(ys) - miny + pad * 2
    # 沖縄の枠（移した先の範囲）
    ox0, oy0 = project(OKINAWA[0] + OKINAWA_SHIFT[0], OKINAWA[3] + OKINAWA_SHIFT[1])
    ox1, oy1 = project(OKINAWA[2] + OKINAWA_SHIFT[0], OKINAWA[1] + OKINAWA_SHIFT[1])
    print('// scripts/build_japan_map.py で生成（手で編集しない）。出典：国土数値情報（行政区域データ）を加工')
    print(f'export const JAPAN_VIEWBOX = {{ width: {fmt(w)}, height: {fmt(h)} }}')
    print(
        f'export const OKINAWA_INSET = {{ x: {fmt(ox0 - minx + pad - 4)}, y: {fmt(oy0 - miny + pad - 4)}, '
        f'width: {fmt(ox1 - ox0 + 8)}, height: {fmt(oy1 - oy0 + 8)} }}'
    )
    print('export const PREFECTURE_SHAPES: { id: number; name: string; d: string; cx: number; cy: number; area: number }[] = [')
    print('\n'.join(out))
    print(']')


if __name__ == '__main__':
    main(sys.argv[1])
