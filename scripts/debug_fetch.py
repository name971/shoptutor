"""
GitHub Actions実行環境からmtg-jp.comへのアクセスが正常か診断する一時スクリプト。
実際のscrape.pyと同じリクエスト量（店舗一覧29ページ）を先に発行してから、
問題の店舗のイベントページを取得してパース過程を詳細出力する。
用済みになったら削除する。
"""

import re
import time
import random
from datetime import datetime, timedelta

import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
    "Referer": "https://mtg-jp.com/",
}
BASE_URL = "https://mtg-jp.com"
TODAY = datetime.today().date()
DEADLINE = TODAY + timedelta(days=7)

session = requests.Session()
session.headers.update(HEADERS)


def wait():
    time.sleep(random.uniform(1.0, 2.5))


def parse_date(text):
    m = re.search(r'(\d{4})\.(\d{1,2})\.(\d{1,2})', text)
    if m:
        y, mo, d = m.groups()
        try:
            return datetime(int(y), int(mo), int(d)).date()
        except Exception:
            return None
    return None


print(f"TODAY={TODAY} DEADLINE={DEADLINE}")
print("=== 店舗一覧を29ページ分先に取得（実際のscrape.pyと同じ負荷を再現） ===")
page = 0
while page < 560:
    url = f"{BASE_URL}/shop/?p={page}&pref=&freeword=&startDate=&endDate="
    r = session.get(url, timeout=15)
    print(f"  p={page} status={r.status_code} len={len(r.content)}")
    page += 20
    wait()

print("\n=== 対象店舗のイベントページを取得 ===")
shop_id = "0014168"
url = f"{BASE_URL}/events/shop/{shop_id}/"
r = session.get(url, timeout=15)
print("status:", r.status_code)
print("length:", len(r.content))

soup = BeautifulSoup(r.text, "html.parser")
print("title:", soup.title.get_text() if soup.title else None)
tables = soup.find_all("table")
print("num tables:", len(tables))

if len(tables) >= 2:
    rows = tables[1].find_all("tr")
    print("rows in tables[1]:", len(rows))
    for i, row in enumerate(rows):
        date_td = row.find("td", class_="td-date")
        if not date_td:
            print(f"  row[{i}]: no td-date")
            continue
        raw = date_td.get_text().strip()
        parsed = parse_date(raw)
        print(f"  row[{i}]: raw_date={raw!r} parsed={parsed} > DEADLINE? {parsed > DEADLINE if parsed else 'N/A'}")
else:
    print("tables[1] does not exist")
    print("first 1000 chars:")
    print(repr(r.text[:1000]))
