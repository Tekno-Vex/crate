# Crate — Claude Code project brief

Crate is a Spicetify **custom app + bundled extension** that turns Spotify desktop's local files
into a real album library (album grid → native-feeling album page with correct track/disc order),
and — with an optional local "Crate Helper" — reads and edits real file tags (an iTunes "Get Info"
replacement inside Spotify). Target: publish on the Spicetify Marketplace.

Owner: Vivek. He is a strong engineer (CS grad student) — be direct, skip basics, explain only
Spotify/Spicetify-specific quirks.

Read these before non-trivial work:
- `docs/VISION.md` — product, tiers, feature list (what we're building and why)
- `docs/ARCHITECTURE.md` — layers, data model, routing, the adapter rule
- `docs/MILESTONES.md` — the ordered build plan with checkboxes (source of truth for "what's next")
- `docs/SPIKES.md` — unknowns about Spotify internals; results get recorded here
- `docs/HELPER_API.md` — contract for the companion process (Tier 2)
- `docs/RESEARCH_NOTES.md` — facts gathered about the old app, Spicetify versions, marketplace

## Hard rules

1. **All Spotify/Spicetify internals go through `src/platform/`.** No `Spicetify.Platform.*`,
   `Spicetify.Player.*`, `Spicetify.CosmosAsync`, or DOM class names anywhere else. Internals
   change between Spotify versions (1.3.x already moved to rspack); one adapter = one place to fix.
   Every adapter call feature-detects and returns a typed result or a typed failure — never throws
   raw into UI.
2. **Never touch `Spicetify.*` at module-evaluation time.** The extension loads before Spicetify is
   ready. Our React shims in `src/shims/` resolve `Spicetify.React` lazily; keep it that way.
3. **Never bundle React.** `react`, `react-dom`, `react/jsx-runtime` are aliased to shims over
   `Spicetify.React` / `Spicetify.ReactDOM` (see `scripts/build.mjs`). Two Reacts = broken hooks.
4. **Tier 1 must be excellent with no helper installed.** Helper features are progressive
   enhancement: detect, then light up.
5. **No silent writes to user files. Ever.** Every tag write: diff preview → user confirm →
   helper writes a journal entry first → write → URI migration for playlists (see HELPER_API.md).
6. **Domain logic is pure and tested.** `src/domain/` has no Spicetify access, so it runs under
   vitest. Grouping, ordering, URI parsing, normalization all live there with tests.
7. **Performance budget:** libraries of 20k+ tracks. Virtualize long lists/grids, cache in
   IndexedDB, never re-render the whole library on one track change.
8. **Look native.** Use Spotify CSS variables (`--spice-*`, `--background-*`, `--text-*`) and
   Spicetify's ReactComponent primitives where they exist, so themes work. No hard-coded colors
   except in fallbacks.

## Commands

```bash
npm install
npm run build        # one-off build → dist/<appId>/
npm run dev          # watch + rebuild + copy into Spicetify's CustomApps folder
npm run install-app  # copy dist/<appId> into Spicetify's CustomApps folder
npm run typecheck    # tsc --noEmit
npm test             # vitest (domain logic)
npm run smoke        # loads the BUILT bundles into jsdom with a mocked Spicetify and clicks through
npm run check        # typecheck + test + build + smoke — run before saying a task is done
```

First-time install on Vivek's machine (after `npm run install-app`):

```bash
spicetify config custom_apps crate
spicetify apply
```

Dev loop: terminal A `npm run dev`, terminal B `spicetify watch -a -l` (re-applies custom apps and
live-reloads; confirm flags with `spicetify watch -h` on the installed version).
DevTools in Spotify: `spicetify enable-devtools` then right-click → Inspect (or Ctrl/Cmd+Shift+I).

## How we verify things we can't run here

Claude Code cannot see Spotify. The **Diagnostics page** (`/crate/diagnostics`, also linked from
the app header) is the bridge: it probes the internals we depend on and has a **Copy report**
button that copies JSON. When you need ground truth from the live client, ask Vivek to open
Diagnostics, run the relevant probe, and paste the report. Then record the finding in
`docs/SPIKES.md` (date, Spotify version, Spicetify version, result) and update the adapter.

`scripts/smoke.cjs` mocks the Spicetify surface we use. When a spike reveals the real shape of an
API, update the mock in the same change so the smoke test keeps reflecting reality. React,
react-dom and jsdom are devDependencies **only** for the smoke test — the build plugin guarantees
they are never bundled.

Do not guess internal API shapes and present them as fact. If a field or method is unverified,
mark it `// UNVERIFIED (spike S#)` in code and handle its absence.

## Layout

```
src/
  app/            custom app: root, router, pages, components
  extension/      runs at Spotify startup: context menus, now-playing hooks, play logging
  platform/       THE adapter over Spotify internals (only place allowed to touch them)
  domain/         pure logic: model types, normalization, grouping, ordering, local URI parsing
  helper-client/  (M3) typed client for the Crate Helper HTTP API
  lib/            small utilities (logging, storage, style injection)
  shims/          React shims over Spicetify.React
  styles/         CSS (injected at runtime as a <style> tag)
  assets/         sidebar icons (SVG)
  types/          spicetify.d.ts (from spicetify/cli globals.d.ts)
scripts/          build.mjs, install.mjs
tests/            vitest specs for src/domain
helper/           (M3) Crate Helper — Rust binary, see docs/HELPER_API.md
docs/             specs (read them)
```

The app id / display name live in `package.json` → `"spicetify"`. Renaming the product = edit
there + the CustomApps folder name.

## Conventions

- TypeScript strict. Prefer function components + hooks. No class components.
- Routes: `/crate` (albums), `/crate/album/<albumKey>`, `/crate/artists`, `/crate/artist/<key>`,
  `/crate/diagnostics`, `/crate/settings`. Navigate with `platform.navigate()`.
- Persist UI state per view (search/sort/scroll) — the old app never did; we must.
- Commit messages: conventional commits (`feat:`, `fix:`, `docs:`, `chore:`).
- When you finish a milestone item, tick it in `docs/MILESTONES.md` in the same change.
- Keep the README user-facing (it becomes the Marketplace page).

## Slash commands in this repo

- `/spike <id>` — run a spike from docs/SPIKES.md with Vivek in the loop
- `/next` — pick the next unchecked milestone item, plan briefly, build, test, tick it
- `/ship-check` — pre-release checklist for a Marketplace release
