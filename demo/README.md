# Spora: simulated live demo

A clickable mock-up of the platform for its intended user, a Forestry England district
ecologist. **The interface is simulated, but every number, map pixel and suggested plot
is a real output** of the leave-one-site-out Tessera model in `scripts/master_table/`.

## What the walkthrough shows (▶ Play, about 12 s)
1. The user asks where mycorrhizal (EcM) fungi are doing well at **Neroche**, and where to sample next.
2. Spora fetches Tessera 2023 embeddings (10 m) for the site.
3. A model trained on the **other 20 sites only** paints a 10 m map of predicted EcM richness.
   Neroche was never seen in training.
4. The map is checked against Neroche's 50 real soil samples: rank agreement ρ 0.41, mean error
   6.2 OTUs, over-predicts by about 2. Shown as "Moderate: use as a prior".
5. It suggests 6 validation plots spread over the predicted low/mid/high range, ≥250 m from existing samples.

The right-hand panel always shows how far to trust the result. It includes random vs held-out-site R²
and a habitat-only baseline, so the user sees that most of the transfer skill comes from habitat.
Pick any of the 21 sites to see held-out predictions at its sample points. The wall-to-wall map
is exported for Neroche only.

## Run
The data file is not committed (repo rule: code only). Generate it, then open the page:
```bash
cd scripts/master_table
PY=python ./run_all.sh                                   # builds out/ (see its README for inputs)
python export_demo_data.py --out ../../demo/data/demo_data.js   # ~2 MB; Neroche map needs ~1 GB RAM
open ../../demo/index.html            # or index.html?autoplay to start the walkthrough immediately
```
Static files only: no server and no build step. It loads Leaflet 1.9.4 from cdnjs and Esri's gray
canvas basemap, so it needs an internet connection. Works in light and dark mode (◐ toggles).

## Honest limits shown in the UI
- EcM is assigned by genus (FungalTraits); ~30% of a typical sample's reads get a guild.
- One survey year (2023), England only (Forestry England soil eDNA, OGL v3,
  "Contains data supplied by UK Centre for Ecology & Hydrology").
- The map is drawn as a lat/lon image of a UTM grid. Within the site, map values at sample points
  match the held-out predictions (median difference 0, max 4.4 OTUs at edge pixels).
