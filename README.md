# Dino Outpost

A first-person browser defense shooter against waves of dinosaurs. The game is a 90-second tactical slice — read the battlefield, scope, hit weak points, hold the line.

Built as a showcase of AI-driven iteration on a browser game. TypeScript + Vite + Babylon.js, no engine workflow, runs in any modern desktop browser.

## Quick start

```bash
npm install
npm run dev
```

Open the local URL Vite prints. Click **Start Mission**.

Controls: `WASD` move · mouse aim · `LMB` fire · `RMB` scope · `R` reload · `1/2/3` swap weapon · `Esc` release pointer.

## Project layout

```
src/
  app/         game loop, config, types
  systems/     pure simulation rules (tested with vitest)
  ui/          HUD CSS
tests/
  simulation.test.ts
  playwright/  smoke + regression screenshot captures
docs/
  PRODUCT_DIRECTION.md       what the game is / isn't
  VISUAL_DIRECTION.md        target look
  VISUAL_REFERENCES.md       concrete reference images
  ROLE_INDEX.md              split AI roles for iteration
  ITERATION_BRIEF.md         per-iteration brief + history
  OPTIMIZATION_LOG.md        full write-ups of every system change
  ASSETS.md                  how to re-download the binary assets
  CODEX_PROMPT.md            self-contained Codex goal for autonomous iteration
scripts/
  regression-compare.mjs     side-by-side baseline vs current screenshots
```

## Scripts

```bash
npm run dev            # vite dev server
npm run build          # tsc + vite build
npm test               # vitest (game logic)
npm run smoke          # playwright smoke (canvas visible, ammo decreases on fire)
npm run regression:capture    # capture briefing + mission early/mid screenshots
npm run regression:report     # generate HTML side-by-side (baseline vs current)
npm run regression:baseline   # promote current to baseline (after visual review)
npm run lint           # eslint
```

## How this was built

The repo was iterated via a **split-role AI workflow** (`docs/ROLE_INDEX.md`):

- **Art Director** — diagnoses visual issues from screenshots only, no code access
- **Implementer** — narrow code edits per a filled `ITERATION_BRIEF.md`
- **QA** — mechanical checks + screenshot capture
- **Product Owner** (human) — judges, locks new baselines

Each accepted change has a one-line entry in `docs/ITERATION_BRIEF.md`'s history and a full write-up in `docs/OPTIMIZATION_LOG.md` (§11–§28 cover the most recent sweep).

## Assets

Large binary assets (3D models, ground textures) are excluded from this repo to keep clone size manageable. See `docs/ASSETS.md` for download sources (all CC0 from Quaternius and Poly Haven). The game will run without them, but the scene will look bare.

## Credits

Bundled / linked 3D assets are CC0 unless noted:

- Dinosaur models, nature kit, survival pack, medieval village pack, sci-fi gun pack — [Quaternius](https://quaternius.com/) (CC0)
- Habitat plants, rocks, structures, HDR skybox — [Poly Haven](https://polyhaven.com/) (CC0)
- Sniper rifle GLBs (carbine / marksman) — Quaternius Ultimate Guns Pack via [Poly Pizza](https://poly.pizza/) (CC0)
- **Kar98k shotgun model — [AdamKokrito](https://poly.pizza/m/ntijptIGIw) on Poly Pizza (CC-BY 3.0)**

## License

Code is open for personal / educational reference. No commercial use of bundled reference images.
