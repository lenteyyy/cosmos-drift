# Code and release review — 2026-10-21

## Paper Shaders and power controls

Rechecked application modules, input handling, rendering and audio lifecycles, catalogue/build scripts, tests, dependencies and release contents. Paper Shaders 0.0.82 supplies Perlin Noise and Warp GLSL. The adapter uses the existing Three.js WebGL2 context and one bounded render target; it does not create a ShaderMount, second WebGL canvas or extra animation loop. Radial coordinates are computed per fragment and avoid an angular seam. Apache-2.0 license and upstream NOTICE accompany both source and production output.

The scene uses one manual RAF scheduler targeting 60 FPS at both quality levels, including idle animation. It does not use a frame-limiting timer or run a second R3F render loop. Deadline accumulation is tested on 60/120/144/165 Hz displays and skips missed deadlines without catch-up bursts. Dynamic resolution reduces DPR under frame pressure and recovers gradually after ten seconds of headroom. Low quality reduces particles, pixel density, noise octaves and swirl passes. Background shader pixel budgets are 129600/32400, updated at most 20/12 times per second independently of the main scene. Holding full throttle no longer emits redundant store updates and React renders.

Pausing background animations freezes cosmetic time and particles while preserving driving, navigation and transit. Idle paused scenes stop rendering; UI interactions can request a single frame. Hidden, unfocused and duplicate same-origin tabs stop rendering and telemetry, suspend their AudioContext and cancel music wall timers. Resume scheduling uses the frozen audio clock. A pending audio load cannot restart the background playlist loop. An active black-hole capture remains committed through standby and resumes when the window returns.

Only the existing localhost 5174 service was retained for browser QA; the temporary second tab used to verify ownership was closed. Other projects and their services were left alone. The launcher now accepts an explicit port and keeps PID, lock and log files per port. Same-origin coordination does not extend to different ports or browser profiles.

Verification: all 44 tests passed, covering the existing flight/travel flows plus nine new RAF pacing, adaptive resolution, power-policy and audio-lifecycle regressions. Strict TypeScript, 1315-object validation and production bundling passed. npm audit reported zero known vulnerabilities. The offline catalogue rebuild passed and changed only generation timestamps, which were excluded from this update. The public build contains ten original WAV scores, no private MP3/system-voice recordings, and the Paper license notices.

Browser evidence: one WebGL canvas; no console warnings/errors for Perlin or Warp. After replacing the timer scheduler, seven seconds of low-quality driving and 6.5 seconds of standard-quality driving both reported 60 FPS, at DPR 0.8 and 1.2 respectively. A standard-quality black-hole transit also reported 60 FPS; Space/M/P did not cancel or pause capture. Paused idle rendering and shader counters stayed fixed in the power-control test. In a second same-origin tab, the old page became inactive and its frame counter remained at 3192; closing that tab and pressing M resumed the original page. Quality and animation preferences survived a new page load. M/I toggles and keyboard driving worked. Automatic Gaia BH1 traversal reached NGC 55 and, on a later run, IC 1289; the travel shader displayed successfully. Updated screenshots are in `preview.png` and `paper-warp.png`.

These are functional and scheduling checks, not battery measurements. Hardware, browser scheduling and display refresh rate affect actual frame rates and power use. The existing large Three.js vendor chunk still produces Vite's size advisory.

## Initial publication review — 2026-10-20

Scope: all application and engine modules, React views, styles, input/lifecycle handlers, data/audio generation, validators, launchers, dependency lockfile, tests and publication assets. Review targets the actual playable flow: load local catalogue → render/pick a body → change speed or select a destination → travel/black-hole capture → arrive and change soundtrack.

## Corrected before publication

Malformed or wrongly typed browser storage previously reached application state unchecked. Preference restoration now validates types and ranges, filters and deduplicates discovery records, and tolerates disabled or invalid JSON storage.

The paused map previously resized and redrew its canvas every animation frame; parent telemetry also rerendered its long catalogue. It now redraws on relevant state/size changes with a ResizeObserver, resets its transform correctly, and is memoized against unrelated parent updates.

The original audio list required private MP3 and system-voice recordings. Vite now detects optional local files, the public build uses ten included original scores and browser English narration, and the UI reflects the actual playlist count. Missing private media is never fetched by the public build.

The release exporter copies an explicit project allowlist and excludes private recordings and songs. The tracked-file scanner rejects credentials, personal absolute paths, runtime/build output, private media and symbolic links. Unrelated projects, local logs, browser saves and dependency folders are excluded.

## Verification

35 automated tests cover the full scale-band route, spatial queries, coordinate precision, 0.01-pixel continuous speed input, lowest-speed motion, boost/autopilot speed ceilings, speed-dependent particles/engine sound, target picking, safe arrivals, swept black-hole capture, random exits, noncancellable capture, English-only voice selection, storage corruption and optional-media-free checkout.

TypeScript runs with strict mode and unused-local checking. Catalogue validation checks 1315 entries, source references, bilingual fields, coordinates, IDs and count thresholds. Production bundling and the complete tests are run again from the isolated public source checkout. npm audit reported zero known dependency vulnerabilities at review time; this is a point-in-time database result.

Browser regression covers initial WebGL rendering, catalogue search, M/I toggling, flight speed/particles, music settings, quality switching and automatic black-hole travel. The public build is checked separately to ensure the playlist contains ten original tracks and no request is made for excluded private audio.

Public-checkout evidence: clean `npm ci` succeeded; all 35 tests, strict types, catalogue validation and production build passed. Offline rebuilding reproduced the identical catalogue object hash `147bfc8087b19f60a93a2986d7130db0d4fd2e3c876f436007df137fc9c45ddc`. The browser displayed ten original tracks and live English narration, completed Gaia BH1 → IC 380 automatically, and reported no console warnings or errors. The built output contains ten WAV scores and zero MP3/system-voice recordings. The tracked-file release scan passed on 74 files.

The visual model is deliberately approximate. Automated checks and browser regression reduce known failure risk; they are not a proof of mathematical or physical correctness. The sizeable Three.js bundle is loaded locally; no analytics, accounts, payments, remote runtime astronomy requests or backend secrets are required.
