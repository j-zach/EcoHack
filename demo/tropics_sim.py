"""Guided vs grid vs random sampling on real tropical habitat with a synthetic fungal field.

Habitat (TESSERA 2024) and terrain (Copernicus GLO-30) are real. The fungal field is
synthetic: we have no tropical labels. This tests the sampling strategy, not the biology.
"""
import base64
import io
import json
from pathlib import Path

import numpy as np
import rasterio
from rasterio.warp import Resampling, reproject
from geotessera import GeoTessera
from PIL import Image
from scipy.ndimage import gaussian_filter, maximum_filter
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.ensemble import ExtraTreesRegressor

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "demo/out"
POOL = 4          # 10 m -> 40 m for simulation speed
ROUNDS, PER = 10, 10
SNAPS = (0, 2, 9)
SEEDS = 5
REGIONS = {
    "amazon": dict(name="Central Amazon, Brazil", tile=(-60.05, -2.55)),
    "budongo": dict(name="Budongo Forest, Uganda", tile=(31.65, 1.75)),
    "osa": dict(name="Osa Peninsula, Costa Rica", tile=(-83.45, 8.55)),
}


def dem_url(lon, lat):
    ns, ew = ("N" if lat >= 0 else "S"), ("E" if lon >= 0 else "W")
    la, lo = int(np.floor(lat)), int(np.floor(lon))
    n = f"Copernicus_DSM_COG_10_{ns}{abs(la):02d}_00_{ew}{abs(lo):03d}_00_DEM"
    return f"/vsicurl/https://copernicus-dem-30m.s3.amazonaws.com/{n}/{n}.tif"


