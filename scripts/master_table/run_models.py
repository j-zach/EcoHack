"""Step 4: random 5-fold vs leave-one-site-out (LOSO), same features and model.

Model: HistGradientBoostingRegressor (LightGBM is installed but can't load without the
system libomp; not installed on this machine).
Targets: ecm_richness (count of EcM OTUs, comparable to Young et al.) and ecm_share
(EcM reads / all fungal reads). Feature sets: Tessera 3x3 window mean (primary), single
pixel, and habitat one-hot only (confound baseline). Subsets: all usable samples; woodland only.
Metric: pooled out-of-fold R2 and Spearman rho.
Output: out/model_results.csv, out/model_results.md
"""
import numpy as np
import pandas as pd
from scipy.stats import spearmanr
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import r2_score
from sklearn.model_selection import KFold, LeaveOneGroupOut, cross_val_predict

from common import OUT

TARGETS = ["ecm_richness", "ecm_share"]


def model():
    return HistGradientBoostingRegressor(random_state=0)


def evaluate(X, y, groups):
    out = {}
    for name, cv in [("random_5fold", KFold(5, shuffle=True, random_state=0)),
                     ("leave_one_site_out", LeaveOneGroupOut())]:
        g = groups if name == "leave_one_site_out" else None
        pred = cross_val_predict(model(), X, y, cv=cv, groups=g)
        out[name] = (r2_score(y, pred), spearmanr(y, pred).statistic)
    return out


def main():
    m = pd.read_csv(OUT / "master.csv")
    t = pd.read_parquet(OUT / "tessera_2023.parquet")
    d = m.merge(t, on="sample")
    feats = {
        "tessera_3x3": [c for c in d if c.startswith("w3_")],
        "tessera_pixel": [c for c in d if c.startswith("px_")],
    }
    hab = pd.get_dummies(d.habitat, prefix="hab", dtype=float)
    d = pd.concat([d, hab], axis=1)
    feats["habitat_only"] = list(hab.columns)

    rows = []
    for subset, mask in [("all", np.ones(len(d), bool)), ("woodland", (d.habitat == "woodland").values)]:
        sd = d[mask]
        for target in TARGETS:
            for fname, cols in feats.items():
                if subset == "woodland" and fname == "habitat_only":
                    continue
                res = evaluate(sd[cols].values, sd[target].values, sd.site.values)
                for scheme, (r2, rho) in res.items():
                    rows.append({"subset": subset, "n": len(sd), "n_sites": sd.site.nunique(),
                                 "target": target, "features": fname, "validation": scheme,
                                 "r2": round(r2, 3), "spearman": round(rho, 3)})
                print(f"{subset:8s} {target:12s} {fname:13s} "
                      + "  ".join(f"{k}: R2={v[0]:.3f} rho={v[1]:.3f}" for k, v in res.items()),
                      flush=True)
    df = pd.DataFrame(rows)
    df.to_csv(OUT / "model_results.csv", index=False)
    wide = df.pivot_table(index=["subset", "n", "n_sites", "target", "features"],
                          columns="validation", values=["r2", "spearman"]).round(3)
    (OUT / "model_results.md").write_text(wide.to_markdown() + "\n")
    print(wide.to_string())


if __name__ == "__main__":
    main()
