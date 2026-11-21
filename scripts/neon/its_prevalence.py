"""Prevalence of candidate fungi in NEON soil ITS taxon tables (DP1.10081.002).

Usage: python3 its_prevalence.py FILE_LIST_JSON DATA_DIR OUT_DIR [YEARS...]
  FILE_LIST_JSON  output of list_its_files.py
  DATA_DIR        where per-sample CSVs are cached (downloaded if missing)
  OUT_DIR         where result CSVs are written
  YEARS           e.g. 2023 2024 (default: all)

A sample is one soil core (dnaSampleID with the -DNA<n> suffix removed).
"Confident" presence: genusConfidence >= 0.8 and >= 2 reads for the genus.
"Any" presence: any read assigned to the genus, whatever the confidence.
"""
import collections
import csv
import json
import os
import re
import statistics
import sys
from concurrent.futures import ThreadPoolExecutor

from neon_api import fetch

GENERA = [
    "Coccidioides", "Alternaria", "Cenococcum", "Fusarium", "Hymenoscyphus",
    "Aspergillus", "Ramularia", "Leptosphaeria",
    "Russula", "Cladosporium",  # reference genera: common EcM / common airborne allergen
]
SPECIES = {  # species-level checks (speciesConfidence >= 0.8)
    "Cenococcum": "geophilum", "Hymenoscyphus": "fraxineus", "Aspergillus": "fumigatus",
    "Alternaria": "alternata", "Fusarium": "graminearum",
}
CONF = 0.8
MIN_READS = 2


def download(rows, data_dir):
    def one(r):
        path = os.path.join(data_dir, r["name"])
        if os.path.exists(path) and os.path.getsize(path) == r["size"]:
            return 0
        body = fetch(r["url"])
        with open(path + ".part", "wb") as f:
            f.write(body)
        os.replace(path + ".part", path)
        return len(body)
    with ThreadPoolExecutor(16) as ex:
        got = sum(ex.map(one, rows))
    print(f"downloaded {got/1e9:.2f} GB ({len(rows)} files in list)", flush=True)


def f(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def parse(path):
    """Return {sample: (total_reads, {genus: [conf_reads, any_reads]}, {genus: species_conf_reads})}."""
    out = {}
    with open(path, newline="", encoding="utf-8", errors="replace") as fh:
        for row in csv.DictReader(fh):
            if row.get("kingdom") != "Fungi":
                continue
            sample = re.sub(r"-DNA\d+$", "", row["dnaSampleID"])
            reads = f(row["individualCount"])
            tot, gen, spp = out.setdefault(sample, [0.0, collections.defaultdict(lambda: [0.0, 0.0]), collections.Counter()])
            out[sample][0] = tot + reads
            g = row.get("genus") or ""
            if g in GENERA:
                gen[g][1] += reads
                if f(row.get("genusConfidence")) >= CONF:
                    gen[g][0] += reads
                    if SPECIES.get(g) and row.get("specificEpithet") == SPECIES[g] and f(row.get("speciesConfidence")) >= CONF:
                        spp[g] += reads
    return out


def main(list_json, data_dir, out_dir, years):
    os.makedirs(data_dir, exist_ok=True)
    os.makedirs(out_dir, exist_ok=True)
    rows = json.load(open(list_json))
    if years:
        rows = [r for r in rows if r["month"][:4] in years]
    print(f"{len(rows)} files, {sum(r['size'] for r in rows)/1e9:.2f} GB listed", flush=True)
    download(rows, data_dir)

    samples = {}  # sample -> dict
    for r in rows:
        for s, (tot, gen, spp) in parse(os.path.join(data_dir, r["name"])).items():
            d = samples.setdefault(s, {"site": r["site"], "month": r["month"], "total": 0.0,
                                       "gen": collections.defaultdict(lambda: [0.0, 0.0]), "spp": collections.Counter()})
            d["total"] += tot
            for g, (c, a) in gen.items():
                d["gen"][g][0] += c
                d["gen"][g][1] += a
            d["spp"].update(spp)

    n = len(samples)
    sites = sorted({d["site"] for d in samples.values()})
    print(f"\n{n} soil samples, {len(sites)} sites, years {sorted(years) if years else 'all'}")
    print(f"Confident = genusConfidence >= {CONF} and >= {MIN_READS} reads\n")
    hdr = ["genus", "samples_confident", "prevalence_confident", "samples_any", "prevalence_any",
           "sites_confident", "median_rel_abund_pct_in_positives", "species_checked", "samples_species_confident"]
    out = []
    for g in GENERA:
        pos = [d for d in samples.values() if d["gen"][g][0] >= MIN_READS]
        anyp = [d for d in samples.values() if d["gen"][g][1] > 0]
        rel = [100 * d["gen"][g][0] / d["total"] for d in pos if d["total"] > 0]
        sp = SPECIES.get(g, "")
        n_sp = sum(1 for d in samples.values() if d["spp"][g] >= MIN_READS) if sp else ""
        out.append([g, len(pos), round(len(pos) / n, 4), len(anyp), round(len(anyp) / n, 4),
                    len({d["site"] for d in pos}), round(statistics.median(rel), 3) if rel else "",
                    f"{g} {sp}" if sp else "", n_sp])
    with open(os.path.join(out_dir, "prevalence.csv"), "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(hdr)
        w.writerows(out)
    print(f"{'genus':14s} {'conf n':>7s} {'conf %':>7s} {'any n':>6s} {'any %':>6s} {'sites':>5s} {'med rel%':>8s}  species check")
    for r in out:
        print(f"{r[0]:14s} {r[1]:7d} {100*r[2]:6.1f}% {r[3]:6d} {100*r[4]:5.1f}% {r[5]:5d} {str(r[6]):>8s}  {r[7]} {r[8]}")

    # by site
    with open(os.path.join(out_dir, "by_site.csv"), "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["site", "samples"] + GENERA)
        for s in sites:
            ds = [d for d in samples.values() if d["site"] == s]
            w.writerow([s, len(ds)] + [sum(1 for d in ds if d["gen"][g][0] >= MIN_READS) for g in GENERA])
    # by year
    with open(os.path.join(out_dir, "by_year.csv"), "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["year", "samples"] + GENERA)
        for y in sorted({d["month"][:4] for d in samples.values()}):
            ds = [d for d in samples.values() if d["month"][:4] == y]
            w.writerow([y, len(ds)] + [sum(1 for d in ds if d["gen"][g][0] >= MIN_READS) for g in GENERA])
    print(f"\nwrote prevalence.csv, by_site.csv, by_year.csv to {out_dir}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3], set(sys.argv[4:]))
