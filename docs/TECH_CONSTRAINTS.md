# Tech Constraints

## Stack

- TypeScript
- Vite
- Babylon.js
- HTML/CSS for HUD
- Vitest for game logic
- Playwright for browser smoke tests

## Rules

- Keep game logic separate from rendering where practical.
- Prefer small, local edits over large rewrites.
- Keep config-driven tuning in `src/app/config.ts`.
- Keep pure simulation rules in `src/systems/simulation.ts`.
- Preserve production buildability after every meaningful change.

## Performance

- Avoid unnecessary runtime allocations in the render loop.
- Avoid loading new heavy assets unless they materially improve the scene.
- Watch bundle size when adding code or assets.

## Safety

- Do not introduce a framework unless the UI genuinely needs it.
- Do not rely on manual browser steps as the only verification.

