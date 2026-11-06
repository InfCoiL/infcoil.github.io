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
