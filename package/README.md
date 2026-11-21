# Demo package

One file, works offline. Open `index.html` in Chrome, Edge or Safari. Fonts load from Google Fonts when online and fall back otherwise.

## Flow (3 minutes)

| Time | Tab | Say |
|---|---|---|
| 0:00 | **Field** (tour auto-plays) | Over 90% of fungi are unnamed. They fruit for days; TESSERA gives one summary a year. Our passive sampler catches their DNA every week. |
| 0:40 | **Pitch** | 1 km is today's best map. We map at 10 m with low-cost eDNA samplers. Pharma, governments and farm biologicals pay. |
| 1:10 | **Landscape** | Toggle Uncertainty, then 10, 30, 100. The model sends the next sampler where it is least sure. |
| 1:50 | **Evidence** | Guided finds more species with few samplers. On 66 UK woodlands satellite did not help yet. Safeguards. |
| 2:30 | **Field**, Orbit view | Start-up. Next step: 10-site tropical pilot, $15k to $45k. If we miss the pass mark, we stop. |

Field keys: `T` tour, `Space` pause, `R` rain, `E` explode, `X` x-ray, `F` airflow, `1` to `5` camera.

## Real vs simulated

- Real: TESSERA 2024 embeddings, Copernicus GLO-30 terrain, RestREco UK soil fungi.
- Simulated: tropical fungal field, 400 species, sampler reads.

## Rebuild

```bash
.venv/bin/python demo/tropics_sim.py && .venv/bin/python demo/uk_model.py
cp demo/out/*.json showcase/public/data/
cd showcase && npm install && npm run package
```
