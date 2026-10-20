# Milestones

Tick items as they land (same commit). Each milestone ends shippable.

## M0 — Foundation (scaffold delivered)

- [x] Build: esbuild → `dist/crate/{index.js,extension.js,manifest.json}`, React shims, CSS injection
- [x] Install script copies into Spicetify's CustomApps folder (Win/macOS/Linux)
- [x] Platform adapter skeleton (local tracks, playback, navigation, clipboard, versions)
- [x] Domain: model, normalization, local URI parser, album grouping, track ordering + tests
- [x] Diagnostics page with probes for S1/S2/S3 + Copy report
- [x] Minimal albums grid + album page wired end to end
- [x] Extension: right-click local track → "Go to album (Crate)" (pulled forward from M2)
- [x] Smoke test: built bundles + mocked Spicetify in jsdom (`npm run smoke`)
- [ ] First install on Vivek's machine; app appears in sidebar; Diagnostics loads

## M1 — Spikes + Tier 1 core (the "it works again" release, v0.1)

- [ ] Run S1, S2, S3, S5, S7; record in SPIKES.md; update adapter to verified shapes
- [ ] Library store: load once, IndexedDB cache, diff on rescan, subscribe hooks
- [ ] Albums grid: virtualized, search/sort, persisted scroll/search/sort
- [ ] Album page: tinted header, Spotify-style tracklist, Play/Shuffle via verified context (S3)
- [ ] Track row: hover play, double-click play, right-click → native track context menu
- [ ] Artists view + artist → albums
- [ ] Empty/error states (local files disabled, zero tracks, internals changed)
- [ ] Tested with a 20k-track synthetic library (fixture generator in tests)
- [ ] README + screenshots; publish v0.1 to GitHub with `spicetify-apps` topic

## M2 — Everywhere + smart grouping (v0.2)

- [ ] Verify "Go to album (Crate)" on 1.3.x; add it to the album-name link in track rows
- [ ] Extension: now-playing album click → Crate album page for local tracks
- [ ] Multi-select (shift/ctrl), add to queue / playlist
- [ ] Cover perceptual hash (dHash) in a worker; merge/split same-name albums by art; cached
- [ ] Various Artists detection; manual "merge/split album" override persisted
- [ ] Years view; Recently Added (if `addedAt` available per S1)

## M3 — Crate Helper read-only (v0.3)

- [ ] `helper/` Rust crate: scan folders, read tags with lofty, serve HTTP per HELPER_API.md
- [ ] Pairing flow UI in Settings; capability detection; graceful absence
- [ ] Merge helper tags into library store (match via local URI fields, S5)
- [ ] Album page: disc separators, true album artist, year, genre, composer
- [ ] Full-res embedded art served by helper
- [ ] Release binaries via GitHub Actions (Win/macOS universal/Linux), signed where possible

## M4 — Editor (v0.4) — the iTunes replacement

- [ ] Get Info panel (single + batch, Mixed values)
- [ ] Artwork drag-drop / paste / file pick
- [ ] Diff preview → confirm → journaled write → undo
- [ ] Skip/queue writes for the currently playing file
- [ ] URI migration for playlists + Liked Songs after edits (S4)
- [ ] Auto-number from filename; title-case fixer
- [ ] Borrow from Spotify: catalog search → align tracks → proposed diff

## M5 — Health + delight (v1.0)

- [ ] Library Health dashboard with one-click fixes
- [ ] Play logging + local stats + Jump back in shelf
- [ ] Smart playlists materialized to real playlists
- [ ] Catalog bridge ("on Spotify", missing tracks)
- [ ] Shelf display mode; settings polish; i18n via Spotify locale
- [ ] Marketplace listing polish; v3 module port investigation
