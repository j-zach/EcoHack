# Spora

Fungal health maps at 10 m, from a handful of soil samples and free satellite data

EcoHack London 2026 · AI track

[Website] · [Contact email]

---

# Forests run on fungi we can't see

**13 Gt CO2e a year**
Carbon that plants pass to fungi underground. That's 36% of fossil-fuel emissions.

**1 km**
The sharpest fungal map we have. Satellites see the canopy, not the soil, and over 90% of fungal species have no name.

**£14.8bn**
What one fungal disease, ash dieback, will cost Britain. Problems below ground show up only once the canopy is dying.

---

# Why now

- **Free 10 m satellite embeddings** for every year since 2017 (Tessera)
- **Open fungal DNA labels**, including 656 Forestry England soil samples (2023) and 4,018 NEON samples across the US (2023–24)
- **Cheap sequencing**: about $45–62 per sample at a university lab. Fieldwork, not the lab, is now the expensive part

---

# Spora: fungal health from orbit and a few soil samples

Our mission: make the life in the soil as easy to monitor as tree cover.

1. **Read** the land from 10 m satellite embeddings
2. **Learn** from the soil DNA samples you already have
3. **Map** fungal health at 10 m, with an honest uncertainty layer
4. **Plan** your next samples where the model is least sure

---

# Check this out: a forest the model never saw

A Forestry England ecologist asks: *Where are the tree-root fungi doing well at Neroche, and where should we sample next?*

- Spora trains on 20 other sites and maps Neroche at 10 m
- It checks the map against 50 real soil samples: rank agreement 0.41, mean error 6 taxa
- It labels the result **"Moderate: use as a prior"**
- It picks 6 validation plots spread across low, mid and high predictions

**[Live demo]**

---

# Tested on forests the model never saw

| Test (546 samples, 21 English sites) | R² |
|---|---|
| Predicting sites left out of training | **0.42** |
| Same model on a random split, the figure most studies report | 0.58 |
| Habitat recorded on a site visit, without satellite | 0.38 |
| Woodland sites only, left out of training | 0.20 |

**Where to sample next:** with 10 samplers, guided placement found 22–42% more species than a grid or random placement (real tropical habitat, simulated fungi).

Satellite data alone does as well as a site visit, and a little better. The bottleneck is labelled samples.

---

# Who it's for

Spora helps forest managers and restoration funders spend fieldwork where it counts, and **measure** soil recovery instead of assuming it.

| Who | Today | With Spora |
|---|---|---|
| Forest and estate managers | One-off surveys: 656 samples for all of England | A 10 m map for each site, plus a sampling plan |
| Restoration and nature-finance programmes | Soil recovery is assumed | Fungal recovery is measured |
| Government and environment agencies | Biodiversity reporting with almost no soil data | A national fungal monitoring layer |
| eDNA labs and Earth-observation firms | Results only at the points sampled | Maps built from their samples |

---

# Next: a sampler that reads the air every week

- **Mock-up:** a passive airborne eDNA sampler that fills a sealed cartridge each week and runs 12 weeks on solar power
- **Why:** 64% of the change in airborne fungi happens week to week (Global Spore Sampling Project, 47 sites). Annual surveys and annual satellite maps miss it
- **How:** Spora's model decides where each sampler goes
- **The moat:** the hardware stays open. What's hard to copy is the dated, located, consented DNA record it builds

---

# How we're different

| | What they give | Spora |
|---|---|---|
| Global fungal atlases | 1 km maps | **10 m maps** |
| eDNA survey services | Results only at the points sampled | **Fills the gaps between samples** |
| Satellite nature analytics | Trees and canopy | **Life below the canopy** |
| Research models | Scored on random splits, which flatter results | **Scored on unseen sites, ships uncertainty, and tells you where to sample next** |

---

# Team

**[Name]**, ML lead
Built the satellite × soil-DNA model and the unseen-site tests

**[Name]**, [Title]
Built the 3D sampler and landscape simulation

**[Name]**, [Title]
[One line: why you]

[Affiliation logos]

---

# What's next

| When | Milestone | Pass mark |
|---|---|---|
| 90 days | Benchmark against the 1 km atlas on open UK and US labels | Threshold set in advance. If we miss it, we stop |
| 6 months | 10-site sampler pilot, $15k–45k | Measured cost per sample and cartridge survival |
| 12 months | First paying customer | Before any custom hardware |

**Our ask:** [funding / pilot partner / data access]

---

# Thank you

Spora: see the network under every forest

[Website] · [Contact email]

Data: Forestry England survey via UKCEH (OGL v3), NEON (CC BY 4.0), Tessera (CC BY 4.0), Global Spore Sampling Project (CC BY 4.0)
