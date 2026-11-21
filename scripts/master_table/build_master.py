"""Step 2: per-sample master table from FE fungal read counts + FungalTraits genus guilds.

Output: out/master.csv with one row per sample:
  sample, site, lat, lon, coord_source (sample | centroid), gps_flagged, habitat,
  total_reads, n_otus, ecm_richness, ecm_reads, ecm_share,
  pathogen_richness, pathogen_reads, pathogen_share, guild_assigned_read_share
"""
import collections
import csv
import statistics as st

import openpyxl
import pandas as pd

from common import FE_COUNTS, FUNGALTRAITS, OUT, clean_habitat, read_meta, sample_key


def load_fungaltraits():
    wb = openpyxl.load_workbook(FUNGALTRAITS, read_only=True)
    rows = wb["data"].iter_rows(values_only=True)
    hdr = next(rows)
    gi, pi = hdr.index("GENUS"), hdr.index("primary_lifestyle")
    return {r[gi].strip(): (r[pi] or "").strip() for r in rows if r[gi]}


def load_counts():
    with open(FE_COUNTS, encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    h = next(i for i, r in enumerate(rows) if r and r[0] == "NMSeqID")
    hdr, sites = rows[h], rows[h - 1]
    first = hdr.index("Comments") + 2          # skip "Number of samples in which OTU occurs"
    samples, ssites = hdr[first:], sites[first:]
    g_i, k_i, t_i = hdr.index("Genus"), hdr.index("Kingdom"), hdr.index("Target Status")
    otus = []
    for r in rows[h + 1:]:
        if not r or not r[0].startswith("IM-") or r[k_i] != "Fungi" or r[t_i] != "Target":
            continue
        reads = [int(v) if v.strip().isdigit() else 0 for v in r[first:]]
        otus.append((r[g_i].strip(), reads))
    return samples, ssites, otus


def main():
    traits = load_fungaltraits()
    samples, ssites, otus = load_counts()
    meta = read_meta()

    # coordinates: exact (site, plot, sample) key, unique on both sides
    mkeys = collections.Counter(sample_key(r["Site"], r["Sample ID"]) for r in meta)
    mby = {sample_key(r["Site"], r["Sample ID"]): r for r in meta}
    ckeys = collections.Counter(sample_key(s, x) for x, s in zip(samples, ssites))
    centroid = {}
    for site in set(ssites):
        rs = [r for r in meta if r["Site"] == site and not r["Error in Lat/Long"].strip()]
        centroid[site] = (st.median(float(r["Latitude"]) for r in rs),
                          st.median(float(r["Longitude"]) for r in rs))

    lifestyle = [traits.get(g, "") for g, _ in otus]
    out = []
    for j, (sid, site) in enumerate(zip(samples, ssites)):
        k = sample_key(site, sid)
        own = mkeys.get(k) == 1 and ckeys[k] == 1
        r = mby[k] if own else None
        lat, lon = ((float(r["Latitude"]), float(r["Longitude"])) if own else centroid[site])
        tot = ecm_n = ecm_r = pp_n = pp_r = assigned = n = 0
        for (g, reads), ls in zip(otus, lifestyle):
            v = reads[j]
            if v <= 0:
                continue
            n += 1
            tot += v
            if ls:
                assigned += v
            if ls == "ectomycorrhizal":
                ecm_n += 1
                ecm_r += v
            elif ls == "plant_pathogen":
                pp_n += 1
                pp_r += v
        out.append({
            "sample": sid, "site": site, "lat": lat, "lon": lon,
            "coord_source": "sample" if own else "centroid",
            "gps_flagged": bool(own and r["Error in Lat/Long"].strip()),
            "habitat": clean_habitat(r["Habitat"]) if own else "unknown",
            "total_reads": tot, "n_otus": n,
            "ecm_richness": ecm_n, "ecm_reads": ecm_r, "ecm_share": ecm_r / tot if tot else None,
            "pathogen_richness": pp_n, "pathogen_reads": pp_r,
            "pathogen_share": pp_r / tot if tot else None,
            "guild_assigned_read_share": assigned / tot if tot else None,
        })
    df = pd.DataFrame(out)
    # Provenance guard: this table is England-only (FE 2023). The EIDC record's bounding box is
    # lon -6.452..1.768, lat 49.864..55.812. Any point outside it means foreign data leaked in.
    usable = df[(df.coord_source == "sample") & (~df.gps_flagged)]
    outside = usable[~usable.lon.between(-6.452, 1.768) | ~usable.lat.between(49.864, 55.812)]
    if len(outside):
        raise ValueError(f"{len(outside)} usable samples fall outside England's bbox: "
                         f"{outside['sample'].tolist()[:5]}")
    df.to_csv(OUT / "master.csv", index=False)

    n_gen = sum(1 for g, _ in otus if g)
    n_hit = sum(1 for g, _ in otus if g in traits)
    s = [f"OTUs (Fungi, Target): {len(otus)}; with genus: {n_gen}; genus in FungalTraits: {n_hit}",
         f"Samples: {len(df)}; own coordinates: {(df.coord_source == 'sample').sum()}; "
         f"centroid only: {(df.coord_source == 'centroid').sum()}; GPS-flagged (own): {df.gps_flagged.sum()}",
         f"Median share of reads with a FungalTraits lifestyle: {df.guild_assigned_read_share.median():.2f}",
         f"Habitat (own-coord samples): {df[df.coord_source == 'sample'].habitat.value_counts().to_dict()}",
         "", "Targets:",
         df[["ecm_richness", "ecm_share", "pathogen_richness", "pathogen_share", "total_reads"]]
         .describe().round(3).to_string(),
         "",
         f"Samples with any EcM OTU: {(df.ecm_richness > 0).mean():.0%}; "
         f"with any plant-pathogen OTU: {(df.pathogen_richness > 0).mean():.0%}",
         f"Spearman(ecm_richness, total_reads) = "
         f"{df.ecm_richness.corr(df.total_reads, method='spearman'):.2f}  (sequencing-depth check)"]
    (OUT / "master_summary.txt").write_text("\n".join(s) + "\n")
    print("\n".join(s))


if __name__ == "__main__":
    main()
