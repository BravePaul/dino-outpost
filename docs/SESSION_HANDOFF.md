# Dino Outpost Session Handoff

Last updated: 2026-05-14 Asia/Shanghai, after iteration 04

## Product Goal

Make Dino Outpost into a likable, polished browser-playable dinosaur defense shooter. The target quality is a refined web demo: clean visuals, readable combat, satisfying shooting feedback, and stable browser performance.

## Working Agreement

- Iterate in small loops.
- Codex should autonomously edit, run, play, screenshot, judge, and continue.
- Report only when blocked, when a product tradeoff is needed, or when a meaningful milestone is reached.
- Keep this file updated when context is around halfway full or before long multi-step work.
- Before each product iteration, read `docs/ROLE_INDEX.md` and follow the role docs instead of treating product, art, interaction, engineering, and QA as one blended task.

## Current Runtime

- Project path: `/Users/bilibili/code/dino-outpost`
- Dev server: `http://127.0.0.1:5173/`
- Usual commands:
  - `npm run lint`
  - `npm test`
  - `npm run build`
  - `npm run smoke`
- Browser/Computer Use is available and should be used for visual playtesting.

## Current State

- Vite + TypeScript + Babylon.js browser game.
- Core files:
  - `src/app/Game.ts`
  - `src/app/config.ts`
  - `src/app/types.ts`
  - `src/systems/simulation.ts`
  - `src/ui/styles.css`
- Enemies now include six local Quaternius dinosaur models:
  - Velociraptor
  - Parasaurolophus
  - T-Rex
  - Triceratops
  - Stegosaurus
  - Apatosaurus
- Poly Haven upgrade assets were downloaded to:
  - `public/assets/models/polyhaven/game-upgrade`
- The weapon model is currently Poly Haven `service_pistol`.
- Iteration 01 completed:
  - reduced right-side target/scope HUD size
  - reduced damage overlay intensity
  - resized/repositioned pistol
  - added pistol sway, recoil kick, and muzzle flash
- Iteration 02 completed:
  - removed the large `mountainside.glb` backdrop placements from the combat view
  - kept lower rock-face/vegetation boundaries so the horizon no longer shows giant floating stone slabs
- Iteration 03 completed:
  - added contact shadows under enemies
  - added light footstep dust for approaching enemies
  - slowed dinosaur animation playback by species/body type to reduce sliding
- Iteration 04 completed:
  - rejected the Poly Haven service pistol as physically wrong for this game
  - tested Quaternius sci-fi gun options; current models were unsuitable for first-person view without looking edge-on or like a floating block
  - removed the visible first-person gun model until a proper FPS weapon asset is found
  - retained shooting via reticle, tracer, muzzle flash, hit feedback, and ammo HUD

## Recent User Feedback

- User dislikes rough placeholder geometry.
- Game should not visibly show pure boxes/triangles/cylinders as world art.
- Goal is not merely to add assets, but to become visually polished and fun.
- User provided a screenshot showing issues:
  - large/red damage overlay feels dirty
  - scope/weapon panel blocks too much
  - distant rock/mountain backdrop feels awkward
  - terrain still feels flat
  - dinosaur presence and combat feedback need improvement

## Known Issues To Improve Next

Priority order:

1. Find or create a physically correct first-person weapon asset; do not re-add the rejected pistol/flat sci-fi gun models.
2. Convert the biome from open grassland toward a humid fenced tropical enclosure/research base.
3. Improve terrain/backdrop: the horizon is cleaner, but the open sky and flat ground still need more atmosphere and depth.
4. Improve enemy presence: near-base attack feedback and stronger weak-point readability.
5. Add a more deliberate wave/upgrade loop once the core view feels polished.

## Verification Expectations

Each iteration should:

1. Run lint/tests/build/smoke.
2. Open the game in browser or Computer Use.
3. Start mission.
4. Play enough to shoot and see at least one dinosaur approach.
5. Capture screenshot under `test-results/`.
6. Check browser console for application warnings/errors.

## Recovery Instructions For New Session

1. Read this file first.
2. Confirm `http://127.0.0.1:5173/` is running; if not, run `npm run dev -- --host 127.0.0.1`.
3. Inspect the latest screenshot in `test-results/` if available.
4. Latest useful screenshots:
  - `test-results/iteration-00-baseline.png`
  - `test-results/iteration-01-weapon-hud.png`
  - `test-results/iteration-02-horizon-clean.png`
  - `test-results/iteration-04-no-bad-gun.png`
5. Continue with the next small iteration from "Known Issues To Improve Next".
