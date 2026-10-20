---
description: Run a spike from docs/SPIKES.md with Vivek in the loop
argument-hint: <spike id, e.g. S1>
---

Run spike **$ARGUMENTS** from `docs/SPIKES.md`.

1. Read the spike's section in `docs/SPIKES.md` and the related probe in
   `src/app/pages/DiagnosticsPage.tsx` / `src/platform/`.
2. If the probe doesn't yet cover what the spike needs, extend it first (adapter + Diagnostics),
   run `npm run check`, and tell Vivek to reload the app (`npm run dev` + `spicetify watch -a -l`
   should pick it up).
3. Give Vivek exact click-by-click instructions, then STOP and wait for him to paste the
   Diagnostics report (or DevTools output).
4. From the pasted data: record a row in the Results table (date, Spotify + Spicetify versions,
   result, follow-up), remove `// UNVERIFIED (spike $ARGUMENTS)` markers that are now confirmed,
   and update adapter types/code to the verified shape. Add regression tests where the finding is
   pure logic (e.g. URI encoding cases → `tests/localUri.test.ts`).
5. Summarize what changed and what the finding unblocks in `docs/MILESTONES.md`.
