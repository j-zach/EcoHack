# Spora pitch: Gamma setup, script and Q&A

This is the companion to [`gamma_deck.md`](gamma_deck.md). The deck follows the Nucleate hackathon template: Title, Problem, Solution, Competition, Team, Thank you. The 2.5-minute Solution block is split over several cards. Spora is pitched as **AI diagnostics and analytics software**, with the **airborne sampler as a hardware mock-up** for future data collection.

## Putting it into Gamma

1. In Gamma, choose **Create new → Paste in text**, then paste the whole of `gamma_deck.md`.
2. Choose **Presentation** and split cards on `---` (card-by-card). That gives 12 cards.
3. Set text content to **Preserve**. Condense cuts the numbers and Generate pads the text.
4. Paste the instructions below into the additional-instructions box.
5. Pick a dark theme, then swap in the visuals listed under [Visuals per card](#visuals-per-card).

Gamma renames its options now and then, so the labels may differ slightly.

### Additional instructions for Gamma

```text
Dark theme: black backgrounds, white text. Accent colours taken from glowing fungal mycelium: electric blue, violet, magenta, orange. Clean sans-serif font. Keep my wording exactly; do not add sentences, emoji or filler. Show the three bold numbers on the Problem card as large stat callouts. Render tables as tables. Images: glowing mycelium networks on black, satellite views of forest canopy, soil cross-sections with roots and fungal threads. No stock photos of people, no cartoon mushrooms.
```

### Visuals per card

| # | Card | Visual |
|---|---|---|
| 1 | Spora | The Spora logo (the glowing mushroom from the template's title slide), centred on black |
| 2 | Problem | The template's mycelium image as a half-bleed, with the three numbers as stat callouts |
| 3 | Why now | Three icon rows: satellite, DNA, lab flask |
| 4 | Solution | A four-step loop: Read → Learn → Map → Plan, with Plan feeding back to Learn |
| 5 | Demo | A screenshot of the Neroche map from the Spora platform demo (`analytics/demo_frontend/index.html?autoplay`) |
| 6 | Evidence | A bar chart of the four R² values with 0.42 highlighted, or keep the table |
| 7 | Who it's for | The table as is |
| 8 | Sampler | A still from `media/sampler.gif` (the 3D sampler in the forest) |
| 9 | Competition | The table with the Spora column highlighted |
| 10 | Team | Three headshots |
| 11 | What's next | A three-step timeline |
| 12 | Thank you | The logo again |

The logo and mycelium images are inside the template .pptx. To pull them out: in PowerPoint, right-click → Save as Picture. Or drag the slide images into Gamma.

## Script (5 minutes)

The template gives Problem 1:00, Solution 2:30, Competition 0:30 and Team 1:00. These are prompts to jog your memory, not lines to learn.

| Time | Card | Cue |
|---|---|---|
| 0:00 | Spora | Name, one line: "fungal health maps at 10 m." |
| 0:05 | Problem | **Value:** plants feed fungi a third of fossil emissions' worth of carbon a year. **Blind spot:** our best map is 1 km and most species have no name. **Cost:** one fungus, ash dieback, £14.8bn in Britain, and we notice only when trees die. |
| 1:00 | Why now | 10 m embeddings are free. Thousands of labelled soil samples are open. Lab cost is about $50 a sample, so fieldwork is the real cost. |
| 1:15 | Solution | Mission line, then the four verbs: read, learn, map, plan. |
| 1:35 | Demo | Live: Neroche. "The model never saw this forest." Map, then the 50-sample check, then the "use as a prior" label, then the 6 plots. Keep it to 50 seconds. |
| 2:25 | Evidence | "We report the hard number." 0.42 on unseen sites against the 0.58 most papers would show. Satellite alone matches a site visit. Then the simulation: guided placement finds more species with 10 samplers. |
| 2:55 | Who it's for | Read the bold line, then point at the first row: forest managers. |
| 3:15 | Sampler | "Next is hardware." 64% of the change is week to week, the sampler catches it, and Spora tells it where to go. |
| 3:30 | Competition | One line per row. End on "we tell you how far to trust it." |
| 4:00 | Team | Each person in one sentence: what they built this weekend and why them. |
| 4:40 | What's next | 90-day pass mark, "if we miss it, we stop", then the ask. |
| 4:55 | Thank you | Close on the tagline. |

The Spora platform demo loads its basemap and Leaflet from the internet. Keep the Neroche screenshot on card 5 in case the venue Wi-Fi fails. The sampler showcase (`package/index.html`) works offline.

The template's speaking notes: one mic distance, as few speaker switches as possible, breathe, and don't worry about the "umm"s.

## Where this deck differs from `main`

The README and showcase on `main` (commit 7e2c345) pitch the idea as "Spore Atlas" in a different shape. Settle these as a team before you go on stage.

| Topic | `main` README / showcase | This deck | If the team prefers `main` |
|---|---|---|---|
| Lead product | Sampler first, tropical forests | Software first (Neroche demo, UK data); sampler as future hardware, per the brief | Swap cards 5 and 8 and open the demo on the sampler tour |
| Pharma | "Pharma revenue keeps it running" | **Decided 21 Nov: pharma stays out.** Focus is health, crop yield and biodiversity | Update the showcase's Pitch tab and README "Who pays" to match, or don't show that tab |
| Name | Spore Atlas (working name) | Spora, matching the template and logo | Replace the name throughout |
| Satellite | AlphaEarth and TESSERA | Tessera only. The 64% week-to-week figure needs no satellite data, so it's safe either way | — |
| Cost per sample | "About $4 chemistry, ~$150–500 commercial" | $45–62 at a university sequencing lab (Oregon State external rates), fieldwork excluded | Use one figure. Both say the same thing: fieldwork is the cost |
| Pilot | 10-site **tropical** pilot | "10-site sampler pilot", no place named | Add "tropical" to card 11 |

## Likely questions

- **"R² 0.42 isn't high."** It's measured on forests the model never saw. The same model scores 0.58 on a random split, which is how most published models are scored. We show the harder number.
- **"What does the satellite add over habitat?"** Habitat recorded on a site visit gets 0.38. Tessera gets 0.42 from orbit, for every 10 m pixel, including places nobody has visited. Most of today's skill is habitat. More labelled samples is the bottleneck, and that's what the sampler is for.
- **"Inside woodland it's only 0.20."** Agreed. Once tree cover is a given, the signal is weaker. It's why the demo labels Neroche "moderate: use as a prior" rather than "truth".
- **"Didn't someone already map these fungi at 10 m?"** Young et al. (2026 preprint) did, at R² 0.55 on a random split. We test on unseen sites, run it as a tool and plan the next samples. Global 1 km atlases (SPUN, *Nature* 2025) are our baseline, not our competitor.
- **"Did satellite help everywhere?"** No. On 66 restored and ancient UK woodlands with coordinates rounded to 1 km, soil pH beat satellite (R² 0.21 vs 0.08). Precise, dated sample locations matter.
- **"Can it detect pathogens?"** Not yet. 70% of Forestry England samples contain a plant-pathogen taxon, but the median pathogen share is 0.1% of reads. In 4,018 NEON samples there was no confident species-level ash dieback, *Aspergillus fumigatus* or *Fusarium graminearum*. We start with tree-root (EcM) fungi.
- **"Research or company?"** Both, in sequence. Grants (ARIA, UKRI) fund the open data layer and the pilot, and forest and restoration managers are the first customers. The pass mark is set before the pilot.
- **"What can go wrong?"** A false "nothing here" could justify clearing land, so uncertainty is always shown. Rare-species locations are blurred. False disease alerts lead to felling or fungicide spraying. Every map states where it was validated.

## Sources for every number

| Figure | Source |
|---|---|
| 13.1 Gt CO2e/yr to mycorrhizal fungi, ~36% of fossil CO2 (a flow, not storage) | [Hawkins et al. 2023, *Current Biology*](https://eprints.whiterose.ac.uk/199952) |
| 1 km global fungal map; 9.5% of hotspots protected | [Van Nuland et al. 2025, *Nature*](https://www.nature.com/articles/s41586-025-09277-4) |
| ~155,000 of 2–3 million fungal species named (over 90% unnamed) | [Fungal diversity estimates, *Current Biology* 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC11687528) |
| Ash dieback £14.8bn in Britain (over 100 years; £7.6bn in the first 10) | [Hill et al. 2019, *Current Biology*](https://ox.ac.uk/node/1520363) |
| Tessera 10 m embeddings, 2017 onwards | [TESSERA](https://github.com/ucam-eo/tessera) |
| 656 Forestry England soil eDNA samples, 2023 | [EIDC doi:10.5285/07c32201-c374-4432-a00b-832dedee571e](https://doi.org/10.5285/07c32201-c374-4432-a00b-832dedee571e) (OGL v3) |
| 4,018 NEON samples, 31 sites, 2023–24 | Our count: `analytics/report/results/neon_2023_2024/` |
| $45–62 lab cost per sample | [Oregon State CQLS fees](https://cqls.oregonstate.edu/cqls-service-fees); breakdown in `analytics/report/REPORT.md` → Costs |
| R² 0.42 / 0.58 / 0.38 / 0.20 | `analytics/master_table/README.md` (546 samples, 21 sites) |
| Neroche: ρ 0.41, mean error 6.2 taxa, 50 samples, 6 plots | `analytics/demo_frontend/README.md` |
| 22–42% more species with 10 guided samplers (159 vs 112, 155 vs 127, 166 vs 134) | `README.md` → Simulation (simulated fungi on real TESSERA habitat) |
| 64% of airborne richness variation is week to week | `README.md` → Real data: airborne fungal DNA at 47 sites ([GSSP data](https://www.nature.com/articles/s41597-024-03410-0)) |
| Sampler: weekly sealed cartridge, 12 weeks on solar | Design spec of the 3D mock-up in `showcase/src/sampler/`; untested in the field |
| Pilot $15k–45k; 90-day / 6-month / 12-month pass marks | `README.md` → Roadmap |
