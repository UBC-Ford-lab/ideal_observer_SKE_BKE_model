# Ideal observer CT resolution calculator

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live demo](https://img.shields.io/badge/Live%20demo-open%20%E2%86%92-blue)](https://ubc-ford-lab.github.io/ideal_observer_SKE_BKE_model/)

**→ Try it: [ubc-ford-lab.github.io/ideal_observer_SKE_BKE_model](https://ubc-ford-lab.github.io/ideal_observer_SKE_BKE_model/)**

A small interactive page that estimates the theoretical resolution limit of a CT scanner from its photon statistics and scan geometry. The result is a reconstruction-independent upper bound — no FDK, no SIRT, no neural reconstruction can do better than this.

Hope this is useful to you! Let me know if you have any concern regarding my methodology.

## What it does

- Plug in your scanner parameters (N₀, μ_bg, L, N_θ, pixel pitch)
- Pick a contrast in HU
- See the minimum detectable disc diameter and the corresponding spatial frequency limit
- Optional: upload dark / bright / two air projections (TIFF) and have the page measure N₀ for you (plus show the projection power spectrum vs noise floor)

Full derivation is right there on the page.

## Run it locally

```bash
npm install
npm run dev
```

Then open `http://localhost:5173/ideal_observer_SKE_BKE_model/`.

## Deploy

```bash
npm run deploy
```

Pushes the build to `gh-pages`.

## For AI agents

There's an `llms.txt`, `llms-full.txt`, and `formulas.json` at the deploy root. If you're an agent landing here to compute values, start with `llms.txt`.

## Citation

If you use this in your work, I'd appreciate a citation. GitHub will show a "Cite this repository" button in the sidebar (it reads [`CITATION.cff`](CITATION.cff)) with APA and BibTeX ready to copy.

BibTeX:

```bibtex
@software{wiegmann_ideal_observer_2026,
  author       = {Wiegmann, Falk L. and Ford, Nancy L.},
  title        = {Ideal observer {CT} resolution calculator},
  year         = {2026},
  version      = {1.0.0},
  url          = {https://github.com/UBC-Ford-lab/ideal_observer_SKE_BKE_model},
  license      = {MIT}
}
```

## Credits

Falk L. Wiegmann & Nancy L. Ford — University of British Columbia, 2026.
MIT licensed — see [LICENSE](LICENSE).
