"""
GitHub Actions実行環境からmtg-jp.comへのアクセスが正常か診断する一時スクリプト。
用済みになったら削除する。
"""

import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
    "Referer": "https://mtg-jp.com/",
}
session = requests.Session()
session.headers.update(HEADERS)


def inspect(url):
    print(f"=== {url} ===")
    r = session.get(url, timeout=15)
    print("status:", r.status_code)
    print("length:", len(r.content))
    print("headers:", dict(r.headers))
    soup = BeautifulSoup(r.text, "html.parser")
    print("title:", soup.title.get_text() if soup.title else None)
    tables = soup.find_all("table")
    print("num tables:", len(tables))
    print("has shop-list-table:", bool(soup.find(class_="shop-list-table")))
    print("has td-date:", bool(soup.find(class_="td-date")))
    print("first 500 chars (repr):")
    print(repr(r.text[:500]))
    print()


inspect("https://mtg-jp.com/shop/?p=0&pref=&freeword=&startDate=&endDate=")
inspect("https://mtg-jp.com/events/shop/0014168/")
