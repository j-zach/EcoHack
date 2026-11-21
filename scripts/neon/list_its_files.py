"""List NEON DP1.10081.002 per-sample ITS tables for every site-month.

Usage: python3 -I list_its_files.py OUT_JSON
Writes a list of {site, month, name, size, url} for the *_ITS_map.csv files
(expanded package) and prints totals by year. Downloads nothing else.
"""
import collections
import json
import sys
from concurrent.futures import ThreadPoolExecutor

from neon_api import get_json

PRODUCT = "DP1.10081.002"


def site_months():
    prod = get_json(f"products/{PRODUCT}")
    return [(s["siteCode"], m) for s in prod["siteCodes"] for m in s["availableMonths"]]


def its_files(site_month):
    site, month = site_month
    d = get_json(f"data/{PRODUCT}/{site}/{month}?package=expanded")
    return [
        {"site": site, "month": month, "name": f["name"], "size": int(f["size"]), "url": f["url"]}
        for f in d["files"]
        if f["name"].endswith("_ITS_map.csv")
    ]


def main(out):
    sms = site_months()
    with ThreadPoolExecutor(8) as ex:
        rows = [r for chunk in ex.map(its_files, sms) for r in chunk]
    json.dump(rows, open(out, "w"))
    by_year = collections.defaultdict(lambda: [0, 0])
    for r in rows:
        y = r["month"][:4]
        by_year[y][0] += 1
        by_year[y][1] += r["size"]
    print(f"site-months: {len(sms)}  ITS sample files: {len(rows)}  total: {sum(r['size'] for r in rows)/1e9:.2f} GB")
    for y in sorted(by_year):
        n, b = by_year[y]
        print(f"  {y}: {n:5d} files  {b/1e6:8.0f} MB")


if __name__ == "__main__":
    main(sys.argv[1])
