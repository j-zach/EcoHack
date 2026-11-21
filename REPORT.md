# EcoHack report

Working report for the AI track: which fungal-monitoring problem our open data can support, and how we get the data. Last updated Saturday 21 November 2026. Judging is Sunday 22 November, 10:00.

The prompts for the evidence graph are in [`prompts/evidence_graph_prompts.md`](prompts/evidence_graph_prompts.md).

## Summary

- **Status:** the evidence graph currently recommends **woodland ectomycorrhizal (EcM) decline in England**, with Forestry England soil eDNA as the ground truth (see [Evidence graph status](#evidence-graph-status)).
- **NEON (US):** NEON has taxon-level soil fungal tables at 47 sites, which the hackathon pack lacks (it only has alpha diversity). Downloads now need a free NEON account and API token.
- **Satellite:** Tessera, AlphaEarth and OlmoEarth all publish free annual 10 m embeddings. Comparing them under the same spatial validation is cheap and hasn't been done for fungi.
- **Amass:** it indexes biomedical sources only, so it suits the health link rather than the fungal ecology. The Amass prize wants the ecosystem → human-health chain, with the records each step rests on.
- **Air eDNA:** NEON has none. The air layer has to come from the Global Spore Sampling Project, a US airborne-fungi study, or the UK survey authors.
- **Out of scope:** wildfire and other natural-disaster framings, and pharmaceutical bioprospecting. Drought and warming stay in only as gradual drivers of fungal change, not as disasters.

## Data access (checked 21 Nov 2026)

### NEON

Source: NEON's API catalogue and the [NEON Data API docs](https://github.com/NEONScience/neon-data-api).

| Product | Code | Sites | Months available | Use |
|---|---|---|---|---|
| Soil microbe community taxonomy | DP1.10081.002 | 47 | 2016-04 to 2024-11 | ITS (fungi) and 16S taxon tables, ready to use |
| Soil microbe marker gene sequences | DP1.10108.001 | 47 | 2013-06 to 2025-11 | Raw ITS/16S sequences, DNA extraction table |
| Soil microbe metagenome sequences | DP1.10107.001 | 47 | 2013-06 to 2025-07 | Shotgun metagenomes |
| Soil physical and chemical properties, periodic | DP1.10086.001 | 47 | | Core coordinates, pH, moisture, chemistry |
| Root biomass and chemistry, periodic | DP1.10067.001 | 47 | 2016-07 to 2025-10 | Host roots |
| Spectrometer reflectance, bidirectional mosaic | DP3.30006.002 | 56 | 2016-06 to 2026-09 | Airborne hyperspectral at 1 m |
| Phenology images | DP1.00033.001 | 47 | 2016-01 to 2026-11 | PhenoCam |
| Particulate mass | DP1.00101.001 | 6 | 2017-10 to 2023-10 | PM only, no DNA |
| Dust and particulate size distribution | DP1.00017.001 | 6 | 2016-08 to 2025-11 | No DNA |

- **Sampling design:** 10 plots per site, 3 soil cores per plot per sampling round, 1 to 3 rounds a year at peak greenness, top 30 cm, organic and mineral layers separately.
- **Joining tables:** cores are in `sls_soilCoreCollection` (DP1.10086.001), keyed by `geneticSampleID`. Each has one or more DNA extractions in `mmg_soilDnaExtraction` (DP1.10108.001), keyed by `dnaSampleID`. The fungal taxon tables (DP1.10081.002) come in the **expanded** package, one CSV per `dnaSampleID`. The basic package has only metadata and download links.
- **Validation:** the 47 sites are natural clusters, so leave-one-site-out is a ready-made spatial cross-validation.
- **No air eDNA.** The two air products measure particles, not DNA.
- **Access:** since 30 June 2026, the `/data` download endpoints need an API token. Get one from My Account at [data.neonscience.org](https://data.neonscience.org/myaccount) and send it as the `X-API-Token` header. Never commit the token.
- **Licence:** CC BY 4.0, changed from CC0. Attribution is required; commercial use is allowed.

### Satellite embeddings

| | Tessera | AlphaEarth | OlmoEarth v1.3 |
|---|---|---|---|
| Dimensions | 128 | 64 | 64 or 128 |
| Resolution | 10 m | 10 m | 10 m |
| Years | 2017 to 2025 | 2017 to 2024 | 2023 to 2025 worldwide; earlier years for some countries only |
| Access | `geotessera` | Earth Engine account (free for research and nonprofit) | Anonymous Zarr download from Source Cooperative |
| Licence | | CC BY 4.0 | OlmoEarth Artifact License |

- OlmoEarth has no point-lookup helper. Convert each longitude/latitude to its UTM zone row and column, then read that pixel. See the [export docs](https://docs.olmoearth.allenai.org/exporting-embeddings/). The OlmoEarth Platform needs an access request, so don't depend on it.
- All three overlap with NEON's taxonomy tables in **2023 to 2024**. Older NEON samples lose OlmoEarth unless it covers the US for those years.
- The hackathon pack's coordinates are rounded to 1 km, so its embeddings must be averaged over the 1 km cell (see the README).

### Air eDNA alternatives

- Global Spore Sampling Project (Ovaskainen et al. 2024, Sci Data) and Abrego et al. 2024 (Nature). Data on Zenodo, doi:10.5281/zenodo.10444737.
- [Spatiotemporal dynamics in airborne fungi and fungal allergens across the United States](https://www.biorxiv.org/content/10.64898/2025.12.23.696190.full.pdf) (bioRxiv, Dec 2025): 7 US sites.
- National Allergy Bureau spore counts, 2003 to 2022 ([paper](https://par.nsf.gov/biblio/10621162)). These are counts by spore type, not DNA, and the access terms are unchecked.
- UK airborne eDNA survey (Tournayre et al. 2025, Sci Rep): 15 UK sites. The raw data isn't deposited, so email the authors.

### Amass

- **Coverage:** PubMed/PMC papers (43M+), clinical trials (1.2M+), drugs, human genes, FDA/EMA approvals and patents. arXiv preprints and datasets are not included, so Young et al. 2026 and Tessera are not in Amass.
- **Tools:** `search_amass_<core>_records` and `get_amass_<core>_record`, where the core is `biomedcore`, `trialcore`, `genecore`, `drugcore`, `regulatorycore` or `patentcore`.
- **Credits:** Amass says questions asked through Claude don't use the $300 credits; only API calls from code do.
- **Prize:** for the team that best uses human, genetic or molecular data to show an ecosystem change becoming a human-health change, and what could be done about it. Teams must show which records their tool read and how it used them. That is why the prompts log an Amass record ID on every edge.

### TuringDB (3.1) rules that break naive prompts

- Every write must run inside a change: `client.new_change()`, then the writes, then `CHANGE SUBMIT`, then `client.checkout()`. A `CREATE` outside a change fails.
- Nodes created earlier in a change are invisible to `MATCH` until `COMMIT`. A `MATCH … CREATE` edge query then creates nothing, silently.
- Each property name has one type across the whole graph.
- One statement per query, no regex, and `RETURN n` returns an ID rather than the properties.

## Candidate species

| Species | Impact | NEON soil data | Human-health records (Amass) | UK relevance |
|---|---|---|---|---|
| *Coccidioides* (Valley fever) | Human disease; range spreading with climate | Risky: a 2023 California survey found it in rodent burrows but not farm soil | Very strong (trials, drugs, human genes) | None |
| *Alternaria* | Allergy and asthma; crop leaf spot | Likely common | Strong | Yes |
| *Cenococcum geophilum* | Most widespread EcM fungus; drought indicator | Likely at forest sites | Almost none | Yes |
| *Fusarium* (head blight) | Crop losses and mycotoxins | ITS can't separate species; few NEON sites are farmland | Moderate | Yes |
| *Hymenoscyphus fraxineus* (ash dieback) | Kills UK ash | Not in North America | None | Strong |

- ITS amplicons identify *Alternaria* and *Fusarium* only to genus, so any claim about them is genus-level.
- **Pending:** the share of NEON samples containing each candidate. A taxon found in under about 5% of samples can't support a model by Sunday. This is gate G2 in Prompt 3.

## Evidence graph status

These results come from the team's local TuringDB graph, built with the original Prompts 1 and 2. That code isn't in this repo yet, and the numbers weren't re-checked for this report.

- **Graph:** 61 nodes and 98 edges, each tagged measured, modelled or hypothesised.
- **Recommendation:** B, woodland EcM decline. It is the only problem with satellite and eDNA data over England in overlapping years. It is also the only one with both a random-split paper (Young et al., R² 0.55) and a spatial-CV paper (SPUN, R² 0.28).
- **Forestry England soil eDNA 2023:**
  - All 656 samples have latitude and longitude, and 558 join to the fungal table at sample level.
  - EcM genera are widespread: *Russula* in 236 samples, *Lactarius* in 214, *Tomentella* in 160.
  - Pathogens are thin. *H. fraxineus* is in 3 samples at one site, and the *Ramularia* and *Leptosphaeria* hits are non-crop species.
- **Overlap with prior work:** B overlaps Young et al.'s core claim. Our novelty has to come from spatial validation, England ground truth, the guild-balance target, and the three-embedding comparison.

The revised prompts add the US and NEON, a human-health layer for the Amass prize, and hard gates that include detection rate. Rerunning them rebuilds the graph.

## Research or startup

- **Who pays:** whoever loses money when the fungus spreads.
  - Crop disease: farmers, agronomists and insurers. A startup can work.
  - Human health: public bodies (CDC, UKHSA, NHS), which buy slowly.
  - Mycorrhizal biodiversity: a public good, funded by ARIA or government.
- **Who owns the data:** the monitoring networks are public infrastructure. NEON is funded by the US National Science Foundation and the UK air-quality samplers belong to Defra. Echo Labs is ARIA-funded and non-profit.
- **Suggested pitch:** an open measurement layer funded like research, complementing Echo Labs, plus one slide naming a single paying customer for a later spin-out.

## Ethics notes for the pitch

- False crop-disease alerts lead to extra fungicide spraying. That spraying drives azole resistance in *Aspergillus fumigatus*, a fungus that causes serious human infections.
- False tree-disease alerts lead to unnecessary felling.
- Health alerts can stigmatise places.
- Models used outside the regions they were validated in will mislead.

## Open items

- [ ] NEON API token, then the detection-rate check for the candidate species.
- [ ] Rerun the revised prompts 1 to 4 against the graph.
- [ ] Email Clare and Littlefair for the UK air eDNA ASV table.
- [ ] Decide whether the local graph code joins this repo.
- [ ] Confirm the judging panel; earlier notes list Echo Labs as a partner, not a judge.

## Sources

- [NEON Data API docs](https://github.com/NEONScience/neon-data-api)
- [NEON login and licence change](https://www.neonscience.org/impact/observatory-blog/logins-required-and-data-licensing-updated)
- [OlmoEarth v1.3](https://allenai.org/blog/olmoearth-v1-3)
- [AlphaEarth Satellite Embedding](https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_SATELLITE_EMBEDDING_V1_ANNUAL)
- [Amass for EcoHack](https://amass.tech/ecohack-london) and [pricing](https://platform.amass.tech/documentation/getting-started/pricing)
- [TuringDB docs](https://docs.turingdb.ai)
- [Global Spore Sampling Project](https://par.nsf.gov/biblio/10556092) and [Abrego et al. 2024](https://par.nsf.gov/biblio/10556090)
- [*Coccidioides* soil community study](https://pubmed.ncbi.nlm.nih.gov/40278129/)
