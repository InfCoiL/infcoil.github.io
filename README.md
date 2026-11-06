# InfCoiL project website

Public website: https://infcoil.github.io/

This repository contains the independent static project page. Code release is pending and can be updated independently. The current code
checkout remains separate; the public page will link it once anonymously accessible.

GitHub Pages: Deploy from a branch → gh-pages → /(root).
No build step is required. Local preview: `python serve.py --port 8768 --directory .`.

Long transport recordings use the S=2 epoch-500 planner with C45k controller.
Each stops after 10 frames with pelvis XY / object XYZ errors below 0.3 m and
object speed below 0.2 m/s. Display smoothing is unchanged; raw replay is included.
These selected examples are not a new benchmark result. Earlier videos remain
available. The MuJoCo sandbox runs object physics, not learned-policy inference.

See assets/v2/long-motion-provenance.json for recording metadata and
assets/v2/motions.json for source hashes. Library licenses are under vendor/.

## Minimal presentation

White single-column academic layout: title and authors, two transport videos,
method and framework, full Table 1, collapsed earlier comparisons, and BibTeX.
The 3D/MuJoCo viewer is a separate page. No build tools or external fonts.

Editable files: index.html, styles.css, app.js and playground.css.
The paper, all 40 table values, author metadata and existing media were preserved.
Historical clips remain distinct from the final C→P→C quantitative benchmark.
Verification is recorded in verification.json; asset hashes in asset-manifest.json.
