# Spora: 5-minute script (6 slides)

About 700 words, roughly 140 words a minute. Text in [brackets] is an action or something to fill in. Lines marked *(cut if short)* can go if you're running long.

---

## Slide 1. The problem (0:00 – 0:50)

Every forest runs on a network you can't see. Tree roots are wrapped in fungi that trade water and nutrients for sugar. Plants pass about 13 billion tonnes of CO2-equivalent a year into them, equal to a third of fossil-fuel emissions.

When that network fails, the forest fails with it. One fungus, ash dieback, will cost Britain £14.8 billion. Hundreds of species of insects, lichens and birds live on ash trees, so when the trees go, their habitat goes with them.

And we find out too late. Satellites see the canopy, not the soil. The best fungal map on Earth has a one-kilometre pixel. A soil DNA sample costs $45 to $60 in the lab before anyone sets foot in a forest, so England's national survey is 656 samples, taken once. We're managing ecosystems with almost no data on what holds them together.

## Slide 2. Is the science real? (0:50 – 1:35)

Before building anything, we checked the science. We used Amass to pull the peer-reviewed literature and built an evidence graph in TuringDB.

[Show the graph.] Each node is a fungus, a tree, a habitat or an outcome, and every edge links back to the paper it came from: [N] papers, [N] links. [Point at the strongest chain.] The strongest chain runs from tree-root fungi to tree health to woodland habitat.

The data to test it is open: Forestry England soil DNA, 4,000 samples from the US NEON network, and free 10-metre satellite embeddings from Tessera. A 2026 study showed satellites can predict these fungi at 10 metres, but it scored itself on a random split. Testing on forests the model has never seen is the gap we set out to close.

## Slide 3. Our solution (1:35 – 2:05)

Spora is an AI diagnostics and analytics platform for life in the soil.

It reads the land from 10-metre satellite embeddings. It learns from the soil samples you already have. It maps fungal health across the whole landscape, with an honest uncertainty layer. And it tells you where to sample next.

Software comes first. Hardware comes later: a passive air sampler, which I'll show you at the end of the demo.

## Slide 4. Demo (2:05 – 3:35)

[Open the Spora platform demo and press Play.]

This is a Forestry England district ecologist at Neroche, a forest in Somerset. The question is: where are the tree-root fungi doing well, and where should we sample next?

Spora pulls the satellite embeddings for the site and paints a 10-metre map. The important part is that the model has never seen Neroche. It was trained on 20 other forests.

Now we check it against Neroche's 50 real soil samples. Rank agreement is 0.41, and the average error is about six taxa. So Spora doesn't oversell the result. It labels this map "moderate: use as a prior".

[Point at the right-hand panel.] This panel shows how far to trust it. Tested on forests it hasn't seen, the model scores 0.42. On a random split, the test most papers use, it would score 0.58. We show the harder number.

Finally, it proposes six validation plots, spread across low, middle and high predictions, so the next field day tells you as much as possible.

[Switch to the sampler showcase.] This is where we're heading: a passive air sampler that collects spores in a sealed cartridge each week, for 12 weeks on solar power. In global spore data, 64% of the variation in airborne fungi happens week to week, and annual maps miss it. Spora decides where each sampler goes.

## Slide 5. Feasibility, competitors, funding (3:35 – 4:35)

Is it feasible? The software works today on open data. The limits are real, though. Inside woodland the score drops to 0.20, so more labelled samples matter more than a better model. The sampler is a mock-up and hasn't been tested in the field. *(cut if short)*

On competitors: global atlases map at one kilometre. eDNA survey firms give you results only at the points you sampled. Satellite analytics see the canopy. Spora fills the gaps between samples, at 10 metres, and tells you how far to trust each map.

On funding: this is a measurement layer that serves the public good, so it fits ARIA's [opportunity space]. [One line on why it fits.] Our first milestone, at 90 days, is a benchmark against the one-kilometre atlas, with a pass mark set in advance. If we miss it, we stop. Next comes a 10-site sampler pilot at $15,000 to $45,000, then a first paying customer, a forest or restoration manager, within 12 months.

## Slide 6. Wrap-up (4:35 – 5:00)

Forests run on fungi we can't see. Spora makes them visible at 10 metres, tested on forests it has never seen, and honest about where it's unsure.

We're asking for [funding / a pilot partner / data access]. Thank you.

---

### Before you present

- **Fill in:** the graph counts on slide 2, the ARIA opportunity space and why it fits on slide 5, and the ask on slide 6.
- **Check one figure:** "hundreds of species live on ash" is deliberately vague. If you want a number, confirm it from the JNCC ash-associated species report first.
- **Demo setup:** the platform demo loads its map online, so keep a screenshot ready. The sampler showcase (`package/index.html`) works offline.
- **Timing:** practise the demo on its own. If it runs past 1:30, cut the cut-if-short line on slide 5 and the half-sentence about the 2026 study on slide 2.
