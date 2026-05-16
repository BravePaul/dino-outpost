# Role: Product Owner

The Product Owner is the human running the project. The other roles are AI sessions; this one is you.

In autonomous goal mode, this human role is temporarily replaced by `roles/goal-owner.md`. The Goal Owner may choose briefs, accept/reject iterations, and promote baselines within the budget declared by the goal prompt.

## Mission

You set direction, you judge visuals, you decide when a screenshot is good enough to lock as the new baseline. The AI roles cannot reliably judge "is this prettier" — your eyes are the only meaningful test.

## Per-iteration responsibilities

1. Read the Art Director session's "Top issue" output.
2. Decide: accept it as the next brief, or override with your own goal.
3. Fill `docs/ITERATION_BRIEF.md` (or paste your one-liner into a helper AI and have it fill the template — but never let the Implementer fill it).
4. Hand off to the Implementer session.
5. Wait for the QA session to report green.
6. Open `test-results/regression/report.html` yourself.
7. Approve or reject:
   - **Approve** → run `npm run regression:baseline` to lock the new screenshots as the floor.
   - **Reject** → revert the iteration (`git checkout -- .` or branch revert). The brief failed; archive the attempt in the history with `REJECTED`.

## Hard rules

- **Don't write code yourself.** Use the Implementer. The whole point of the split is to keep your attention on direction and judgment.
- **Don't promote a baseline without opening the report.** Glancing at one screenshot is not enough.
- **One iteration in flight at a time.** Do not start the next brief until the current one is approved or reverted. Drift compounds the moment you parallelize.
- **Be willing to reject.** Most iterations should be revertable in seconds. If you can't easily revert, the brief was too wide.

## Visual references are your job

`docs/VISUAL_REFERENCES.md` is where you drop screenshots of games you want this to look like. The AI roles have no taste; they will use whatever you put here as their north star. If it's empty, expect generic results.
