# Evidence graph prompts (Amass + TuringDB)

Four prompts for a Claude Code session that has the Amass MCP connected and TuringDB 3.1 installed. Run them in order:

1. Build the evidence graph.
2. Add the human-health layer (for the Amass prize).
3. Score the candidate problems.
4. Red-team the chosen problem.

These revise the first versions, which built the team's current local graph. The changes:

- The TuringDB write rules are spelled out, because without them `CREATE` fails or edges are silently skipped.
- The schema has fixed property types, with years as `year_start` and `year_end` integers.
- Every edge carries its Amass record ID, and the agent keeps a log of the records it read, which the Amass prize asks for.
- Sources that Amass doesn't index (arXiv, datasets) have a fallback.
- NEON and the US are included.
- There is a new health-layer prompt.
- Pharma, wildfire and other natural-disaster framings are out. Asthma (*Alternaria*) and Valley fever (*Coccidioides*) are in.
- Scoring starts with hard gates, including detection rate.

## Prompt 1: build the evidence graph

```
You are building a scientific evidence graph in TuringDB to decide which fungal-monitoring problem our open data can actually support. Every fact must come from a record you retrieved in this session — nothing from memory.

TOOLS
- Amass MCP for papers. It indexes PubMed/PMC papers, clinical trials, drugs, human genes, regulatory documents and patents. It does NOT index arXiv preprints or datasets. Search Amass first for every paper; if it has no record, take the metadata from the paper's own page, Crossref or OpenAlex, and set `source` accordingly.
- TuringDB 3.1 Python SDK (pip install 'turingdb>=3.1'). Connect with TuringDB(host="localhost", port=6666); if no server is running, start one with the `turingdb` CLI. Graph name: fungal_evidence.

TURINGDB WRITE RULES (queries fail or silently skip otherwise)
- All writes go inside a change: client.new_change() → write queries → client.query("CHANGE SUBMIT") → client.checkout().
- Create nodes with MERGE keyed on the key property listed first below, so reruns don't duplicate. MERGE rejects null keys.
- After creating nodes, run client.query("COMMIT") before any MATCH … MERGE that adds edges between them. Without it, MATCH finds nothing and the edge is silently not created.
- Batch with UNWIND $rows and pass values as parameters; never format values into the query text.
- One statement per query. No regex. RETURN properties (n.name), not n.
- Property types are global across the graph: use exactly the types below.

SCHEMA (key property first)
- Dataset {name, url, licence, access ("open"|"free_login"|"on_request"|"closed"), open:bool, n_samples:int, year_start:int, year_end:int, spatial_res_m:float, temporal_res_days:float, has_coordinates:bool}
- Modality {name}: satellite_embedding, satellite_optical, satellite_SAR, airborne_hyperspectral, soil_eDNA, air_eDNA, spore_count, phenocam, trait_lookup, field_survey
- Taxon {name, rank, guild, its_resolution ("species"|"genus"|"species_complex")}
- Host {name}
- Outcome {name, type ("ecological"|"crop"|"tree"|"health")}
- Paper {doi, title, year:int, validation_type ("random_split"|"spatial_cv"|"none"), amass_id, source ("amass"|"crossref"|"openalex"|"publisher")}  — key on title if there is no DOI
- Region {name}: England, UK, Europe, USA, Global

EDGES — every edge carries {evidence: "measured"|"modelled"|"hypothesised", source_doi, amass_id, claim}, where claim is a one-sentence paraphrase of what the source says.
(Dataset)-[:USES]->(Modality)
(Dataset)-[:DETECTS {n_positive_samples:int, prevalence:float}]->(Taxon)
(Dataset)-[:COVERS {n_samples_in_region:int}]->(Region) — only regions where the dataset actually has samples; never infer a parent region
(Taxon)-[:ASSOCIATES_WITH]->(Host), (Taxon)-[:DRIVES]->(Outcome), (Host)-[:AFFECTS]->(Outcome)
(Paper)-[:USES]->(Dataset)
(Paper)-[:SUPPORTS {metric, effect_size:float}]->(Taxon) or ->(Outcome)

DATASETS TO ADD
NEON Soil microbe community taxonomy (DP1.10081.002: ITS + 16S taxon tables, 47 US sites, 2016–2024; coordinates via DP1.10086.001; CC BY 4.0; free login + API token); NEON airborne hyperspectral (DP3.30006.002, 1 m); NEON PhenoCam (DP1.00033.001); GlobalFungi v5 (Europe AND North America); GloSED; SPUN Underground Atlas; Forestry England soil eDNA 2023 (EIDC); NFI soil fungi; Global Spore Sampling Project (Zenodo); UK airborne eDNA survey (Tournayre et al. 2025); "Spatiotemporal dynamics in airborne fungi and fungal allergens across the United States" (bioRxiv, Dec 2025; 7 US sites); National Allergy Bureau spore counts (2003–2022); FungalTraits (Modality trait_lookup); Tessera; AlphaEarth Satellite Embedding; OlmoEarth v1.3 embeddings.

PAPERS TO ADD
Young et al. 2026 (arXiv 2604.09818); Van Nuland et al. 2025 Nature; Tournayre et al. 2025 Sci Rep; Ovaskainen et al. 2024 Sci Data; Abrego et al. 2024 Nature; Fisher et al. 2016 Global Change Biology; Chan 2021 (ash dieback remote sensing); Zheng 2018 (yellow rust, Sentinel-2); Feng et al. (Tessera); plus Amass searches for each candidate taxon.

CANDIDATE TAXA
Coccidioides (Valley fever), Alternaria (allergy/asthma; crop leaf spot), Cenococcum geophilum (ectomycorrhizal), Fusarium (head blight; mycotoxins), Hymenoscyphus fraxineus (ash dieback), Ramularia (barley), Leptosphaeria (oilseed rape).

KNOWN TRAPS — record what you find, don't paper over it
- NEON has no air eDNA product (only particulate mass and dust at 6 sites). Do not give NEON a USES edge to air_eDNA.
- ITS amplicons can't separate Fusarium or Alternaria species; set its_resolution accordingly.
- GlobalFungi may already contain NEON samples. Check and record it: duplicates would leak across validation folds.
- FungalTraits labels genera; it is a lookup table, not samples.
- validation_type comes from the methods section. If you can't see the methods, set it null; don't guess.
- For the NEON dataset, fill DETECTS.prevalence and n_positive_samples from results/neon_2023_2024/prevalence.csv in the EcoHack repo (columns prevalence_confident, samples_confident; 4,018 samples, 2023–2024). Leave prevalence null for other datasets unless it was measured.

CLAIMS TO VERIFY (mark each verified / contradicted / not found, with the source)
1. Young et al.: R² ≈ 0.55 for EcM richness from Tessera, random 70/10/20 split, not spatial CV.
2. Van Nuland et al.: random-CV R² ≈ 0.6, but spatial (kNNDM) R² 0.20 for AM richness and 0.28 for EcM.
3. Tournayre et al.: 15 UK PM10 sites, 189 fungal genera, median transport ≈ 18.6 km.
4. Fisher et al.: Landsat phenology separates AM from EcM forests, 77% variance explained.

OUTPUT
1. The graph, submitted to main.
2. amass_log.csv with columns: amass_id, core, query, what you used it for, which nodes/edges it created.
3. open_questions.md listing every null property and every unverified claim.
4. A one-paragraph summary: node and edge counts by label, and how many sources came from Amass vs elsewhere.
```

