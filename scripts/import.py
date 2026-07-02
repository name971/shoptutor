"""
shops.json と events_weekly.json を Supabase にインポートするスクリプト

使い方:
  pip install supabase
  python scripts/import.py

事前に .env.local の値を以下の変数に設定してください
"""

import json
import os
from pathlib import Path
from datetime import datetime
from collections import Counter
from supabase import create_client


def load_env_local():
    """.env.local を読み込んで環境変数にセットする（python-dotenv不要の簡易実装）"""
    env_path = Path(__file__).resolve().parent.parent / ".env.local"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


load_env_local()

# -------------------------------------------------------
# 設定（.env.local から読み込み。値は絶対にコミットしないこと）
# -------------------------------------------------------
SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SECRET_KEY"]
SHOPS_JSON    = "shops.json"
EVENTS_JSON   = "events_weekly.json"

# -------------------------------------------------------
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)

def calc_event_stats(shop_id, events):
    """店舗のイベント集計を計算"""
    shop_events = [e for e in events if e["shop_id"] == shop_id]
    fmt_counter = Counter(e["format"] for e in shop_events)
    return {
        "weekly_event_count": len(shop_events),
        "commander_count":    fmt_counter.get("commander", 0),
        "standard_count":     fmt_counter.get("standard", 0),
        "modern_count":       fmt_counter.get("modern", 0),
        "pioneer_count":      fmt_counter.get("pioneer", 0),
        "legacy_count":       fmt_counter.get("legacy", 0),
        "limited_count":      fmt_counter.get("limited", 0),
        "other_count":        fmt_counter.get("other", 0) + fmt_counter.get("unknown", 0) + fmt_counter.get("vintage", 0),
        "events_updated_at":  datetime.utcnow().isoformat(),
    }

def main():
    print("データ読み込み中...")
    shops  = load_json(SHOPS_JSON)
    events = load_json(EVENTS_JSON)
    print(f"店舗数: {len(shops)} / イベント数: {len(events)}")

    # -------------------------------------------------------
    # STEP 1: 店舗データをupsert
    # -------------------------------------------------------
    print("\n=== 既存店舗のfirst_listed_atを取得中 ===")
    existing = supabase.table("shops").select("official_id, first_listed_at").execute()
    existing_first_listed = {s["official_id"]: s["first_listed_at"] for s in existing.data}
    print(f"既存店舗: {len(existing_first_listed)}件")

    print("\n=== 店舗データをインポート中 ===")
    now = datetime.utcnow().isoformat()

    scraped_ids = {s["official_id"] for s in shops}
    shop_rows = []
    for s in shops:
        stats = calc_event_stats(s["official_id"], events)
        # 既存店舗はfirst_listed_atを保持（NEWバッジが再スクレイピングのたびに誤発火しないように）
        first_listed_at = existing_first_listed.get(s["official_id"], now)
        row = {
            "official_id":          s["official_id"],
            "name":                 s.get("name", ""),
            "address":              s.get("address", ""),
            "prefecture":           s.get("prefecture", ""),
            "lat":                  s.get("lat"),
            "lng":                  s.get("lng"),
            "is_wpn_premium":       s.get("is_wpn_premium", False),
            "is_teaching_meister":  s.get("is_teaching_meister", False),
            "status":               "active",
            "first_listed_at":      first_listed_at,
            "last_seen_at":         now,
            "last_scraped_at":      now,
            **stats,
        }
        shop_rows.append(row)

    # 100件ずつ分割してupsert
    batch_size = 100
    for i in range(0, len(shop_rows), batch_size):
        batch = shop_rows[i:i+batch_size]
        res = supabase.table("shops").upsert(batch, on_conflict="official_id").execute()
        print(f"  店舗 {i+1}〜{min(i+batch_size, len(shop_rows))}件 完了")

    print(f"店舗インポート完了: {len(shop_rows)}件")

    # -------------------------------------------------------
    # STEP 1b: 今回のスクレイピングに出てこなかった店舗をinactiveに
    # -------------------------------------------------------
    missing_ids = [oid for oid in existing_first_listed if oid not in scraped_ids]
    if missing_ids:
        print(f"\n=== 今回検出されなかった{len(missing_ids)}店舗をinactiveに更新中 ===")
        for i in range(0, len(missing_ids), batch_size):
            batch = missing_ids[i:i+batch_size]
            supabase.table("shops").update({"status": "inactive"}).in_("official_id", batch).execute()
        print("inactive更新完了")

    # -------------------------------------------------------
    # STEP 2: 店舗IDの対応表を作成（official_id → uuid）
    # -------------------------------------------------------
    print("\n=== 店舗IDマッピング取得中 ===")
    all_shops_db = supabase.table("shops").select("id, official_id").execute()
    id_map = {s["official_id"]: s["id"] for s in all_shops_db.data}
    print(f"マッピング取得: {len(id_map)}件")

    # -------------------------------------------------------
    # STEP 3: 既存イベントを削除して再インポート
    # -------------------------------------------------------
    print("\n=== イベントデータをインポート中 ===")
    supabase.table("events").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    print("既存イベントを削除しました")

    event_rows = []
    for e in events:
        shop_uuid = id_map.get(e["shop_id"])
        if not shop_uuid:
            continue
        event_rows.append({
            "shop_id":    shop_uuid,
            "title":      e.get("title", ""),
            "format":     e.get("format", "other"),
            "format_raw": e.get("format_raw", ""),
            "held_at":    e.get("held_at"),
            "prefecture": e.get("prefecture", ""),
            "scraped_at": now,
        })

    for i in range(0, len(event_rows), batch_size):
        batch = event_rows[i:i+batch_size]
        supabase.table("events").insert(batch).execute()
        print(f"  イベント {i+1}〜{min(i+batch_size, len(event_rows))}件 完了")

    print(f"イベントインポート完了: {len(event_rows)}件")

    # -------------------------------------------------------
    # 完了
    # -------------------------------------------------------
    print("\n=== 完了 ===")
    wpn   = sum(1 for s in shops if s.get("is_wpn_premium"))
    mei   = sum(1 for s in shops if s.get("is_teaching_meister"))
    print(f"店舗数:               {len(shop_rows)}")
    print(f"WPNプレミアム:        {wpn}店舗")
    print(f"ティーチングマイスター: {mei}店舗")
    print(f"イベント数:           {len(event_rows)}")

if __name__ == "__main__":
    main()
