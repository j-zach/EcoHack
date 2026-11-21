"""Step 3: Tessera 2023 embeddings at FE samples with their own (unflagged) coordinates.

For each sample: the 10 m pixel containing it and the mean of the 3x3 window (30 m).
Tiles are fetched one at a time (fetch_embedding streams to memory, ~1 GB RAM per tile).
Needs SSL_CERT_FILE set to certifi's bundle on python.org macOS builds (see run_all.sh).
Output: out/tessera_2023.parquet (sample, tile, row, col, px_0..127, w3_0..127).
"""
import math

import numpy as np
import pandas as pd
from geotessera import GeoTessera
from pyproj import Transformer

from common import OUT, ROOT

YEAR = 2023


def main():
    m = pd.read_csv(OUT / "master.csv")
    pts = m[(m.coord_source == "sample") & (~m.gps_flagged)].copy()
    pts["tile"] = [(math.floor(lo * 10), math.floor(la * 10)) for la, lo in zip(pts.lat, pts.lon)]
    gt = GeoTessera(dataset_variant="cambridge", cache_dir=ROOT / "tessera_cache")
    rows = []
    tiles = sorted(pts.tile.unique())
    for i, t in enumerate(tiles, 1):
        grp = pts[pts.tile == t]
        r0 = grp.iloc[0]
        emb, crs, tr = gt.fetch_embedding(r0.lon, r0.lat, YEAR)
        to_crs = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
        H, W, _ = emb.shape
        for r in grp.itertuples():
            x, y = to_crs.transform(r.lon, r.lat)
            col, row = (~tr) * (x, y)
            row, col = int(math.floor(row)), int(math.floor(col))
            if not (0 <= row < H and 0 <= col < W):
                print(f"  outside tile: {r.sample}")
                continue
            px = emb[row, col]
            win = emb[max(row - 1, 0):row + 2, max(col - 1, 0):col + 2].reshape(-1, emb.shape[2])
            win = win[np.abs(win).sum(1) > 0]          # drop no-data (all-zero) pixels
            if not np.abs(px).sum() > 0 or len(win) == 0:
                print(f"  no data at: {r.sample}")
                continue
            rows.append({"sample": r.sample, "tile": str(t), "row": row, "col": col,
                         "n_window_px": len(win),
                         **{f"px_{k}": v for k, v in enumerate(px)},
                         **{f"w3_{k}": v for k, v in enumerate(win.mean(0))}})
        print(f"tile {i}/{len(tiles)} {t}: {len(grp)} samples", flush=True)
        del emb
    df = pd.DataFrame(rows)
    df.to_parquet(OUT / "tessera_2023.parquet", index=False)
    print(f"embedded {len(df)}/{len(pts)} samples")


if __name__ == "__main__":
    main()
