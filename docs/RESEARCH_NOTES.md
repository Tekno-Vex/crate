# Research notes (gathered 2026-10-19)

## Spicetify state

- Latest stable: **v2.45.1 (2026-09-17)** — supports Spotify 1.2.14 → 1.3.1 on macOS and
  Windows, → 1.2.96 on Linux. Fixes for 1.3.0 menus/dialogs/popup modals in this release.
- Spotify 1.3.0 introduced an `rspackChunk` global; Spicetify v3 beta.17 fixed capture timeouts
  caused by it. Expect internals to keep moving.
- **Spicetify v3** is in beta (v3.0.0-beta.2x): a daemon, a module store (`spicetify pkg install`),
  official modules repo `spicetify/modules`, a `kit` scaffolder. Not the target yet; keep our entry
  points thin so a v3 module port is mostly packaging. Watch whether v3 modules gain native
  capabilities that could replace the helper.
- Platform API docs explicitly say internals are unstable and differ by Spotify version; explore
  them with `Spicetify.Platform` in DevTools.

## Custom app mechanics (docs)

- Folder in CustomApps with `index.js` (defines `render()`) + `manifest.json`
  (`name`, `icon`, `active-icon` as escaped SVG, optional `subfiles`, `subfiles_extension`).
- App code only runs when its page is opened; startup code must be a `subfiles_extension`.
- Subfile extensions can't read app variables → share via storage.
- Sub-pages via `Spicetify.Platform.History.push({ pathname: '/<app>/…', state })` and branching
  in `render()` on `location.pathname`.
- Install: `spicetify config custom_apps <folder>` then `spicetify apply`; remove with `<folder>-`.

## Prior art: Pithaya "Better Local Files"

- Source: github.com/Pithaya/spicetify-apps (custom-apps/better-local-files), dist repo
  Pithaya/spicetify-apps-dist (180★). Check the LICENSE before reusing code; credit regardless.
- Features: tracks/albums/artists views, filter/sort, Spotify-language support.
- Documented limitations: artist tags concatenated (it splits on `', '` and `'; '`), album artist
  tags not recognized, no artist images (uses first album's cover), albums keyed by
  artist+album name → it groups by album name instead and offers a manual "rebuild album cache"
  that compares cover images to split same-name albums.
- Never-shipped "upcoming": artist album list, multi-select, persist search/sort/scroll.
- Open issues: not loading on Spicetify 2.37.7 (2024), "error on loading" likely due to very large
  libraries (2025, #79), can't scroll, big bottom margin, cache rebuild failures, local files not
  showing. Our scale + compat work directly targets these.

## Marketplace publishing

- Public GitHub repo with topic **`spicetify-apps`** for custom apps, valid `manifest.json` at the
  repo root (name, description, preview image, readme, authors, tags). Marketplace discovers via
  GitHub topic search. Historically custom apps listed there still needed manual install steps —
  provide install scripts (PowerShell + sh) like Pithaya did.
- Root `manifest.json` in this repo is the **Marketplace** manifest; the **app** manifest is
  generated into `dist/crate/manifest.json` by the build.

## Localhost companions precedent

- Spicetify shipped "WebNowPlaying Companion" talking over WebSocket on localhost:8974 years ago;
  several community projects (spicetify-websocket, spotify_info) use localhost bridges. Still must
  verify on 1.3.x (spike S2).

## Update 2026-10-20

- Spicetify **2.46.0–2.46.2** (released 2026-10-20) add Spotify 1.3.5/1.3.6 support. 2.45.x on 1.3.5
  breaks every menu Spicetify extends (profile menu, Local Files right-click, extension menu items).
  The README should tell users to update Spicetify before reporting menu problems.
