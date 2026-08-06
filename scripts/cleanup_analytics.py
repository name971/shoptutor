"""
訪問者分析用テーブル（shop_view_stats・shop_view_formats）の古いデータを削除するスクリプト

オーナー分析画面（/owner）は直近30日分しか参照しないため、それより古い行は
テーブルに溜まり続けるだけの不要データ。バッファを持たせて35日より前を削除する。

使い方:
  python scripts/cleanup_analytics.py

事前に .env.local の値を以下の変数に設定してください
"""

import os
from pathlib import Path
from datetime import date, timedelta
from supabase import create_client

RETENTION_DAYS = 35


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

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SECRET_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def main():
    cutoff = (date.today() - timedelta(days=RETENTION_DAYS)).isoformat()
    print(f"=== {cutoff} より前の訪問者分析データを削除 ===")

    stats_res = supabase.table("shop_view_stats").delete().lt("view_date", cutoff).execute()
    print(f"shop_view_stats: {len(stats_res.data)}件削除")

    formats_res = supabase.table("shop_view_formats").delete().lt("view_date", cutoff).execute()
    print(f"shop_view_formats: {len(formats_res.data)}件削除")


if __name__ == "__main__":
    main()
