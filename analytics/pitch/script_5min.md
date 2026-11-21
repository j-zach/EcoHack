# Spora: 5-minute script (6 slides)

About 640 spoken words. The order runs problem, solution, scientific validity, feasibility, future direction, close. Text in [brackets] is an action or a gap to fill.

---

## 1. Problem (0:00 – 0:35)

Six in ten trees on Earth depend on one group of fungi. Ectomycorrhizal fungi wrap around tree roots and supply water and nutrients in exchange for sugar.

In Britain, those trees include our native oaks. 2,300 species live on oak, and 326 of them live nowhere else.

That partnership is under strain. Nitrogen pollution exceeds safe limits on 84% of the UK's sensitive habitats, and in Europe's oak forests, more nitrogen means fewer of these fungi. Only 7% of our native woodland is in good ecological condition, and more than half of woodland plants and animals are in decline.

Fungi decide whether a forest thrives or collapses, and we can't see them. The best fungal map has a one-kilometre pixel, and England's national soil survey is 656 samples, taken once.

## 2. Solution (0:35 – 1:50)

Spora is an AI platform that maps fungal health across a landscape at 10 metres.

It combines free satellite embeddings with the soil DNA samples that already exist. It infers where fungal communities are thriving or failing, shows how confident it is, and tells you where to sample next.

[Demo, about 45 seconds.] Here's the landscape. The colour shows predicted fungal prosperity. This layer is the model's uncertainty. And these are the sites it recommends sampling next, chosen where a new sample tells us the most.

## 3. Scientific validity (1:50 – 2:50)

Is it real? We checked it two ways.

First, the literature. Using Amass, we pulled the peer-reviewed evidence and built a graph in TuringDB. [Show the graph.] Every link from fungus to tree health to habitat traces back to a paper: [N] papers, [N] links. Plants pass about 13 billion tonnes of CO2-equivalent a year to these fungi, equal to a third of fossil-fuel emissions.

Second, the data. We trained on Forestry England's 2023 soil DNA survey: 546 samples across 21 sites, paired with 10-metre Tessera satellite embeddings. Tested on forests the model never saw, it scores an R² of 0.42. A random split, which is what most papers report, would give 0.58. We report the harder number. From orbit alone, the model matches what a habitat survey on the ground can tell you.

## 4. Feasibility (2:50 – 3:50)

The software runs today on open data, and the inputs are cheap. The satellite embeddings are free, and a soil DNA sample costs $45 to $62 in a university lab. The limit is labelled data: inside woodland, the score drops to 0.20.

On competitors: global atlases map at one kilometre. eDNA firms report only the points they sampled. Satellite analytics see the canopy, not the soil. We fill the space between samples at 10 metres and say how far to trust each map.

On funding: this is a measurement layer that serves the public good, and it fits ARIA's [opportunity space]. Our first milestone is a 90-day benchmark against the one-kilometre atlas, with a pass mark set in advance. If we miss it, we stop.

## 5. Future direction: hardware (3:50 – 4:40)

Our edge comes from the next step, which is hardware: a passive air sampler. It fills a sealed cartridge each week, runs for 12 weeks on solar power, and goes wherever the model is least sure.

Why do we need it? Today's soil DNA is coarse. In the Forestry England data, fewer than 4 in 10 fungal sequences can even be named to a genus. And 64% of the change in airborne fungi happens week to week, which no annual survey sees.

Weekly, dated, species-level records from fixed sites give us proprietary data that nobody else has. With that data, we can go beyond broad groups like ectomycorrhizal fungi and measure the ecological impact of individual species: which root partners keep an oak wood healthy, which decomposers recycle its nutrients, and which pathogens threaten it. The pilot is 10 sites, for $15,000 to $45,000.

## 6. Close (4:40 – 5:00)

Six in ten trees depend on these fungi. 2,300 species depend on our oaks. Only 7% of our native woodland is in good health, and the fungi holding it together are invisible today.

Spora maps them now. With our samplers, it will tell you which species matter, where, and when.

We're asking for [funding / a pilot partner / data access]. Thank you.

---

### Fill in before presenting

- **TuringDB graph:** the paper and link counts on slide 3.
- **Slide 4:** which ARIA opportunity space this fits, and one line on why.
- **Slide 6:** the ask.

### Sources for the figures

| Figure | Source |
|---|---|
| EcM trees are about 60% of tree stems on Earth | [Steidinger et al. 2019, Nature](https://eprints.whiterose.ac.uk/146845/1/Steidinger_et_al_mainMS_AAM_Nature_submitted2018.pdf) |
| 2,300 species associated with British oak, 326 found only on oak | [Mitchell et al. 2019, Biological Conservation](https://www.hutton.ac.uk/node/15973) (James Hutton Institute) |
| Nutrient nitrogen exceeds critical loads on 84% of UK sensitive habitat area (2021) | [JNCC UK Biodiversity Indicator B5a](https://jncc.gov.uk/our-work/ukbi-b5a-air-pollution) (all sensitive habitats, not woodland alone) |
| More nitrogen, fewer EcM fungi in European oak forests | [Suz et al. 2014, Molecular Ecology](https://www.pubmed.gov/25277863/); [van der Linde et al. 2018, Nature](https://www.imperial.ac.uk/news/186573/pollution-hits-fungi-that-nourish-european) |
| 7% of UK native woodland in good condition; over half of woodland species declining | [Woodland Trust, State of the UK's Woods and Trees 2021](https://woodlandtrust.org.uk/publications/2021/04/state-of-uk-woods-and-trees-2021) |
| 1 km best global fungal map | Van Nuland et al. 2025, Nature |
| 13 Gt CO2e/yr to mycorrhizal fungi | [Hawkins et al. 2023, Current Biology](https://eprints.whiterose.ac.uk/199952) |
| 546 samples, 21 sites; R² 0.42 / 0.58 / 0.20 | `analytics/master_table/README.md` |
| Fewer than 4 in 10 sequences named to genus (1,994 of 5,270) | `analytics/master_table/README.md` |
| $45–62 per sample | Oregon State CQLS fees; `analytics/report/REPORT.md` → Costs |
| 64% week-to-week variation | Global Spore Sampling Project analysis in `README.md` |
