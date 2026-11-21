# Master table + first models (Forestry England 2023 soil eDNA × Tessera 2023)

Code only; data stays out of git. Wildfire / natural-disaster framings are out of scope.

## Inputs (put under `$ECOHACK_RAW`, default `~/ecohack/data/raw`)
- `fe_edna_2023/pkg/`: unzipped EIDC package, doi:10.5285/07c32201-c374-4432-a00b-832dedee571e
  (`https://data-package.ceh.ac.uk/data/07c32201-c374-4432-a00b-832dedee571e.zip`, OGL v3;
  attribution: "Contains data supplied by UK Centre for Ecology & Hydrology.")
- `fungaltraits/s4.xlsx`: FungalTraits genus table, Põlme et al. 2020 Fungal Diversity, ESM4
  (`https://static-content.springer.com/esm/art%3A10.1007%2Fs13225-020-00466-2/MediaObjects/13225_2020_466_MOESM4_ESM.xlsx`)
- Tessera v1.1 2023 is streamed by `geotessera` (anonymous; ~1 GB RAM per tile, tiles not kept on disk).

## Run
```bash
pip install -r requirements.txt
PY=python ./run_all.sh        # writes ./out/
```
`run_all.sh` sets `SSL_CERT_FILE` to certifi's bundle (python.org macOS builds ship without CA certs).
LightGBM needs the system `libomp`; this uses scikit-learn's HistGradientBoostingRegressor instead.

## Steps
1. `coords_report.py`: coordinate precision → `out/coords_report.md`
2. `build_master.py`: per-sample table → `out/master.csv` (guilds = FungalTraits `primary_lifestyle` by genus)
3. `tessera_features.py`: 10 m pixel + 3×3 window mean at each sample with its own, unflagged coordinates
4. `run_models.py`: random 5-fold vs leave-one-site-out, all samples and woodland only → `out/model_results.{csv,md}`
5. `export_demo_data.py` (optional): real held-out predictions + a 10 m map of one held-out site for the demo frontend → `demo/data/demo_data.js` (see `demo/README.md`)

## Data provenance
**UK only (England).** Every modelled sample comes from the Forestry England 2023 survey: 546 samples,
21 English sites, lat 50.71–55.30, lon −3.42–1.62. No NEON (US) or other non-UK data is used.
`build_master.py` fails if any usable sample falls outside the dataset's England bounding box.
FungalTraits is a global genus→guild lookup table, not site data.

## Decisions
- **Coordinates:** 588/656 latitudes have 6 dp (~0.1 m as recorded); no rounding/offsetting note.
  Each sample is a 9-core composite from a 10 m × 10 m plot taken by handheld GPS, so the 3×3 (30 m)
  window is the primary feature. 13 samples flagged by the data owners as GPS errors (all 9–100 km off
  site) are excluded.
- **Samples used:** 546 = 558 matched to their own coordinates by site+plot+sample ID, minus 12 flagged.
  98 samples with only a site centroid are left out of pixel-level models.
- **Targets:** EcM richness (number of EcM OTUs) and EcM share of fungal reads.
  Only 1,994/5,270 OTUs have a genus; median 30% of a sample's reads get a FungalTraits lifestyle.
- **Pathogens too thin for a balance target:** 70% of samples have ≥1 plant-pathogen OTU, but the
  median pathogen read share is 0.1%.
- Richness is not driven by sequencing depth (Spearman with total reads = −0.04).

## First results (pooled out-of-fold R²; HistGradientBoosting, default params, seed 0)

| subset (n, sites) | target | features | random 5-fold | leave-one-site-out |
|---|---|---|---|---|
| all (546, 21) | EcM richness | Tessera 3×3 | 0.58 | 0.42 |
| | | Tessera pixel | 0.55 | 0.42 |
| | | habitat only | 0.45 | 0.38 |
| | EcM share | Tessera 3×3 | 0.45 | 0.29 |
| | | Tessera pixel | 0.39 | 0.31 |
| | | habitat only | 0.29 | 0.25 |
| woodland (213, 12) | EcM richness | Tessera 3×3 | 0.28 | 0.20 |
| | | Tessera pixel | 0.23 | 0.10 |
| | EcM share | Tessera 3×3 | 0.22 | 0.12 |
| | | Tessera pixel | 0.17 | 0.06 |

Reading:
- Random split reproduces Young et al.'s level (0.58 vs their 0.55); leave-one-site-out drops it to 0.42.
- Most of that is habitat: field-recorded habitat alone gets 0.38 leave-one-site-out. Tessera adds ~0.04.
- Within woodland (host trees present), Tessera still transfers to unseen sites, but weakly
  (R² 0.20 for richness with the 30 m window; the single pixel halves it).
- Random 5-fold is optimistic partly because the 5 samples in a plot sit metres apart and land in
  both train and test.
