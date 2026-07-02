"""
MTG公認店舗 週次スクレイピング
- 店舗一覧から: 店舗名・住所・緯度経度・WPNプレミアム・ティーチングマイスター
- イベントページから: 1週間以内のイベント（フォーマット・日時）

画像srcによる判定:
  icon-store-meister-level.png → WPNプレミアム✅ ティーチングマイスター✅
  icon-store-level-lead.png   → WPNプレミアム✅ ティーチングマイスターなし
  icon-store-meister.png      → WPNプレミアムなし ティーチングマイスター✅
  画像なし                    → どちらもなし

使い方:
  pip install -r scripts/requirements.txt
  python scripts/scrape.py

出力（リポジトリルートに書き出し）:
  shops.json         - 店舗マスタ（WPN・ティーチングマイスター含む）
  events_weekly.json - 1週間以内のイベント一覧
"""

import requests
from bs4 import BeautifulSoup
import time
import random
import json
import re
from pathlib import Path
from datetime import datetime, timedelta
from collections import Counter

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
    "Referer": "https://mtg-jp.com/",
}

BASE_URL = "https://mtg-jp.com"
ROOT_DIR = Path(__file__).resolve().parent.parent

FORMAT_MAP = {
    "スタンダード": "standard",
    "パイオニア": "pioneer",
    "モダン": "modern",
    "レガシー": "legacy",
    "コマンダー": "commander",
    "統率者": "commander",
    "リミテッド": "limited",
    "ドラフト": "limited",
    "シールド": "limited",
    "その他": "other",
    "ヴィンテージ": "vintage",
}

session = requests.Session()
session.headers.update(HEADERS)

TODAY = datetime.today().date()
DEADLINE = TODAY + timedelta(days=7)

def wait():
    t = random.uniform(1.0, 2.5)
    time.sleep(t)

def fetch(url, retries=3):
    for i in range(retries):
        try:
            r = session.get(url, timeout=15)
            if r.status_code == 200:
                return r
            elif r.status_code == 429:
                print(f"  レート制限。60秒待機...")
                time.sleep(60)
            else:
                print(f"  エラー {r.status_code}")
        except Exception as e:
            print(f"  例外: {e}")
        time.sleep(5 * (i + 1))
    return None

def normalize_format(text):
    for jp, en in FORMAT_MAP.items():
        if jp in text:
            return en
    return "unknown"

def parse_date(text):
    m = re.search(r'(\d{4})\.(\d{1,2})\.(\d{1,2})', text)
    if m:
        y, mo, d = m.groups()
        try:
            return datetime(int(y), int(mo), int(d)).date()
        except:
            return None
    return None

def parse_latlng(href):
    """Google MapsのURLから緯度経度を抽出"""
    m = re.search(r'q=([\d.]+),([\d.]+)', href)
    if m:
        return float(m.group(1)), float(m.group(2))
    return None, None

def parse_wpn_badges(td):
    """td-store-levelの画像からWPN・ティーチングマイスターを判定"""
    if not td:
        return False, False

    srcs = [img.get("src", "") for img in td.find_all("img")]
    has_wpn_premium = any("level-lead" in s or "meister-level" in s for s in srcs)
    has_teaching = any("meister" in s for s in srcs)  # meister-level も meister も含む
    return has_wpn_premium, has_teaching

def get_next_p(soup, current_p):
    pager = soup.find(class_="pager-list")
    if not pager:
        return None
    p_values = []
    for a in pager.find_all("a", href=True):
        m = re.search(r'[?&]p=(\d+)', a["href"])
        if m:
            p_values.append(int(m.group(1)))
    next_p = current_p + 20
    return next_p if next_p in p_values else None

# -------------------------------------------------------
# STEP 1: 店舗一覧から全店舗情報を取得
# -------------------------------------------------------
def get_all_shops():
    print("=== 店舗一覧を取得中 ===")
    shops = {}  # official_id -> shop_dict
    page = 0

    while True:
        url = f"{BASE_URL}/shop/?p={page}&pref=&freeword=&startDate=&endDate="
        print(f"  ページ {page//20 + 1}...")
        r = fetch(url)
        if not r:
            break

        soup = BeautifulSoup(r.text, "html.parser")
        table = soup.find(class_="shop-list-table")
        if not table:
            break

        found = 0
        for row in table.find_all("tr"):
            # 店舗名・shop_id
            name_td = row.find("td", class_="td-store-name")
            if not name_td:
                continue

            # shop_idはイベントページリンクから
            shop_id = None
            detail_td = row.find("td", class_="td-date")  # 店舗詳細リンク列
            if detail_td:
                a = detail_td.find("a", href=True)
                if a:
                    m = re.search(r'/events/shop/(\d+)/', a["href"])
                    if m:
                        shop_id = m.group(1)

            if not shop_id or shop_id in shops:
                continue

            # 店舗名・住所
            dt = name_td.find("dt")
            dd = name_td.find("dd", class_="address")
            name = dt.get_text().strip() if dt else ""
            address = dd.get_text().strip() if dd else ""

            # 都道府県
            pref_td = row.find("td", class_="td-prefecture")
            prefecture = pref_td.get_text().strip() if pref_td else ""

            # 緯度経度（Google Mapsリンクから）
            map_td = row.find("td", class_="td-store-map")
            lat, lng = None, None
            if map_td:
                a = map_td.find("a", href=True)
                if a:
                    lat, lng = parse_latlng(a["href"])

            # WPN・ティーチングマイスター
            level_td = row.find("td", class_="td-store-level")
            is_wpn_premium, is_teaching_meister = parse_wpn_badges(level_td)

            shops[shop_id] = {
                "official_id": shop_id,
                "name": name,
                "address": address,
                "prefecture": prefecture,
                "lat": lat,
                "lng": lng,
                "is_wpn_premium": is_wpn_premium,
                "is_teaching_meister": is_teaching_meister,
                "status": "active",
            }
            found += 1

        if not found:
            break

        print(f"  {found}件取得（累計 {len(shops)}件）")

        next_p = page + 20
        has_next = any(
            f"?p={next_p}" in a.get("href", "") or f"?p={next_p}&" in a.get("href", "")
            for a in soup.find_all("a", href=True)
        )
        if not has_next:
            break

        page += 20
        wait()

    return shops

