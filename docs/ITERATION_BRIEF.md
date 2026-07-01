# Iteration Brief

Fill this in before starting an iteration. **One** active brief at a time. After the iteration is approved or rejected, move its summary to `## History` at the bottom and clear the current section.

---

## Current Iteration

**Number:** 09

**Date:** 2026-05-15

**Goal (one sentence):**

> Improve the first-person weapon silhouette so it reads more like a scoped outpost rifle than a blocky placeholder.

**Trigger (which screenshot or playtest moment prompted this):**

> `01-briefing.png`, `02-mission-early.png`, and `03-mission-mid.png` still show the lower-right weapon as a short black block with minimal rifle detail, while `public/reference-images/01-jungle-river-sniper.png`, `02-bright-valley-waterfall-hunt.png`, and `03-outpost-coast-defense-overview.png` all use a scoped rifle/shotgun silhouette to ground the first-person view.

**In scope (files allowed to change):**

- `src/app/Game.ts` — only `createWeaponRig()` procedural weapon geometry/materials.

**Out of scope (do NOT touch):**

- `tests/`
- `playwright.config.ts`
- `src/systems/`
- HUD layout, weapon behavior/tuning, recoil values, ammo logic, enemy behavior/tuning, spawn timing, outpost foreground rails, water/wetland channel, and async GLB asset loading.

**Success check (what makes this pass):**

- In the three regression screenshots, the lower-right weapon has a clearer barrel/scope/receiver silhouette than the previous short block.
- The weapon still stays in the lower-right and does not dominate the center aim lane.
- Ammo HUD and target readability remain unobstructed.

**Reject condition (what makes this fail):**

- Weapon geometry covers the center reticle, ammo HUD, minimap, or target panel.
- The weapon becomes larger or brighter than the current lower-right silhouette.
- New console errors appear during the regression capture.

