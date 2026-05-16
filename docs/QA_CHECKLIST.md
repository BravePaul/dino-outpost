# QA Checklist

## Build

- `npm install` completes from a clean checkout.
- `npm run build` passes.
- `npm run dev` opens the game locally.
- `npm run preview` serves the production build.

## Gameplay

- Start Mission hides the briefing overlay.
- Pointer lock activates after the first gameplay click.
- Mouse aim moves the camera.
- Left click fires and reduces ammo.
- Holding left click fires repeatedly.
- Right click scopes.
- `R` reloads.
- Enemies spawn from three lanes.
- Enemies damage the base only near the outpost.
- Weak-point hits while scoped create critical feedback.
- Win, loss, and restart states are reachable.

## Visual

- 1280x720 is non-blank and readable.
- The scene reads as a bright jungle outpost.
- Dinosaurs are visible against the background.
- HUD does not hide the central aiming area.
- Tracers, hit flashes, crits, base damage, win, and loss feedback are visible.

## AI Showcase

- At least five feedback-to-change examples are prepared.
- Each example is implemented through config or CSS first.
- Before/after screenshots are captured for the strongest examples.