# -------------------------------------------------------
# STEP 2: 各店舗のイベント取得
# -------------------------------------------------------
def scrape_shop_events(shop_id, shop_name):
    events = []
    p = 0

    while True:
        url = f"{BASE_URL}/events/shop/{shop_id}/" if p == 0 else \
              f"{BASE_URL}/events/shop/{shop_id}/?p={p}&fmt=&freeword=&startDate=&endDate=#searchBlock"

        r = fetch(url)
        if not r:
            break

        soup = BeautifulSoup(r.text, "html.parser")
        tables = soup.find_all("table")
        if len(tables) < 2:
            break

        rows = tables[1].find_all("tr")
        page_event_count = 0
        exceeded_deadline = False

        for row in rows:
            date_td = row.find("td", class_="td-date")
            if not date_td:
                continue

            date = parse_date(date_td.get_text(separator=' ').strip())
            if date is None:
                continue

            page_event_count += 1

            if date > DEADLINE:
                exceeded_deadline = True
                break

            format_td = row.find("td", class_="td-format")
            info_td = row.find("td", class_="td-info")
            pref_td = row.find("td", class_="td-prefecture")

            format_text = format_td.get_text().strip() if format_td else ""
            event_title = info_td.get_text().strip() if info_td else ""

            events.append({
                "shop_id": shop_id,
                "title": event_title,
                "format_raw": format_text,
                "format": normalize_format(format_text + " " + event_title),
                "held_at": str(date),
                "prefecture": pref_td.get_text().strip() if pref_td else "",
            })

        if exceeded_deadline or page_event_count == 0:
            break

        next_p = get_next_p(soup, p)
        if next_p is None:
            break

        p = next_p
        wait()

    return events

# -------------------------------------------------------
# MAIN
# -------------------------------------------------------
def main():
    # STEP 1: 店舗一覧
    shops = get_all_shops()
    print(f"\n合計 {len(shops)} 店舗取得\n")

    wpn_count = sum(1 for s in shops.values() if s["is_wpn_premium"])
    meister_count = sum(1 for s in shops.values() if s["is_teaching_meister"])
    print(f"WPNプレミアム: {wpn_count}店舗")
    print(f"ティーチングマイスター: {meister_count}店舗\n")

    # STEP 2: イベント取得
    print(f"=== イベント取得開始（{TODAY} 〜 {DEADLINE}）===")
    all_events = []
    shop_list = list(shops.values())

    for i, shop in enumerate(shop_list):
        shop_id = shop["official_id"]
        shop_name = shop["name"]
        print(f"[{i+1}/{len(shop_list)}] {shop_name}", end=" ", flush=True)

        events = scrape_shop_events(shop_id, shop_name)
        all_events.extend(events)
        print(f"→ {len(events)}件")

        wait()

        if (i + 1) % 20 == 0:
            with open(ROOT_DIR / "events_weekly_tmp.json", "w", encoding="utf-8") as f:
                json.dump(all_events, f, ensure_ascii=False, indent=2)
            with open(ROOT_DIR / "shops_tmp.json", "w", encoding="utf-8") as f:
                json.dump(shop_list, f, ensure_ascii=False, indent=2)
            print(f"  >>> 中間保存: イベント{len(all_events)}件")

    # 最終保存
    with open(ROOT_DIR / "shops.json", "w", encoding="utf-8") as f:
        json.dump(shop_list, f, ensure_ascii=False, indent=2)
    with open(ROOT_DIR / "events_weekly.json", "w", encoding="utf-8") as f:
        json.dump(all_events, f, ensure_ascii=False, indent=2)

    # 中間ファイルは不要なので削除
    (ROOT_DIR / "events_weekly_tmp.json").unlink(missing_ok=True)
    (ROOT_DIR / "shops_tmp.json").unlink(missing_ok=True)

    print(f"\n=== 完了 ===")
    print(f"店舗数: {len(shop_list)}")
    print(f"  WPNプレミアム: {wpn_count}店舗")
    print(f"  ティーチングマイスター: {meister_count}店舗")
    print(f"総イベント数: {len(all_events)}")
    print(f"今週イベントあり: {len(set(e['shop_id'] for e in all_events))}店舗")

    date_count = Counter(e["held_at"] for e in all_events)
    print(f"\n日付別:")
    for d in sorted(date_count.keys()):
        print(f"  {d}: {date_count[d]}件")

    fmt_count = Counter(e["format"] for e in all_events)
    print(f"\nフォーマット別:")
    for fmt, cnt in sorted(fmt_count.items(), key=lambda x: -x[1]):
        print(f"  {fmt}: {cnt}件")

    unknown = [e for e in all_events if e["format"] == "unknown"]
    if unknown:
        print(f"\nunknownのformat_raw（上位10件）:")
        unknown_raws = Counter(e["format_raw"] for e in unknown)
        for raw, cnt in unknown_raws.most_common(10):
            print(f"  '{raw}': {cnt}件")

if __name__ == "__main__":
    main()
