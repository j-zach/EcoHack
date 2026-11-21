"""Extract TESSERA embeddings around the 66 RestREco sites, one tile at a time."""
import shutil
from pathlib import Path

import numpy as np
import pandas as pd
from pyproj import Transformer
from geotessera import GeoTessera

ROOT = Path(__file__).resolve().parents[1]
TILES = ROOT / "data/tessera"
OUT = ROOT / "data/uk_site_embeddings.parquet"
HALF = 50  # 50 px * 10 m = 500 m: coords are rounded to 1 km

sites = pd.read_csv(ROOT / "data/raw/insect-plant-tree-woodland-2021-2022/data/woodland_site_details.csv", encoding="utf-8-sig")
lon, lat = Transformer.from_crs(27700, 4326, always_xy=True).transform(sites.X.values, sites.Y.values)
sites = sites.assign(lon=lon, lat=lat, year=np.where(sites.Region.str.contains("Scot"), 2021, 2022))
sites["tile"] = list(zip(np.floor(sites.lon * 10) / 10 + 0.05, np.floor(sites.lat * 10) / 10 + 0.05))

done = pd.read_parquet(OUT) if OUT.exists() else pd.DataFrame()
gt = GeoTessera(embeddings_dir=TILES)
rows = [done] if len(done) else []

for (year, tile), grp in sites.groupby(["year", "tile"]):
    grp = grp[~grp.Site_code.isin(done.get("Site_code", []))]
    if grp.empty:
        continue
    emb, crs, tr = gt.fetch_embedding(*tile, year)
    to_tile = Transformer.from_crs(4326, crs, always_xy=True)
    for _, s in grp.iterrows():
        x, y = to_tile.transform(s.lon, s.lat)
        c, r = ~tr * (x, y)
        r, c = int(r), int(c)
        win = emb[max(r - HALF, 0): r + HALF, max(c - HALF, 0): c + HALF].reshape(-1, 128)
        win = win[np.isfinite(win).all(1) & (np.abs(win).sum(1) > 0)]
        rows.append(pd.DataFrame([{"Site_code": s.Site_code, "year": year, "n_px": len(win),
                                   **{f"e{i}": v for i, v in enumerate(win.mean(0))},
                                   **{f"s{i}": v for i, v in enumerate(win.std(0))}}]))
    pd.concat(rows).to_parquet(OUT)
    shutil.rmtree(TILES / "global_0.1_degree_representation" / str(year), ignore_errors=True)
    for p in TILES.rglob(f"*{tile[0]:.2f}_{tile[1]:.2f}*"):
        shutil.rmtree(p, ignore_errors=True) if p.is_dir() else p.unlink()
    print(year, tile, len(grp), "sites", flush=True)

print(pd.read_parquet(OUT).shape)
