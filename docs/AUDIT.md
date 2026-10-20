# Code and release review — 2026-10-20

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
