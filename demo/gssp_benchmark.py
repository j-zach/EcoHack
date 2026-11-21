"""Real-data benchmark on airborne fungal DNA (Global Spore Sampling Project, 47 sites, 2018 to 2021).

Where: does a 10 m satellite embedding (AlphaEarth, global; TESSERA where covered) predict a site's
airborne fungal richness beyond latitude, terrain and SoilGrids soil? SPUN's 1 km map joins as a
baseline when its GeoTIFFs are in data/spun/.
When: how much of the variation in weekly samples is within-site, which an annual embedding cannot see?
"""
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import pandas as pd
import rasterio
from pyproj import Transformer
from rasterio.windows import Window
from sklearn.compose import ColumnTransformer
from sklearn.decomposition import PCA
from sklearn.linear_model import RidgeCV
from sklearn.model_selection import LeaveOneOut, cross_val_predict
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
DATA, OUT = ROOT / "data", ROOT / "demo/out"
GCS = "https://storage.googleapis.com/"
SOIL = ["phh2o", "soc", "clay", "sand", "nitrogen", "cec"]
HALF = 50  # 50 px = 500 m: airborne spores integrate the surrounding landscape
ENV = dict(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_MAX_RETRY="4", GDAL_HTTP_RETRY_DELAY="2")


def labels():
    o = pd.read_csv(DATA / "gssp/occurrence.txt", sep="\t", low_memory=False)
    o = o[o.kingdom == "Fungi"]
    ev = o.groupby("eventID").agg(site=("locationID", "first"), date=("eventDate", "first"),
                                  lat=("decimalLatitude", "first"), lon=("decimalLongitude", "first"),
                                  richness=("scientificName", "nunique"))
    ev["year"] = ev.date.str[:4].astype(int)
    ev["doy"] = pd.to_datetime(ev.date).dt.dayofyear
    return ev


def read_window(url, lon, lat, half=HALF):
    with rasterio.Env(**ENV), rasterio.open(url) as src:
        x, y = Transformer.from_crs(4326, src.crs, always_xy=True).transform(lon, lat)
        r, c = src.index(x, y)
        return src.read(window=Window(c - half, r - half, 2 * half, 2 * half), boundless=True, fill_value=src.nodata)


def alphaearth(sites, idx):
    def one(s):
        t = idx[(idx.year == s.year) & (idx.wgs84_west <= s.lon) & (idx.wgs84_east >= s.lon)
                & (idx.wgs84_south <= s.lat) & (idx.wgs84_north >= s.lat)]
        if t.empty:
            return None
        a = read_window("/vsicurl/" + t.path.iloc[0].replace("gs://", GCS), s.lon, s.lat).astype(np.float32)
        ok = (a != -128).all(0)
        if ok.sum() < 100:
            return None
        v = ((a / 127.5) ** 2 * np.sign(a))[:, ok].sum(1)
        return v / np.linalg.norm(v)
    with ThreadPoolExecutor(8) as ex:
        vecs = list(ex.map(one, [s for _, s in sites.iterrows()]))
    return pd.DataFrame([v if v is not None else [np.nan] * 64 for v in vecs], index=sites.index, columns=[f"a{i}" for i in range(64)])


def soilgrids(sites):
    out = {}
    for p in SOIL:
        url = f"/vsicurl/https://files.isric.org/soilgrids/latest/data/{p}/{p}_0-5cm_mean.vrt"
        with rasterio.Env(**ENV), rasterio.open(url) as src:
            xs, ys = Transformer.from_crs(4326, src.crs, always_xy=True).transform(sites.lon.values, sites.lat.values)
            vals = np.array([v[0] for v in src.sample(zip(xs, ys))], float)
            out[p] = np.where(vals == src.nodata, np.nan, vals)
    return pd.DataFrame(out, index=sites.index)


def elevation(sites):
    def one(s):
        ns, ew = ("N" if s.lat >= 0 else "S"), ("E" if s.lon >= 0 else "W")
        n = f"Copernicus_DSM_COG_10_{ns}{abs(int(np.floor(s.lat))):02d}_00_{ew}{abs(int(np.floor(s.lon))):03d}_00_DEM"
        try:
            return float(read_window(f"/vsicurl/https://copernicus-dem-30m.s3.amazonaws.com/{n}/{n}.tif", s.lon, s.lat, 1).mean())
        except Exception:
            return np.nan
    with ThreadPoolExecutor(8) as ex:
        return pd.Series(list(ex.map(one, [s for _, s in sites.iterrows()])), index=sites.index, name="elev")


def spun(sites):
    cols = {}
    for f in sorted((DATA / "spun").glob("*.tif")):
        with rasterio.open(f) as src:
            xs, ys = Transformer.from_crs(4326, src.crs, always_xy=True).transform(sites.lon.values, sites.lat.values)
            cols[f"spun_{f.stem}"] = [v[0] for v in src.sample(zip(xs, ys))]
    return pd.DataFrame(cols, index=sites.index)


