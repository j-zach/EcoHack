"""Export real model outputs for the demo frontend (demo/data/demo_data.js).

Everything the demo shows comes from here:
  * per-sample leave-one-site-out (LOSO) predictions of EcM richness (Tessera 3x3 features),
    i.e. each sample is predicted by a model that never saw its site
  * per-site held-out accuracy, and the global random vs LOSO vs habitat-only R2
  * a wall-to-wall 10 m prediction map for one held-out demo site (model trained on the other 20)
  * suggested validation plots: spread across the predicted range, >=250 m from existing samples

Writes JavaScript (window.DEMO = {...}) so the page opens from file:// without a server.
Usage: python export_demo_data.py [--site Neroche] [--out ../../demo/data/demo_data.js]
"""
import argparse
import json
import math

import numpy as np
import pandas as pd
from geotessera import GeoTessera
from pyproj import Transformer
from scipy.ndimage import uniform_filter
from scipy.stats import spearmanr
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.model_selection import KFold, LeaveOneGroupOut, cross_val_predict

from common import OUT, ROOT

YEAR = 2023
MAX_PX = 600_000


def model():
    return HistGradientBoostingRegressor(random_state=0)


def km(lat0, lon0, lat, lon):
    return 6371 * np.hypot(np.radians(lat - lat0), np.radians(lon - lon0) * np.cos(np.radians(lat0)))


