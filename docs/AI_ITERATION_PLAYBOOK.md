# AI Iteration Playbook

This game is being built to prove a non-programmer can drive AI to produce a polished browser game. The process uses **split AI roles** because a single undisciplined agent doing "improve the game" produced unpolished, drifting iterations that undid each other's work.

## Reading Order

Before each iteration, every AI role should read in this order:

1. `ROLE_INDEX.md`
2. Its own role doc under `roles/`
3. `PRODUCT_DIRECTION.md`
4. `VISUAL_DIRECTION.md` + `VISUAL_REFERENCES.md`
5. `INTERACTION_DIRECTION.md`
6. `TECH_CONSTRAINTS.md`
7. `ITERATION_BRIEF.md` (only the active "Current Iteration" section)

## Manual Loop

Run each AI role as a **separate session** (different chat, different Codex run). Sharing a session is what produced the original drift.

1. **Product Owner** (you): one-liner goal — "I want X."
2. **Art Director session**: reads screenshots only, returns ranked issues + suggested fix vector (see `roles/art-director.md`).
3. **Product Owner**: fills `ITERATION_BRIEF.md` from the Art Director's output, or overrides it.
4. **Implementer session**: reads only the brief + named files, makes the minimum diff, appends one line to the history (see `roles/implementer.md`).
5. **QA session**: runs lint/test/build + regression capture, returns a pass/fail table (see `roles/qa.md`).
6. **Product Owner**: opens `test-results/regression/report.html`, judges:
   - **Approve** → `npm run regression:baseline` locks the new floor.
   - **Reject** → revert; archive the attempt in the brief history with `REJECTED`.

**Do not start a new iteration until the previous one is approved or reverted.** The whole structure assumes one in-flight change at a time.

## Autonomous Goal Loop

Use this when the goal prompt explicitly says to reduce human participation.

1. **Goal Owner** (main Codex session): reads the direction docs, sets an iteration budget, and runs the loop without asking the human.
2. **Art Director**: diagnoses the highest-value visual issue from screenshots and references only.
3. **Game Feel Director**: diagnoses the highest-value physics, control, feedback, or readability issue.
4. **Goal Owner**: chooses one issue, writes a narrow `ITERATION_BRIEF.md`, and defines accept/reject conditions.
5. **Implementer**: edits only files named in the brief.
6. **QA**: runs lint/test/build/regression capture/report.
7. **Goal Owner**: accepts or rejects. On accept, it may run `npm run regression:baseline`; on reject, it reverts only its own iteration changes.

The autonomous loop must be bounded. A good default is up to 5 accepted iterations, stopping earlier if the next useful change would require broad redesign, new paid assets, user taste decisions, or if the remaining gap to the reference images is too small to reduce reliably with the current assets and code structure.

## Safe First-Round Edits

When the brief stays small, these usually take a single file edit:

- "Make the jungle brighter" → `visualTheme.lightIntensity`, `skyHorizon`, `fogDensity`
- "Dinosaurs are hard to see" → enemy `bodyColor`, `weakColor`, `weakPointRadius`
- "Rifle feels weak" → weapon `damage`, `recoil`, `tracerIntensity`
- "Too hard" → `baseIntegrity`, enemy `speed`, `damagePerSecond`
- "HUD looks generic" → `hudPrimary` + relevant CSS panel classes

## Boundary

AI roles cannot:

- Author new rigged 3D models or hand-painted textures
- Add multiplayer, account systems, procedural campaigns
- Introduce a framework like React unless the brief explicitly approves it
- Promote a screenshot baseline in manual mode

In autonomous goal mode, only the Goal Owner can promote a screenshot baseline, and only after QA is green and the iteration is accepted.

The Product Owner can:

- Drop in pre-made assets (Quaternius, Poly Haven, paid packs)
- Set aesthetic direction via `VISUAL_REFERENCES.md`
- Override any AI output, reject any iteration
