"""Step 1: how precise are the FE sample coordinates? Writes out/coords_report.md."""
import collections
import math
import statistics as st

from common import OUT, read_meta


def dp(x):
    x = x.strip()
    return len(x.split(".")[1]) if "." in x else 0


def km(lat0, lon0, lat, lon):
    return 6371 * math.hypot(math.radians(lat - lat0),
                             math.radians(lon - lon0) * math.cos(math.radians(lat0)))


def main():
    m = read_meta()
    lines = ["# Forestry England 2023: coordinate precision\n",
             f"Samples: {len(m)}, sites: {len({r['Site'] for r in m})}\n"]
    for col in ("Latitude", "Longitude"):
        c = collections.Counter(dp(r[col]) for r in m)
        lines.append(f"- {col} decimal places: "
                     + ", ".join(f"{k} dp: {v}" for k, v in sorted(c.items())))
    flagged = [r for r in m if r["Error in Lat/Long"].strip()]
    lines.append(f"- Flagged 'Potential error in GPS coordinates': {len(flagged)} "
                 f"({collections.Counter(r['Site'] for r in flagged)})")
    by = collections.defaultdict(list)
    for r in m:
        by[r["Site"]].append(r)
    far = []
    for s, rs in by.items():
        la = st.median(float(r["Latitude"]) for r in rs)
        lo = st.median(float(r["Longitude"]) for r in rs)
        far += [(km(la, lo, float(r["Latitude"]), float(r["Longitude"])), r) for r in rs]
    big = [(d, r) for d, r in far if d > 8]
    lines.append(f"- Samples >8 km from their site median: {len(big)}, all flagged: "
                 f"{all(r['Error in Lat/Long'].strip() for _, r in big)}")
    dup = collections.Counter((r["Latitude"], r["Longitude"]) for r in m)
    lines.append(f"- Coordinate pairs shared by >1 sample: "
                 f"{sum(v > 1 for v in dup.values())}")
    lines += ["",
              "Notes from survey_description.docx: samplers recorded 'a GPS of the sampling location';",
              "each sample is a composite of 9 cores from a 10 m x 10 m plot. No statement about",
              "rounding, offsetting or GPS device/accuracy. 13 samples are noted as having GPS errors",
              "('in an unexpected location distant from the target site').",
              "",
              "Interpretation: 6 dp is ~0.1 m of *recorded* precision (5/4 dp counts are consistent",
              "with dropped trailing zeros). Real accuracy is set by a handheld GPS (typically several",
              "metres, worse under canopy) and by the 10 m composite footprint, so a single 10 m Tessera",
              "pixel can miss the plot. Primary features: 3x3 pixel (30 m) window mean; single pixel",
              "reported as a sensitivity check. Flagged samples are excluded from pixel-level models."]
    (OUT / "coords_report.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
