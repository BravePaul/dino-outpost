# Role Index

Dino Outpost uses split AI roles to prevent context blending. There are two supported workflows:

- **Manual loop**: a human Product Owner approves each iteration.
- **Autonomous goal loop**: an AI Goal Owner runs a bounded set of iterations without asking the human.

When sub-agents are available, run read-only diagnosis and implementation as separate agents. When they are not available, the same Codex session may execute the roles sequentially, but it must keep each role's inputs, permissions, and output boundaries separate.

## Manual Loop

1. **Product Owner** (human) — sets the brief, judges the result, locks the baseline
2. **Art Director** (AI) — diagnoses visual issues from screenshots only
3. **Implementer** (AI) — writes the minimum code change for the brief
4. **QA** (AI) — runs mechanical checks + captures regression screenshots

## Autonomous Goal Loop

1. **Goal Owner** (AI main session) — chooses the next issue, writes the brief, accepts/rejects, manages the iteration budget
2. **Art Director** (AI read-only role) — diagnoses visual issues from screenshots and references
3. **Game Feel Director** (AI read-only role) — diagnoses physical believability, controls, feedback, and player readability
4. **Implementer** (AI worker role) — writes the minimum code change for the brief
5. **QA** (AI read-only role) — runs mechanical checks + captures regression screenshots

Each role has a dedicated doc with its scope, inputs, and forbidden actions:

- `roles/product-owner.md`
- `roles/goal-owner.md`
- `roles/art-director.md`
- `roles/game-feel-director.md`
- `roles/implementer.md`
- `roles/qa.md`

## Shared Context (read by all AI roles)

- `PRODUCT_DIRECTION.md` — what the game is and isn't
- `VISUAL_DIRECTION.md` — target look + things to avoid
- `VISUAL_REFERENCES.md` — concrete reference images
- `INTERACTION_DIRECTION.md` — control feel
- `TECH_CONSTRAINTS.md` — stack + coding rules
- `QA_REVIEW.md` — manual checklist
- `ITERATION_BRIEF.md` — current iteration only
- `OPTIMIZATION_LOG.md` — detailed write-up of system-level changes (read this before redoing past work)

## Why split roles

A single AI doing "improve visuals" tends to:

- Self-grade ("looks better!") without evidence
- Drift across iterations — removing things it added last round
- Mix code and judgment, making regressions invisible

Splitting roles forces:

- Art Director cannot defend its own code → screenshot judgment stays honest
- Game Feel Director cannot patch its own diagnosis → physical/control issues stay concrete
- Implementer cannot expand scope → diffs stay minimal
- QA cannot rationalize a failure → mechanical checks stay mechanical
- Product Owner or autonomous Goal Owner is the only role that promotes a baseline → no drift