## Prompt 2: add the human-health layer

```
Extend the fungal_evidence graph in TuringDB with human-health evidence from Amass. Same TuringDB write rules as before. Every node and edge must come from a record you retrieved, with its amass_id.

New labels: Driver {name} (e.g. drought, soil disturbance, warming, fungicide use, spore-season shift); Trial {nct_id, title, phase, status}; Gene {symbol}; Drug {name}; Intervention {name, type ("public_health"|"land_management"|"clinical"|"agricultural")}.
New edges (same evidence/source_doi/amass_id/claim properties): (Driver)-[:INCREASES]->(Taxon); (Driver)-[:OBSERVABLE_BY]->(Modality); (Trial)-[:STUDIES]->(Outcome); (Gene)-[:MODIFIES_RISK]->(Outcome); (Drug)-[:TREATS]->(Outcome); (Intervention)-[:REDUCES]->(Outcome).

For each candidate taxon (Coccidioides, Alternaria, Cenococcum geophilum, Fusarium, Hymenoscyphus fraxineus, Ramularia, Leptosphaeria):
1. BioMedCore: the human-health outcome it drives (e.g. coccidioidomycosis, Alternaria-sensitised asthma, mycotoxin exposure). Add Outcome {type:"health"} and (Taxon)-[:DRIVES]->(Outcome).
2. BioMedCore: which environmental change increases human exposure (Driver → Taxon), and whether that driver is visible from satellite or eDNA (Driver → Modality).
3. TrialCore: trials on that health outcome.
4. GeneCore: human genes that change susceptibility — only if a retrieved paper reports it; link that paper too.
5. DrugCore: treatments. Flag any evidence that agricultural azole fungicides drive resistance to clinical antifungals.
6. "What we could do about it": Interventions with evidence that they reduce the outcome.

Stop a taxon after 6 searches if nothing relevant turns up and record "no health evidence found" — that is a result too.

OUTPUT: a per-taxon table (health outcome, # papers, # trials, # genes, # drugs), and for each taxon the single strongest chain Driver → Taxon → health Outcome → Intervention with the amass_ids along it. Append everything to amass_log.csv.
```

