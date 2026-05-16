# QA Review

Use this checklist after every meaningful iteration.

## Build And Runtime

- `npm run lint` passes.
- `npm test` passes.
- `npm run build` passes.
- The game opens in the browser without console errors.

## Gameplay

- Start Mission enters play cleanly.
- Pointer lock behaves correctly.
- Firing changes ammo and produces feedback.
- Reloading works.
- Enemies spawn and move as intended.
- Base damage, win, and loss states are reachable.

## Visual Read

- The first screen looks like a real game, not a prototype shell.
- The scene is readable at 1280x720.
- The HUD does not block the center of aim.
- Threats, hits, and weak points are distinguishable at a glance.

## Change Discipline

- The iteration stays focused on one or two goals.
- The result is judged from the player view, not only the code diff.
- Any new asset or effect earns its screen space.