def loo_r2(df, y, cols, pca=None):
    num = make_pipeline(StandardScaler(), PCA(pca, random_state=0)) if pca else StandardScaler()
    pipe = make_pipeline(ColumnTransformer([("x", num, cols)]), RidgeCV(alphas=np.logspace(-2, 3, 30)))
    p = cross_val_predict(pipe, df, y, cv=LeaveOneOut())
    return float(1 - ((y - p) ** 2).sum() / ((y - y.mean()) ** 2).sum())


def main():
    ev = labels()
    sites = ev.groupby("site").agg(lat=("lat", "first"), lon=("lon", "first"), year=("year", lambda y: y.mode()[0]),
                                   richness=("richness", "mean"), n=("richness", "size"))
    sites["abs_lat"] = sites.lat.abs()
    cache = DATA / "gssp/features.parquet"
    if cache.exists():
        feats = pd.read_parquet(cache)
    else:
        idx = pd.read_parquet(DATA / "aef/aef_index.parquet", columns=["path", "year", "wgs84_west", "wgs84_south", "wgs84_east", "wgs84_north"])
        feats = pd.concat([alphaearth(sites, idx), soilgrids(sites), elevation(sites)], axis=1)
        feats.to_parquet(cache)
    df = sites.join(feats).join(spun(sites))
    df = df.dropna(subset=["a0"] + SOIL + ["elev"])
    y = np.log(df.richness.values)
    A = [f"a{i}" for i in range(64)]
    base = ["abs_lat", "elev"] + SOIL
    rows = {
        "Latitude only": loo_r2(df, y, ["abs_lat"]),
        "Latitude, terrain and soil (SoilGrids)": loo_r2(df, y, base),
        "AlphaEarth 10 m embedding": loo_r2(df, y, A, pca=6),
        "Latitude, terrain, soil and AlphaEarth": loo_r2(df, y, base + A, pca=None),
    }
    full = sites.join(feats).dropna(subset=["a0"])
    rows[f"AlphaEarth, all {len(full)} sites"] = loo_r2(full, np.log(full.richness.values), A, pca=6)
    spun_cols = [c for c in df if c.startswith("spun_")]
    if spun_cols:
        rows["SPUN 1 km map"] = loo_r2(df, y, spun_cols)

    # Head-to-head on the sites TESSERA covers: same sites, same protocol, each embedding alone.
    h2h, tess = None, DATA / "gssp/tessera.parquet"
    if tess.exists():
        sub = full.join(pd.read_parquet(tess), how="inner")
        ys, T = np.log(sub.richness.values), [f"t{i}" for i in range(128)]
        h2h = dict(n_sites=int(len(sub)), r2={
            "Latitude and terrain": round(loo_r2(sub, ys, ["abs_lat", "elev"]), 3),
            "AlphaEarth (64-d)": round(loo_r2(sub, ys, A, pca=6), 3),
            "TESSERA (128-d)": round(loo_r2(sub, ys, T, pca=6), 3),
        })

    # When: share of per-sample variance that sits within sites (invisible to an annual embedding).
    e = ev[ev.site.isin(df.index)].copy()
    e["ly"] = np.log(e.richness)
    within = ((e.ly - e.groupby("site").ly.transform("mean")) ** 2).sum() / ((e.ly - e.ly.mean()) ** 2).sum()
    s, c = np.sin(2 * np.pi * e.doy / 365), np.cos(2 * np.pi * e.doy / 365)
    resid = e.ly - e.groupby("site").ly.transform("mean")
    X = np.c_[s, c]
    seasonal = 0.0
    for _, g in e.groupby("site"):
        if len(g) < 8:
            continue
        Xi, ri = X[g.index.map(e.index.get_loc)], resid[g.index]
        beta, *_ = np.linalg.lstsq(np.c_[Xi, np.ones(len(g))], ri, rcond=None)
        seasonal += ((np.c_[Xi, np.ones(len(g))] @ beta) ** 2).sum()
    tot = ((e.ly - e.ly.mean()) ** 2).sum()

    res = dict(
        n_sites=int(len(df)), n_samples=int(len(e)), tropical_sites=sorted(df.index[df.abs_lat < 23.5].tolist()),
        where={k: round(v, 3) for k, v in rows.items()},
        when=dict(within_site_share=round(float(within), 3), seasonal_share=round(float(seasonal / tot), 3),
                  weekly_residual_share=round(float(within - seasonal / tot), 3)),
        head_to_head=h2h,
        sites=df[["lat", "lon", "richness", "n"]].round(4).reset_index().to_dict("records"),
    )
    OUT.mkdir(exist_ok=True)
    (OUT / "gssp.json").write_text(json.dumps(res, indent=1))
    print(json.dumps({k: res[k] for k in ("n_sites", "n_samples", "tropical_sites", "where", "when", "head_to_head")}, indent=1))


if __name__ == "__main__":
    main()
