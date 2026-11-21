"""TESSERA embeddings at GSSP sites it covers, for a head-to-head with AlphaEarth. One tile at a time, deleted after use."""
import shutil
from pathlib import Path

import numpy as np
import pandas as pd
from geotessera import GeoTessera
from pyproj import Transformer

from gssp_benchmark import DATA, HALF, labels

TILES = DATA / "tessera"
OUT = DATA / "gssp/tessera.parquet"
tile = lambda v: round(float(np.floor(v * 10) / 10 + 0.05), 2)


def main():
    ev = labels()
    sites = ev.groupby("site").agg(lat=("lat", "first"), lon=("lon", "first"), year=("year", lambda y: y.mode()[0]))
    gt = GeoTessera(embeddings_dir=TILES)
    reg = gt.registry._registry_gdf.reset_index()
    have = set(zip(reg.year, reg.lon.round(2), reg.lat.round(2)))
    rows = {}
    for site, s in sites.iterrows():
        key = (s.year, tile(s.lon), tile(s.lat))
        if key not in have:
            continue
        emb, crs, tr = gt.fetch_embedding(key[1], key[2], int(s.year))
        x, y = Transformer.from_crs(4326, crs, always_xy=True).transform(s.lon, s.lat)
        c, r = ~tr * (x, y)
        win = emb[max(int(r) - HALF, 0): int(r) + HALF, max(int(c) - HALF, 0): int(c) + HALF].reshape(-1, 128)
        win = win[np.isfinite(win).all(1) & (np.abs(win).sum(1) > 0)]
        if len(win) >= 100:
            rows[site] = win.mean(0)
        for p in TILES.rglob(f"*{key[1]:.2f}_{key[2]:.2f}*"):
            shutil.rmtree(p, ignore_errors=True) if p.is_dir() else p.unlink()
        print(site, len(win), flush=True)
    pd.DataFrame.from_dict(rows, orient="index", columns=[f"t{i}" for i in range(128)]).to_parquet(OUT)
    print(len(rows), "sites")


if __name__ == "__main__":
    main()