**Verification:**

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run regression:capture`
- `npm run regression:report` → Goal Owner opens the HTML and judges

---

## History

Append-only. One line per finished iteration.

- 2026-05-12 iter 01: reduced right-side target HUD, repositioned pistol, added pistol sway/recoil/muzzle flash
- 2026-05-13 iter 02: removed mountainside backdrop slabs, kept lower vegetation horizon
- 2026-05-13 iter 03: added contact shadows under enemies, footstep dust, slowed animation playback
- 2026-05-14 iter 04: rejected service pistol + sci-fi gun options; removed visible FPV weapon model
- 2026-05-15 iter 05: ACCEPTED - extended regression capture timeout so all three comparison screenshots are produced reliably
- 2026-05-15 iter 06: ACCEPTED - added a shallow wetland channel and small edge rocks through the center combat lane
- 2026-05-15 iter 07: ACCEPTED - moved Playwright artifacts outside the regression screenshot directory so baselines survive capture runs
- 2026-05-15 iter 08: ACCEPTED - replaced oversized foreground warning blocks with slimmer outpost rail posts and small warning plates
- 2026-05-15 iter 09: ACCEPTED - added scoped rifle geometry details to the first-person weapon silhouette without changing weapon behavior
- 2026-05-16 iter 10: ACCEPTED - added limited player movement, toggle scoping, three switchable weapons, distant varied dinosaurs, mountain backdrop, and clearer color separation
- 2026-05-16 iter 11: ACCEPTED - HUD cohesion sweep: unified panel chrome on mission/target/weapon, tightened target panel (220px), restyled compass and minimap. See docs/OPTIMIZATION_LOG.md §11.
- 2026-05-16 iter 12: ACCEPTED - Briefing polish: stronger DINO OUTPOST title shadow, accent eyebrow line, added control-key cheatsheet (WASD/mouse/R/1-2-3/Esc). See docs/OPTIMIZATION_LOG.md §12.
- 2026-05-16 iter 13: ACCEPTED - Atmosphere: deeper sky top (#3f6a8f), warmer horizon (#dbae7d), fogDensity 0.006→0.013, lightIntensity 1.05→1.12. Distant low-poly is hidden by warm haze; foreground readability preserved. See docs/OPTIMIZATION_LOG.md §13.
- 2026-05-16 iter 14: ACCEPTED - Proximity threat vignette: red edge pulses when any enemy is within 6m of the attack line; wired threatPulseSeconds (was unused) to a new .threat-edge CSS layer. See docs/OPTIMIZATION_LOG.md §14.
- 2026-05-16 iter 15: ACCEPTED - Asset sweep — distant mountain ring (4 mountainside + 2 rock_face GLBs at z=64-96, conservative scale to avoid the iter-02 "giant slab" failure). See docs/OPTIMIZATION_LOG.md §15.
- 2026-05-16 iter 16: ACCEPTED - Asset sweep — vegetation variety: reduced procedural lollipop canopy from 34 to 18, added 12 Pine.glb instances from stylized-nature-megakit forming a forest ring at z=22-58. See docs/OPTIMIZATION_LOG.md §16.
- 2026-05-16 iter 17: ACCEPTED - Asset sweep — water reflection: MirrorTexture on the largest mid-field wetland pool, brighter water material across the channel, subtle alpha breathing. See docs/OPTIMIZATION_LOG.md §17.
- 2026-05-16 iter 18: ACCEPTED - Asset sweep — outpost identity: replaced procedural metal rails with Fence.glb perimeter; added survival-pack and medieval-pack props (Radio, Gas Can, Wood Log stack, First Aid Kit, Tent, Wooden Torch, Barrel, Crate) around the player position. See docs/OPTIMIZATION_LOG.md §18.
- 2026-05-16 iter 19: ACCEPTED - Polish — replaced the 2 "white banner" rock_face GLBs with 2 additional mountainside.glb fillers at z=90-92; the natural rock silhouette reads less like a floating sign. See docs/OPTIMIZATION_LOG.md §19.
- 2026-05-16 iter 20: ACCEPTED - Polish — added 3 back-of-player mountainside.glb at z=-34/-38/-52 (rotated PI±0.4) so a 180° in-game rotation no longer reveals an empty back horizon. Not visible in forward-facing regression screenshots; verified by code review. See docs/OPTIMIZATION_LOG.md §20.
- 2026-05-16 iter 21: ACCEPTED - Polish — removed the stacked Wood Log placement (y=0.34, depended on unknown GLB height to land flush); replaced with 4 logs in a horizontal row at y=0.04. Eliminates float-risk under camera angle shifts. See docs/OPTIMIZATION_LOG.md §21.
- 2026-05-16 iter 22: ACCEPTED - Combat feedback — damage popups: hit impacts spawn floating numbers (yellow + larger for crits) at the world impact point projected to screen. Animates rise + fade over 0.88s. See docs/OPTIMIZATION_LOG.md §22.
- 2026-05-16 iter 23: ACCEPTED - Combat feedback — tracer punch: thicker core beam (0.028→0.045 crit/0.014→0.028 normal), warmer color, plus a new outer halo tube for visible glow. Lines and tubes both brighter via tracerIntensity x1.4. See docs/OPTIMIZATION_LOG.md §23.
- 2026-05-16 iter 24: ACCEPTED - Visual variation — 10 dark damp ground patches scattered across the playfield, suggesting rain/humidity and breaking up the uniform brown ground texture. See docs/OPTIMIZATION_LOG.md §24.
- 2026-05-16 iter 25: ACCEPTED - Gameplay readability — minimap blips now reflect real enemy positions, rotated to player yaw (forward = up), with separate styling for heavy enemies. Replaces 3 hardcoded fake blips. See docs/OPTIMIZATION_LOG.md §25.
- 2026-05-16 iter 26: ACCEPTED - Gameplay readability — next-wave indicator in mission-panel ("Next: <enemy> Xs"), driven by expandedWaves and mission.elapsedSeconds. Shows "Final hold" when all events spawned. See docs/OPTIMIZATION_LOG.md §26.
- 2026-05-16 iter 27: ACCEPTED - Gameplay readability — enemy health bar above the targeted enemy, visible only while scoped. Color-graded (green/yellow/red). 3D-to-screen projection of (enemy.x, height+0.4, enemy.z). See docs/OPTIMIZATION_LOG.md §27.
- 2026-05-16 iter 28: ACCEPTED - Combat feedback — hit burst polish: added a lingering smoke puff (260ms normal / 380ms crit) that grows and rises after impact, plus more sparks (7→11 / 12→18) and a bigger flash sphere/ring. See docs/OPTIMIZATION_LOG.md §28.
- 2026-05-17 iter 29: ACCEPTED - Movement feel — velocity smoothing (asymmetric accel/decel), step-cycle bob (vertical + half-rate lateral sway), and lateral camera roll on strafe (~2.3° max). See docs/OPTIMIZATION_LOG.md §29.
- 2026-05-17 iter 30: ACCEPTED - Camera shake on combat events — per-shot shake scaled to weapon (shotgun > marksman > carbine, halved when scoped); kill shake stronger for crits and heavy enemies. New triggerCameraShake helper supports event stacking. See docs/OPTIMIZATION_LOG.md §30.
- 2026-05-17 iter 31: ACCEPTED - Realistic GLB weapons — replaced procedural box-rifle with CC0/CC-BY rifle GLBs from Poly Pizza (Quaternius Ultimate Guns + Kar98k). Three rifles wired to carbine/marksman/shotgun. Inner+outer TransformNode hierarchy isolates bounds-centering from rotation/scale. See docs/OPTIMIZATION_LOG.md §31.
