# Dino Outpost Browser Reboot Spec

## 1. Decision

The current folders are deprecated for future product work:

- `legacy/threejs-web`
- `unity-test/dino`
- `archives/*`

They may remain as historical reference, but the new game should be built from a clean browser-first codebase. Do not migrate code blindly. Reuse only validated product learnings, visual direction, and isolated ideas.

## 2. Product Summary

**Dino Outpost** is a first-person browser defense shooter where the player holds a remote dinosaur containment outpost against waves of prehistoric threats.

The first product goal is not a large open world. The first goal is a polished, replayable 90-second browser combat slice:

1. Read the battlefield.
2. Aim and scope.
3. Shoot weak points.
4. Stagger or kill dinosaurs.
5. Protect the base until extraction.

The game must run directly in a modern desktop browser with no install step for the player.

## 3. Product Pillars

### Browser Native

The game must be designed for WebGL/WebGPU-era browser delivery from day one. Fast load, predictable controls, visible performance budgets, and no engine workflow that blocks rapid iteration.

### Tactical Clarity

The player should always understand:

- where threats are coming from
- which threat matters most
- whether a shot hit, missed, crit, staggered, or killed
- how close the outpost is to failure

### Jurassic Survival Fantasy

The experience should feel like defending a fragile sci-fi outpost on a dangerous coast or jungle frontier. Even with placeholder art, the mood should carry: rain, warning lights, mud, fences, silhouettes, alarms, tracer fire, weak-point scan UI.

### Small Scope, High Feel

The first version should make one weapon and two dinosaur types feel good before adding more content.

## 4. Target Player Experience

The player opens a URL and lands directly in the playable experience.

The first screen is a mission briefing overlay on top of the live 3D scene. Pressing Start begins the mission immediately.

During play:

- Mouse controls aim.
- Left click fires.
- Right click scopes.
- `R` reloads.
- `Esc` releases pointer lock.
- The HUD shows time, base integrity, wave, ammo, heat/reload, hostiles, target vitals, and weak-point alignment.

A good 90-second run should include:

- 5-10 kills
- at least one close call
- at least one satisfying critical hit
- one heavier dinosaur threat
- a clear win/loss end screen

## 5. MVP Scope

### Required

- Browser-based 3D scene.
- First-person fixed-position defender camera.
- Pointer-lock aiming.
- One primary rifle.
- Hitscan or fast projectile shooting.
- Scope mode with narrower FOV and target scan UI.
- Weak-point critical hit logic.
- Dinosaur spawning from three lanes.
- Two enemy archetypes:
  - fast raptor
  - slow heavy trike or equivalent brute
- Base integrity and failure state.
- 90-second mission timer and success state.
- Restart flow.
- Basic sound effects.
- Lightweight debug/tuning panel gated behind a query parameter.
- Production build command.

### Nice To Have After MVP

- Better dinosaur animation.
- More weapon types.
- Upgrade choices between waves.
- Mobile controls.
- Save progression.
- Leaderboard.
- Full level select.

### Explicit Non-Goals For First Rebuild

- Unity or Unreal dependency.
- Multiplayer.
- Large open world.
- Complex inventory.
- Account system.
- Procedural campaign.
- Asset-heavy art pass before gameplay is proven.

## 6. Recommended Tech Stack

Use a fresh browser app:

- **Language:** TypeScript
- **Build tool:** Vite
- **Renderer:** Three.js
- **Physics:** Rapier only if needed; otherwise start with simple ray/sphere math
- **Audio:** Howler or native Web Audio
- **UI:** HTML/CSS overlay, not React unless UI complexity demands it
- **Testing:** Vitest for pure game logic, Playwright for browser smoke tests
- **Formatting/linting:** Prettier + ESLint

Avoid a framework-heavy start. The game loop, renderer, input, and simulation should stay easy to inspect.

## 7. Proposed Clean Folder Structure

```text
dino-outpost-browser/
  package.json
  index.html
  vite.config.ts
  tsconfig.json
  src/
    main.ts
    app/
      Game.ts
      GameLoop.ts
      config.ts
      types.ts
    data/
      enemies.ts
      waves.ts
      weapons.ts
      tuning.ts
    render/
      createScene.ts
      environment.ts
      enemyMeshes.ts
      weaponView.ts
      effects.ts
    systems/
      InputSystem.ts
      CombatSystem.ts
      EnemySystem.ts
      SpawnSystem.ts
      WeaponSystem.ts
      AudioSystem.ts
      HudSystem.ts
      DebugSystem.ts
    ui/
      hud.ts
      screens.ts
      styles.css
    tests/
      combat.test.ts
      waves.test.ts
  public/
    assets/
      audio/
      models/
      textures/
  docs/
    PRODUCT.md
    TECHNICAL_DESIGN.md
    TUNING.md
    QA_CHECKLIST.md
```

## 8. Core Game Model

### Mission State

```ts
type MissionPhase =
  | "loading"
  | "briefing"
  | "playing"
  | "won"
  | "lost";
```

Core state:

- `phase`
- `elapsedSeconds`
- `missionSeconds`
- `baseIntegrity`
- `kills`
- `waveIndex`
- `activeEnemies`
- `weaponState`
- `currentAimTarget`

### Enemy State

Each enemy should have:

- id
- type
- position
- velocity
- health
- maxHealth
- radius
- speed
- damagePerSecond
- lane
- state: `spawning`, `approaching`, `attacking`, `staggered`, `dead`
- weak-point definition

