"""Shared paths and parsers for the Forestry England (FE) 2023 master table."""
import csv
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
# Raw inputs are not in git. Override with ECOHACK_RAW=/path/to/raw (layout in README.md).
RAW = Path(os.environ.get("ECOHACK_RAW", Path.home() / "ecohack" / "data" / "raw"))
FE = RAW / "fe_edna_2023" / "pkg"
FE_META = FE / "supporting-documents" / "metadata.csv"
FE_COUNTS = FE / "data" / "fungi_counts.csv"
FUNGALTRAITS = RAW / "fungaltraits" / "s4.xlsx"   # Polme et al. 2020, ESM4 (genus table)
OUT = ROOT / "out"
OUT.mkdir(exist_ok=True)


def read_meta():
    with open(FE_META, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def sample_key(site, sample_id):
    """(site, plot, sample) parsed from the many ID spellings, e.g.
    '2023 C BP1 P1 S2' / '2023 CBPI P1S2' -> (site, '1', '2')."""
    u = sample_id.upper().replace("/", " ")
    ps = re.findall(r"P\s*(\d+)\s*S\s*(\d+)", u)
    if ps:
        return (site,) + ps[-1]
    m = re.findall(r"([A-Z]+)\s*(\d+)\s*$", u)
    return (site,) + m[-1] if m else (site, u)


def clean_habitat(h):
    h = (h or "").strip().lower()
    if not h:
        return "unknown"
    if "forest/woodland/grassland" in h:
        return "mixed_wood_grass"
    if "forest" in h or "woodland" in h:
        return "woodland"
    if "grassland" in h:
        return "grassland"
    if "arable" in h:
        return "arable"
    if "heath" in h:
        return "heathland"
    if any(k in h for k in ("peat", "mire", "moor", "flush")):
        return "peat_mire_moor"
    return "other"