def utm_crop(gt, s, pad_m=1200):
    """Crop the Tessera tiles around a site's samples in their native UTM grid, in memory.
    (fetch_mosaic_for_region writes full-tile GeoTIFFs to temp, ~GBs of disk.)
    Returns (H, W, 128) array and its lat/lon bounds (west, south, east, north).
    UTM grid north is within ~0.1 deg of true north near the zone's central meridian,
    so a lat/lon image overlay of the crop is accurate to a pixel or two at site scale."""
    tiles = sorted({(math.floor(lo * 10), math.floor(la * 10)) for la, lo in zip(s.lat, s.lon)})
    crs = None
    for i, (tx, ty) in enumerate(tiles):
        emb, tcrs, tr = gt.fetch_embedding((tx + 0.5) / 10, (ty + 0.5) / 10, YEAR)
        if crs is None:
            crs = tcrs
            fwd = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
            xs, ys = fwd.transform(s.lon.values, s.lat.values)
            # snap the crop to the tile's 10 m pixel grid so crop pixels == tile pixels
            x0 = tr.c + 10 * math.floor((xs.min() - pad_m - tr.c) / 10)
            y1 = tr.f - 10 * math.floor((tr.f - (ys.max() + pad_m)) / 10)
            x1, y0 = xs.max() + pad_m, ys.min() - pad_m
            W, H = int((x1 - x0) // 10), int((y1 - y0) // 10)
            out = np.zeros((H, W, emb.shape[2]), dtype="float32")
        elif tcrs != crs:
            raise RuntimeError(f"site spans UTM zones {crs} / {tcrs}; not handled")
        # tile pixel (r, c) -> crop pixel (r + dr, c + dc)
        dc = int(round((tr.c - x0) / 10))
        dr = int(round((y1 - tr.f) / 10))
        r0, c0 = max(0, dr), max(0, dc)
        r1, c1 = min(H, dr + emb.shape[0]), min(W, dc + emb.shape[1])
        if r1 > r0 and c1 > c0:
            blk = emb[r0 - dr:r1 - dr, c0 - dc:c1 - dc]
            mask = np.abs(blk).sum(2) > 0
            out[r0:r1, c0:c1][mask] = blk[mask]
        del emb
    inv = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
    west, south = inv.transform(x0, y0)
    east, north = inv.transform(x0 + W * 10, y1)
    return out, (west, south, east, north)


def site_map(d, feats, site, gt):
    train = d[d.site != site]
    mdl = model().fit(train[feats].values, train.ecm_richness.values)
    s = d[d.site == site]
    mosaic, (west, south, east, north) = utm_crop(gt, s)
    H, W, B = mosaic.shape
    valid = np.abs(mosaic).sum(2) > 0
    # 3x3 window mean over valid pixels only (same feature definition as training)
    cnt = uniform_filter(valid.astype("float32"), size=3, mode="nearest")
    win = np.empty_like(mosaic)
    for b in range(B):
        win[..., b] = uniform_filter(np.where(valid, mosaic[..., b], 0), size=3, mode="nearest")
    win /= np.maximum(cnt, 1e-6)[..., None]
    pred = np.full((H, W), np.nan, dtype="float32")
    pred[valid] = np.clip(mdl.predict(win[valid]), 0, None)
    step = max(1, math.ceil(math.sqrt(H * W / MAX_PX)))
    pred = pred[::step, ::step]
    h, w = pred.shape
    # suggested validation plots across low / mid / high predictions, away from existing samples
    lats = north + (np.arange(h) + 0.5) * (south - north) / h
    lons = west + (np.arange(w) + 0.5) * (east - west) / w
    rng = np.random.default_rng(0)
    vals = pred[np.isfinite(pred)]
    q = np.nanquantile(vals, [0.15, 0.5, 0.85])
    picks = []
    for label, target in zip(["low", "mid", "high"], q):
        rr, cc = np.where(np.isfinite(pred) & (np.abs(pred - target) < 0.75))
        for i in rng.permutation(len(rr)):
            la, lo = lats[rr[i]], lons[cc[i]]
            if km(la, lo, s.lat.values, s.lon.values).min() < 0.25:
                continue
            if any(km(la, lo, p["lat"], p["lon"]) < 0.4 for p in picks):
                continue
            picks.append({"lat": round(float(la), 6), "lon": round(float(lo), 6),
                          "band": label, "pred": round(float(pred[rr[i], cc[i]]), 1)})
            if sum(p["band"] == label for p in picks) == 2:
                break
    return {
        "site": site, "width": w, "height": h, "pixel_m": round(10 * step),
        "bounds": [[south, west], [north, east]],
        "values": [None if not np.isfinite(v) else round(float(v), 1) for v in pred.ravel()],
        "vmax": round(float(np.nanquantile(vals, 0.99)), 1),
        "suggested": picks, "n_train_sites": int(train.site.nunique()), "n_train": len(train),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", default="Neroche")
    ap.add_argument("--out", default=str(ROOT.parent.parent / "demo" / "data" / "demo_data.js"))
    a = ap.parse_args()

    m = pd.read_csv(OUT / "master.csv")
    d = m.merge(pd.read_parquet(OUT / "tessera_2023.parquet"), on="sample")
    feats = [c for c in d if c.startswith("w3_")]
    X, y = d[feats].values, d.ecm_richness.values
    d["pred_loso"] = cross_val_predict(model(), X, y, cv=LeaveOneGroupOut(), groups=d.site.values)
    d["pred_random"] = cross_val_predict(model(), X, y, cv=KFold(5, shuffle=True, random_state=0))

    sites = []
    for site, s in d.groupby("site"):
        rho = spearmanr(s.ecm_richness, s.pred_loso).statistic
        sites.append({
            "site": site, "n": len(s), "n_woodland": int((s.habitat == "woodland").sum()),
            "lat": round(s.lat.median(), 5), "lon": round(s.lon.median(), 5),
            "obs_mean": round(s.ecm_richness.mean(), 2), "pred_mean": round(s.pred_loso.mean(), 2),
            "mae": round((s.pred_loso - s.ecm_richness).abs().mean(), 2),
            "rho": None if not np.isfinite(rho) else round(float(rho), 2),
        })
    res = pd.read_csv(OUT / "model_results.csv")
    metrics = res[res.target == "ecm_richness"].to_dict("records")
    samples = d[["sample", "site", "lat", "lon", "habitat", "ecm_richness",
                 "pred_loso", "pred_random"]].round({"pred_loso": 1, "pred_random": 1}).to_dict("records")

    gt = GeoTessera(dataset_variant="cambridge", cache_dir=ROOT / "tessera_cache")
    demo = {
        "generated": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M"),
        "target": "EcM richness (number of ectomycorrhizal OTUs per soil sample)",
        "sources": {
            "soil": "Forestry England 2023 soil eDNA, EIDC doi:10.5285/07c32201-c374-4432-a00b-832dedee571e "
                    "(OGL v3; contains data supplied by UK Centre for Ecology & Hydrology)",
            "guilds": "FungalTraits (Polme et al. 2020, Fungal Diversity)",
            "satellite": "Tessera v1.1 2023 embeddings (10 m)",
        },
        "metrics": metrics, "sites": sites, "samples": samples,
        "site_map": site_map(d, feats, a.site, gt),
    }
    from pathlib import Path
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("window.DEMO = " + json.dumps(demo, separators=(",", ":"), allow_nan=False) + ";\n")
    sm = demo["site_map"]
    print(f"wrote {out} ({out.stat().st_size/1e6:.1f} MB); map {sm['width']}x{sm['height']} "
          f"@ {sm['pixel_m']} m; suggested plots: {len(sm['suggested'])}")


if __name__ == "__main__":
    main()