### Weapon State

Each weapon should have:

- ammo
- magazine size
- reload duration
- fire cooldown
- damage
- critical multiplier
- range
- spread
- recoil
- heat or reload status

## 9. Combat Rules

The first implementation can use hitscan:

1. Camera creates a ray from screen center.
2. Combat system finds closest enemy intersecting the ray.
3. If scoped and aim is close to weak point, apply critical multiplier.
4. Critical hits stagger enemies.
5. Death triggers kill count, VFX, and sound.
6. Misses still show tracer and muzzle feedback.

The player should not need pixel-perfect aim in the first slice. Use generous hit volumes and clear weak-point feedback.

Recommended first tuning:

- raptor health: 55-70
- raptor speed: enough to threaten in 18-25 seconds
- raptor base DPS: low enough to allow recovery
- heavy health: 140-180
- heavy speed: slow but alarming
- rifle damage: 45-55
- weak-point multiplier: 2.0-2.5
- mission length: 90 seconds
- base integrity: 100

## 10. Wave Design

The wave plan should teach the loop before pressure rises:

```text
0-5s: briefing fade, one visible distant raptor
5-15s: first raptor threat
15-30s: two-lane raptor pressure
30-45s: first heavy dinosaur
45-65s: mixed raptor pressure
65-80s: heavy plus flankers
80-90s: final hold
```

Do not spawn enemies inside the base perimeter at mission start.

## 11. Visual Direction

First playable art style:

- stylized low-poly realism
- orange storm sky
- wet mud or coastal sand
- dark jungle silhouettes
- outpost barricade foreground
- warning lights and scan lines
- readable dinosaur silhouettes

The first art pass should prioritize readability over asset fidelity.

Required visual feedback:

- muzzle flash
- tracer line
- hit spark
- critical hit color
- enemy stagger flash
- health bar or target vitals
- base damage flash
- win/loss overlay

## 12. HUD Requirements

HUD must include:

- mission timer
- wave
- base integrity
- kills
- hostiles alive
- ammo
- reload/heat status
- center reticle
- scope overlay
- target name
- target range
- target health
- weak-point alignment state
- temporary notices

HUD should be built as HTML/CSS overlay for fast iteration.

## 13. Browser Requirements

Support first:

- Chrome desktop
- Edge desktop
- Safari desktop if WebGL compatibility holds

Minimum browser behavior:

- canvas resizes with viewport
- no layout overflow at 1280x720
- pointer lock works after user gesture
- `Esc` exits pointer lock
- tab reload returns to briefing
- console has no uncaught runtime errors

## 14. Development Milestones

### Milestone 0: Clean Project

Acceptance:

- Vite TypeScript app boots.
- Three.js renders a non-empty scene.
- `npm run build` passes.
- Browser smoke test opens local dev URL.

### Milestone 1: Playable Shooting Range

Acceptance:

- Player can aim with mouse.
- Left click fires.
- Ammo decreases.
- Tracer and muzzle feedback appear.
- Static dinosaur target can be hit and killed.

### Milestone 2: Moving Threats

Acceptance:

- Enemies spawn from lanes.
- Enemies approach base.
- Base takes damage only when enemies reach attack range.
- Enemies can be killed before reaching base.

### Milestone 3: Full 90-Second Mission

Acceptance:

- Mission starts, plays, wins, loses, and restarts.
- Waves escalate over time.
- First-time player survives at least 25-35 seconds without expert aim.
- Skilled player can win.

### Milestone 4: Feel Pass

Acceptance:

- Scope feels useful.
- Critical hits are obvious.
- Enemy readability is good at distance.
- Audio confirms fire, hit, crit, kill, reload, alarm, win, loss.
- No immediate unfair failure.

### Milestone 5: Browser Delivery

Acceptance:

- Production build works.
- Local preview works.
- Playwright smoke test confirms canvas visible, Start button works, ammo changes after firing.
- Bundle size and load time are recorded.

## 15. QA Checklist

Before calling a build playable:

- `npm install` from a clean checkout works.
- `npm run build` passes.
- `npm run preview` opens the game.
- Start Mission begins the game.
- Pointer lock activates after clicking the canvas.
- Left click fires exactly once for a click and continuously if held.
- Right click scopes.
- `R` reloads.
- Enemy can be killed.
- Enemy damages base only near base.
- Win state is reachable.
- Loss state is reachable.
- Restart works.
- No uncaught console errors.
- 1280x720 screenshot is non-blank and readable.
- 390x844 mobile viewport does not catastrophically overlap, even if mobile controls are not supported yet.

## 16. Documentation To Keep In The New Repo

### `docs/PRODUCT.md`

Contains:

- product vision
- target player
- core loop
- MVP scope
- non-goals
- success criteria

### `docs/TECHNICAL_DESIGN.md`

Contains:

- architecture
- system responsibilities
- data model
- game loop
- render loop
- input model
- browser constraints

### `docs/TUNING.md`

Contains:

- enemy values
- weapon values
- wave timings
- base integrity tuning
- target difficulty
- change log for balance decisions

### `docs/QA_CHECKLIST.md`

Contains:

- manual smoke tests
- browser compatibility checks
- performance checks
- known issues

## 17. Definition Of Done For The Reboot

The reboot is successful when a user can:

1. Clone or open the new folder.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open the local URL.
5. Press Start Mission.
6. Play a complete 90-second mission in the browser.
7. Restart without refreshing.

Anything that does not contribute to that path should wait.

