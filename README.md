# EcoHack

Map fungal communities by pairing low-cost ground eDNA samplers with satellite habitat embeddings.

- **Ground:** passive airborne eDNA samplers give dated, sequence-resolved labels at a known location.
- **Orbit:** Sentinel-1/2 embeddings (TESSERA, AlphaEarth) describe the habitat around each sampler.
- **Model:** predicts occurrence from habitat. Its uncertainty picks where the next sampler goes.
- **Graph:** every record carries permit, sample and model-version provenance (TuringDB).

Imagery and embeddings are free. The moat is the growing corpus of dated ground labels and the access agreements behind them.

## Setup

Python 3.13, [uv](https://github.com/astral-sh/uv).

```bash
uv venv --python 3.13 .venv
uv pip install --python .venv/bin/python -r requirements.txt
source .venv/bin/activate
```

| Package | Use |
|---|---|
| `turingdb` | Versioned graph DB (Cypher). Embedded or server (`turingdb`, `turingdb -ui`) |
| `geotessera` | TESSERA 10 m embeddings (128-d, Sentinel-1/2, 2017 to 2025) |
| `earthengine-api` | AlphaEarth embeddings (64-d). Run `earthengine authenticate` first |
| `rasterio`, `rioxarray`, `geopandas`, `xarray` | Raster and vector I/O |
| `pandas`, `pyarrow`, `scikit-learn` | Tables and models |

## Data

Not committed. Unzip into `data/raw/<name>/` from the hackathon pack.

All three datasets share site codes (`EW01`, `SW01`, ...): 66 restored and ancient woodlands, Central Scotland 2021 and English Midlands 2022.

| Dataset | Files | Rows | Content |
|---|---|---|---|
| `soil-metagenomics-hibdige` | `woodlands_fungi_data_alpha.csv` | 330 | Fungal Shannon diversity per soil sample, dated |
| | `woodlands_fungi_data_functional.csv` | 330 | FUNGuild Chao1 per sample |
| | `woodland_bacterial_data_*.csv` | 330 | Bacterial alpha and functional diversity |
| | `woodland_soil_data_biochemical.csv` | 66 | pH, conductivity, land use, site age |
| `insect-plant-tree-woodland-2021-2022` | `woodland_site_details.csv` | 66 | Coordinates, age, area, broadleaf cover at 100 m to 3 km |
| | `trees.csv`, `deadwood.csv`, `canopy_cover.csv`, `ground_flora.csv`, ... | 330 to 17k | Habitat ground truth, invertebrates |
| `acoustic-monitoring-barnett` | `acoustic_indices.csv` | 139k | 15 soundscape indices per ~10 min recording, 83 sites |

### Caveats

- Coordinates are British National Grid (EPSG:27700) rounded to 1 km. Aggregate embeddings over the 1 km cell, not a single 10 m pixel.
- Fungal data is alpha diversity only. No taxa, no sequences, so composition cannot be modelled.
- Temperate UK only.
- No airborne eDNA yet. Soil fungal diversity stands in for sampler labels until our own samplers are deployed.

### Sources

- Hibdige et al. (2026), soil metagenomics. [doi:10.5285/a21b8ed1-124b-4b2a-adb4-c3fdcc9f95a2](https://doi.org/10.5285/a21b8ed1-124b-4b2a-adb4-c3fdcc9f95a2)
- Waddell et al. (2025), insects, plants and trees. [doi:10.5285/8c997943-1f90-4897-87b3-491eaef534ec](https://doi.org/10.5285/8c997943-1f90-4897-87b3-491eaef534ec)
- Barnett et al. (2025), acoustic indices. [doi:10.5285/33b6dea2-94c5-4e33-a1b3-9a6bd1c8776a](https://doi.org/10.5285/33b6dea2-94c5-4e33-a1b3-9a6bd1c8776a)

### External (not yet downloaded)

- GlobalFungi, Global Soil Mycobiome: taxon-level labels
- SPUN Underground Atlas: 1 km benchmark
- WorldClim or CHELSA, SoilGrids: covariate baseline
