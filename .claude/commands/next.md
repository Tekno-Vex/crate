---
description: Build the next unchecked milestone item
argument-hint: [optional: specific item text]
---

1. Open `docs/MILESTONES.md`. Target: $ARGUMENTS — or, if empty, the first unchecked item in the
   earliest unfinished milestone.
2. If it depends on an unrun spike, say so and propose running `/spike <id>` first.
3. Write a short plan (files to touch, adapter changes, tests) — 10 lines max — then implement.
4. Respect the hard rules in `CLAUDE.md` (adapter-only internals, no module-eval Spicetify access,
   no bundled React, pure tested domain, no silent writes).
5. Run `npm run check`. Fix until green.
6. Tick the item in `docs/MILESTONES.md`. Tell Vivek exactly what to look at in Spotify to verify,
   and what a passing result looks like.
