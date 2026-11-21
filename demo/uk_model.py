"""Do 10 m TESSERA embeddings predict soil fungal diversity at 66 UK woodlands beyond soil and site data?"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.decomposition import PCA
from sklearn.impute import SimpleImputer
from sklearn.linear_model import RidgeCV
from sklearn.model_selection import RepeatedKFold, cross_val_predict
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/raw"
rd = lambda p: pd.read_csv(RAW / p, encoding="utf-8-sig")

fungi = rd("soil-metagenomics-hibdige/data/woodlands_fungi_data_alpha.csv").groupby("Site_code").shannon_entropy.mean()
guild = rd("soil-metagenomics-hibdige/data/woodlands_fungi_data_functional.csv").groupby("Site_code").funguild_chao1.mean()
soil = rd("soil-metagenomics-hibdige/data/woodland_soil_data_biochemical.csv").rename(columns={"site": "Site_code"})
emb = pd.read_parquet(ROOT / "data/uk_site_embeddings.parquet")

df = soil.merge(emb, on="Site_code").set_index("Site_code").join(fungi).join(guild).dropna(subset=["shannon_entropy"])
E = [f"e{i}" for i in range(128)]
BASE_NUM, BASE_CAT = ["pH", "conductivity_uS", "Site_age"], ["Former_land_use", "Region"]

base = ColumnTransformer([("n", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), BASE_NUM), ("c", OneHotEncoder(handle_unknown="ignore"), BASE_CAT)])
sat = ColumnTransformer([("e", make_pipeline(StandardScaler(), PCA(8, random_state=0)), E)])
both = ColumnTransformer([("n", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), BASE_NUM), ("c", OneHotEncoder(handle_unknown="ignore"), BASE_CAT),
                          ("e", make_pipeline(StandardScaler(), PCA(8, random_state=0)), E)])
MODELS = {"soil and site": base, "satellite only": sat, "soil, site and satellite": both}
ALPHAS = np.logspace(-2, 3, 30)


def cv_r2(pre, y, reps=20):
    out = []
    for rep in range(reps):
        cv = RepeatedKFold(n_splits=5, n_repeats=1, random_state=rep)
        p = cross_val_predict(make_pipeline(pre, RidgeCV(alphas=ALPHAS)), df, y, cv=cv)
        out.append(1 - ((y - p) ** 2).sum() / ((y - y.mean()) ** 2).sum())
    return float(np.mean(out)), float(np.std(out))


res = {"n_sites": len(df), "targets": {}}
for target in ["shannon_entropy", "funguild_chao1"]:
    y = df[target].values
    res["targets"][target] = {k: dict(zip(["r2", "sd"], cv_r2(m, y))) for k, m in MODELS.items()}
    print(target, {k: round(v["r2"], 3) for k, v in res["targets"][target].items()})

res["note"] = ("Satellite embeddings did not improve on soil and site data here. 66 sites, locations rounded to 1 km, "
               "and soil pH dominating fungal diversity limit what any 10 m signal can add. This is the test the "
               "dated, precisely located eDNA samples are designed to pass.")
(ROOT / "demo/out").mkdir(exist_ok=True)
(ROOT / "demo/out/uk.json").write_text(json.dumps(res, indent=1))