## Prompt 3: score the candidate problems

```
Using the fungal_evidence graph in TuringDB, score these candidate problems separately for the UK ($regions = ["England","UK"]) and the USA ($regions = ["USA"]):
(A) Crop pathogen early warning — Fusarium (wheat), Ramularia (barley), Leptosphaeria (oilseed rape), Alternaria (leaf spot)
(B) Tree pathogen early warning — Hymenoscyphus fraxineus (ash dieback)
(C) Mycorrhizal decline — Cenococcum geophilum and EcM fungi in woodland
(D) Airborne allergenic fungi and asthma — Alternaria
(E) Soil-to-dust human pathogen — Coccidioides (Valley fever)
Out of scope: pharmaceutical bioprospecting, wildfire and other natural disasters (floods, storms). Drought and warming count only as gradual drivers of fungal change.

Pass region and taxon names as parameters. RETURN properties, not nodes. Show every Cypher query you ran.

HARD GATES — failing any one means "not feasible by Sunday" for that region:
G1. ≥1 Dataset with open = true AND has_coordinates = true that DETECTS a relevant taxon and COVERS the region.
G2. That dataset's DETECTS.prevalence ≥ 0.05. If prevalence is null, mark "unverified", not pass.
G3. The taxon's its_resolution supports the rank the problem needs (a species-level problem fails on genus-only resolution).

FOR PROBLEMS THAT PASS, compute:
1. Distinct Modalities across qualifying datasets (exclude trait_lookup).
2. Co-location: ≥1 satellite_embedding Dataset and ≥1 soil_eDNA or air_eDNA Dataset covering the same region with overlapping years (s.year_start <= e.year_end AND e.year_start <= s.year_end). Report the overlapping years.
3. Measured vs modelled vs hypothesised edges on Modality → Dataset → Taxon → Outcome.
4. Papers on that path: spatial_cv vs random_split vs null.
5. Health-chain strength: number of Amass records (papers, trials, genes, drugs) linked to the taxon's health Outcome.
6. UK relevance: does the taxon have measured UK data?

Rank by co-location first, then measured-edge share, then health-chain strength, then UK relevance.

OUTPUT: one ranked table per region with the gate results and the six measures. Recommend ONE problem overall, name the single dataset whose absence would kill it, and say whether its natural funder is public (ARIA, Natural England, NSF) or a paying customer (farmers, agronomists, insurers, health systems), based on the graph's Outcome types.
```

## Prompt 4: red-team the chosen problem

```
Act as a sceptical ARIA reviewer reading our TuringDB graph for the top-ranked problem.

1. Closest existing work: query Paper nodes on the same Taxon/Outcome path. State exactly what they already did and what is genuinely new in ours — especially versus Young et al. 2026 and Van Nuland et al. 2025. Candidate novelties to test: leave-site-out spatial validation; Tessera vs AlphaEarth vs OlmoEarth embeddings under the same validation; air eDNA as a time layer; a pathogen/health target rather than richness. Also check overlap with Echo Labs' published plans and say how we complement them.
2. Every critical-path edge that is "hypothesised", rests on a random_split paper, or is an unverified claim. These are claims we cannot make in the pitch.
3. Scale mismatch: soil cores (<1 m), NEON airborne hyperspectral (1 m), satellite embeddings (10 m), NEON sites (km), air eDNA footprint (median ≈ 18.6 km in the UK survey, preliminary). Propose ONE reconciliation (aggregation, kernel weighting or hierarchical model) we can implement tonight, and say what it costs in sample size.
4. Unintended consequences and ethics (judges score this): false pathogen alerts → unnecessary felling or fungicide use, and fungicide use → azole-resistant Aspergillus in people; health alerts that stigmatise places; data from private land; models used outside the regions they were validated in.
5. Who funds it: one public funder and one paying customer, and which claim each would need us to prove.
6. Three sentences: what we can honestly claim by Sunday 10:00.
```
