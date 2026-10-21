# Licenses and attribution

Original source code, documentation, generated visual assets and the ten procedurally composed scores are MIT licensed; see LICENSE. The score generator uses sine waves, generated noise and original note patterns, with no borrowed recordings or samples.

The Lenteyyy logo is a project identity mark supplied by Lenteyyy. Its inclusion identifies this project and does not grant rights to impersonate Lenteyyy or use the mark as another project's branding. Logo rights are reserved by its owner.

## Paper Shaders

`@paper-design/shaders` 0.0.82, Copyright 2026 Paper. Source: https://github.com/paper-design/shaders ; documentation: https://shaders.paper.design/ . Licensed under Apache-2.0; the upstream license and notice are preserved in `LICENSES/Paper-Shaders-Apache-2.0.txt` and `LICENSES/Paper-Shaders-NOTICE.txt`.

`src/engine/paper-background.ts` adapts the exported Perlin Noise and Warp GLSL programs for Three.js RawShaderMaterial, replacing the version directive and adjusting coordinates for nebula scale and seamless radial travel. These adaptations are identified here; the original upstream notice remains intact. No Paper ShaderMount or separate WebGL context is created.

## Astronomical catalogue

`public/data/universe-catalog.json` is an adapted compilation released under CC BY-SA 4.0. HYG and OpenNGC snapshots retain that same license. A copy is in `LICENSES/CC-BY-SA-4.0.txt`; individual sources, retrieval dates, snapshot hashes and entry counts are in `public/data/sources.json`. Changes include selection, unit/frame conversion, approximate cosmological distances and rewritten bilingual descriptions. This does not license source code under CC BY-SA or imply source endorsement.

HYG Stellar Database v4.1: David Nash / Astronexus, using Hipparcos, Yale Bright Star and Gliese catalogues. Upstream: https://github.com/astronexus/HYG-Database . License: CC BY-SA 4.0.

OpenNGC: Mattia Verga. Upstream: https://github.com/mattiaverga/OpenNGC . License: CC BY-SA 4.0. This work acknowledges NASA/IPAC NED (JPL/Caltech under contract with NASA), HyperLEDA, SIMBAD (CDS, Strasbourg), HEASARC and Harold Corwin's NGC/IC work. Source fields remain in the retained snapshot.

NASA Exoplanet Archive / PSCompPars: operated by Caltech under contract with NASA; DOI 10.26133/NEA13. The game uses published factual measurements and retains archive attribution.

Measured Redshifts of Abell Clusters: H. Andernach (1991), ASP Conference Series 15, 279; Abell, Corwin & Olowin (1989); CDS VII/165A, distributed by CDS/HEASARC. Only unflagged measured redshifts are used. Cluster boundaries are schematic.

Rounded solar-system, black-hole and large-scale structure facts acknowledge NASA Science, ESO, SIMBAD, the Event Horizon Telescope Collaboration, NASA/IPAC NED and the cited scientific literature. Their names and logos are not used as endorsements; no EHT/ESO imagery is included.

## Earth texture

`public/textures/earth.jpg`: NASA Blue Marble / Reto Stöckli, obtained from the WebGL Earth repository (https://github.com/turban/webgl-earth). NASA attribution is retained. This factual planetary imagery is separate from the code license.

## Optional private audio

The public repository does not contain Cornfield Chase, End Of The World Sun or Supermoon MP3 files. It also excludes macOS Samantha system-voice recordings. These are neither licensed by this project nor necessary to run it. If files are installed locally, the build detects only the recognized filenames; the default public build includes ten original scores and browser-provided English speech.

Apple's macOS software license limits public sharing and redistribution of System Voice recordings: https://www.apple.com/legal/sla/docs/macOSSequoia.pdf , section 2F. Use browser/OS voices only under their provider's terms; no synthesized recordings are redistributed here.

JavaScript dependencies retain their own licenses in their installed packages. They are resolved by `package-lock.json`; dependency source and `node_modules` are not vendored into this repository.