def pool(a, k):
    h, w = (a.shape[0] // k) * k, (a.shape[1] // k) * k
    return a[:h, :w].reshape(h // k, k, w // k, k, *a.shape[2:]).mean((1, 3))


def load(tile):
    emb, crs, tr = GeoTessera(embeddings_dir=ROOT / "data/tessera").fetch_embedding(*tile, 2024)
    emb = np.nan_to_num(emb)
    dem = np.zeros(emb.shape[:2], np.float32)
    with rasterio.open(dem_url(*tile)) as src:
        reproject(rasterio.band(src, 1), dem, dst_transform=tr, dst_crs=crs, resampling=Resampling.bilinear)
    return pool(emb, POOL), pool(dem, POOL)


def grf(shape, scale, rng):
    f = gaussian_filter(rng.standard_normal(shape), scale)
    return (f - f.mean()) / f.std()


def synth(z, dem, rng):
    """Three guilds driven by habitat, terrain and an unobservable spatial term."""
    h, w, d = z.shape
    zf = z.reshape(-1, d)
    elev = ((dem - dem.mean()) / (dem.std() + 1e-6)).reshape(-1)
    guilds = []
    for _ in range(3):
        w1, w2 = rng.normal(0, 1 / np.sqrt(d), (d, 16)), rng.normal(0, 1, 16)
        hab = np.tanh(zf @ w1) @ w2
        hab = (hab - hab.mean()) / hab.std()
        g = 0.75 * hab + 0.25 * rng.normal() * elev + 0.45 * grf((h, w), 6, rng).reshape(-1)
        guilds.append(g)
    guilds = np.stack(guilds, 1)
    rich = guilds.sum(1)
    return (rich - rich.mean()) / rich.std(), guilds


def fit(X, y, idx, seed):
    m = ExtraTreesRegressor(200, min_samples_leaf=2, max_features=0.5, n_jobs=-1, random_state=seed)
    m.fit(X[idx], y[idx])
    per_tree = np.stack([t.predict(X) for t in m.estimators_])
    return per_tree.mean(0), per_tree.std(0)


def score(y, p, lab):
    """R2 over all pixels, and RMSE averaged equally across habitat clusters (rare habitats count)."""
    r2 = 1 - ((y - p) ** 2).sum() / ((y - y.mean()) ** 2).sum()
    macro = np.mean([np.sqrt(((y - p)[lab == k] ** 2).mean()) for k in np.unique(lab)])
    return r2, macro


def grid_idx(h, w, n):
    k = int(np.ceil(np.sqrt(n)))
    rr = np.linspace(0, h - 1, k + 2)[1:-1].astype(int)
    cc = np.linspace(0, w - 1, k + 2)[1:-1].astype(int)
    return np.array([r * w + c for r in rr for c in cc])[:n]


def pick_guided(X, unc, taken, n, seed):
    """Uncertainty-weighted k-means in habitat space: informative and representative."""
    rng = np.random.default_rng(seed)
    cand = np.setdiff1d(rng.choice(len(X), 20000, replace=False), taken)
    wts = unc[cand] ** 2 if unc is not None else None
    km = KMeans(n, n_init=3, random_state=seed).fit(X[cand], sample_weight=wts)
    out = []
    for c in range(n):
        m = cand[km.labels_ == c]
        if len(m):
            out.append(m[np.argmin(((X[m] - km.cluster_centers_[c]) ** 2).sum(1))])
    return np.array(out)


N_SPECIES, RARE = 400, 0.01


def species(X, h, w, rng):
    """Synthetic species: each lives in a habitat niche; range sizes are log-uniform, so most are rare.
    Returns pixel x species presence, dilated by 1 px (an air sampler catches spores from ~40 m around it)."""
    centres = X[rng.choice(len(X), N_SPECIES, replace=False)]
    rng_frac = np.exp(rng.uniform(np.log(0.0004), np.log(0.05), N_SPECIES))
    d2 = ((X[:, None, :] - centres[None]) ** 2).sum(-1)  # pixels x species
    thr = np.array([np.quantile(d2[:, k], rng_frac[k]) for k in range(N_SPECIES)])
    pres = (d2 <= thr) & (rng.random(d2.shape) < 0.75)
    pres = maximum_filter(pres.reshape(h, w, N_SPECIES), size=(3, 3, 1)).reshape(-1, N_SPECIES)
    return pres, pres.mean(0) < RARE


def value_metrics(idx, pred, y, pres, rare, fine):
    found = pres[idx].any(0)
    q = lambda v: np.searchsorted(np.quantile(v, [0.2, 0.4, 0.6, 0.8]), v)
    return [found.sum(), (found & rare).sum(), len(np.unique(fine[idx])), (np.abs(q(pred) - q(y)) >= 2).mean()]


def run(key, cfg):
    emb, dem = load(cfg["tile"])
    h, w, _ = emb.shape
    z = PCA(16, random_state=0).fit_transform(emb.reshape(-1, 128)).reshape(h, w, 16)
    X = np.c_[z.reshape(-1, 16), (dem.reshape(-1) - dem.mean()) / (dem.std() + 1e-6)]
    sub = np.random.default_rng(0).choice(len(X), 20000, replace=False)
    lab = KMeans(8, n_init=3, random_state=0).fit(X[sub]).predict(X)
    fine = KMeans(20, n_init=3, random_state=0).fit(X[sub]).predict(X)
    curves = {s: np.zeros((SEEDS, ROUNDS, 2)) for s in ("guided", "grid", "random")}
    value = {s: np.zeros((SEEDS, ROUNDS, 4)) for s in curves}
    totals = []
    snaps, pts = {}, {}
    for seed in range(SEEDS):
        rng = np.random.default_rng(seed)
        y, guilds = synth(z, dem, rng)
        pres, rare = species(X, h, w, rng)
        totals.append([pres.any(0).sum(), (pres.any(0) & rare).sum()])
        taken = pick_guided(X, None, np.array([], int), PER, seed)
        for r in range(ROUNDS):
            n = PER * (r + 1)
            p, u = fit(X, y, taken, seed)
            gi, ri = grid_idx(h, w, n), rng.choice(h * w, n, replace=False)
            pg, pr = fit(X, y, gi, seed)[0], fit(X, y, ri, seed)[0]
            curves["guided"][seed, r] = score(y, p, lab)
            curves["grid"][seed, r] = score(y, pg, lab)
            curves["random"][seed, r] = score(y, pr, lab)
            for k, (ix, pp) in {"guided": (taken, p), "grid": (gi, pg), "random": (ri, pr)}.items():
                value[k][seed, r] = value_metrics(ix, pp, y, pres, rare, fine)
            if seed == 0 and r in SNAPS:
                snaps[r] = (p, u)
                pts.setdefault("guided", []).append(taken.tolist())
            if r < ROUNDS - 1:
                taken = np.r_[taken, pick_guided(X, u, taken, PER, seed * 100 + r)]
        if seed == 0:
            truth, truth_guilds = y, guilds
        print(key, "seed", seed, {k: np.round(v[seed, [0, -1]], 2).tolist() for k, v in curves.items()}, flush=True)
    pts["grid"] = grid_idx(h, w, PER * ROUNDS).tolist()
    return dict(
        key=key, name=cfg["name"], tile=cfg["tile"], h=h, w=w, px_m=10 * POOL,
        dem=dem, rgb=pca_rgb(emb), truth=truth.reshape(h, w),
        snaps={r: (p.reshape(h, w), u.reshape(h, w)) for r, (p, u) in snaps.items()},
        pts=pts, curves={k: v.mean(0).T.tolist() for k, v in curves.items()},
        curves_sd={k: v.std(0).T.tolist() for k, v in curves.items()},
        value={k: dict(zip(["species", "rare", "habitats", "misclass"], v.mean(0).T.tolist())) for k, v in value.items()},
        totals=dict(zip(["species", "rare"], np.mean(totals, 0).tolist()), habitats=20, n_species=N_SPECIES),
    )


def pca_rgb(emb):
    h, w, _ = emb.shape
    c = PCA(3, random_state=0).fit_transform(emb.reshape(-1, 128))
    lo, hi = np.percentile(c, [2, 98], 0)
    return (np.clip((c - lo) / (hi - lo), 0, 1).reshape(h, w, 3) * 255).astype(np.uint8)


def png(a, cmap=None, lo=None, hi=None):
    if a.ndim == 2:
        lo = np.percentile(a, 2) if lo is None else lo
        hi = np.percentile(a, 98) if hi is None else hi
        t = np.clip((a - lo) / (hi - lo + 1e-9), 0, 1)
        a = (np.stack([np.interp(t, np.linspace(0, 1, len(cmap)), cmap[:, i]) for i in range(3)], -1)).astype(np.uint8)
    buf = io.BytesIO()
    Image.fromarray(a).save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


# Perceptual-ish ramps (dark to light) for value and uncertainty.
VAL = np.array([[38, 24, 64], [74, 52, 140], [43, 128, 168], [90, 190, 130], [240, 225, 120]], float)
UNC = np.array([[20, 20, 28], [90, 40, 90], [190, 70, 70], [245, 160, 60], [255, 240, 200]], float)


def export(res):
    t = res["truth"]
    lo, hi = np.percentile(t, [2, 98])
    dem = res["dem"]
    step = max(1, res["h"] // 160)
    hm = dem[::step, ::step]
    return dict(
        key=res["key"], name=res["name"], tile=res["tile"], h=res["h"], w=res["w"], px_m=res["px_m"],
        relief_m=float(dem.max() - dem.min()), dem_min=float(dem.min()),
        height=dict(h=hm.shape[0], w=hm.shape[1], v=np.round(hm - dem.min()).astype(int).ravel().tolist()),
        tex=dict(
            habitat=png(res["rgb"]),
            truth=png(t, VAL, lo, hi),
            pred={r: png(p, VAL, lo, hi) for r, (p, _) in res["snaps"].items()},
            unc={r: png(u, UNC, 0, np.percentile(res["snaps"][SNAPS[0]][1], 98)) for r, (_, u) in res["snaps"].items()},
        ),
        pts={k: [[int(i // res["w"]), int(i % res["w"])] for i in (v[-1] if k == "guided" else v)] for k, v in res["pts"].items()},
        rounds_guided=[len(x) for x in res["pts"]["guided"]],
        curves=res["curves"], curves_sd=res["curves_sd"], per_round=PER, value=res["value"], totals=res["totals"],
    )


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for k, cfg in REGIONS.items():
        (OUT / f"{k}.json").write_text(json.dumps(export(run(k, cfg))))
