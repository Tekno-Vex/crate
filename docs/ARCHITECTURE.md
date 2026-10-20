# Architecture

## Shape of the package

One Spicetify **custom app** folder (`CustomApps/crate/`) containing:

| File           | Role                                                                 |
| -------------- | -------------------------------------------------------------------- |
| `index.js`     | Custom app bundle. Defines global `render()` → `<App/>`.             |
| `extension.js` | Bundled extension (`subfiles_extension`). Runs at Spotify startup.   |
| `manifest.json`| name, escaped SVG icons, `subfiles_extension: ["extension.js"]`.     |

Notes from the Spicetify docs:
- A custom app only runs when its sidebar page is opened → anything global lives in `extension.js`.
- The extension does not share variables with the app → share via `localStorage`/IndexedDB or
  `window`-level events.
- `subfiles_extension` entries cannot be in nested folders.

CSS is bundled as text and injected into a `<style id="crate-styles">` by both entries
(idempotent), so we don't depend on how Spicetify loads `style.css`.

## Layers

```
 ┌──────────────── app (React pages) ───────────────┐   ┌──── extension ────┐
 │ AlbumsPage  AlbumPage  ArtistsPage  Diagnostics  │   │ context menus     │
 │ components/ (Grid, TrackList, Header, Editor…)   │   │ now-playing hook  │
 └───────────────▲──────────────────────────────────┘   │ play logger       │
                 │ hooks: useLibrary(), useRoute()       └────────▲──────────┘
 ┌───────────────┴───────────── library store ───────────────────┴──────────┐
 │ merge Spotify source + Helper source → normalized Track/Album/Artist      │
 │ IndexedDB cache, diff on rescan, subscriptions                            │
 └───────▲───────────────────────────────────▲──────────────────────────────┘
         │                                   │
 ┌───────┴────────── platform/ ───────┐  ┌───┴──── helper-client/ (M3) ─────┐
 │ ONLY place touching Spotify        │  │ typed HTTP client, pairing token │
 │ internals; feature-detected        │  │ capability detection             │
 └────────────────────────────────────┘  └──────────────────────────────────┘
 ┌────────────────── domain/ (pure, tested) ─────────────────────────────────┐
 │ model types · normalize · albumKey · grouping · ordering · localUri       │
 └───────────────────────────────────────────────────────────────────────────┘
```

## Data model (src/domain/model.ts)

- `Track` — `uri` (spotify:local:…), `title`, `artists: string[]` (split), `artistDisplay`,
  `album`, `albumArtist?`, `trackNumber?`, `trackTotal?`, `discNumber?`, `discTotal?`,
  `durationMs`, `year?`, `genre?`, `imageUrl?`, `addedAt?`, `filePath?` (decoded from Spotify's `spotify:localfileimage:` cover URI, else helper),
  `source: 'spotify' | 'spotify+helper'`, `originalIndex`.
- `Album` — `key` (stable), `title`, `albumArtist` (or "Various Artists"), `artists`,
  `tracks: Track[]` (ordered), `discs: number[]`, `year?`, `durationMs`, `imageUrl?`.
- `Artist` — `key`, `name`, `albumKeys`, `trackCount`.

### Album identity

`albumKey = slug(normalize(albumTitle)) + "~" + slug(normalize(albumArtist ?? "")) + (variant ? "~" + variant : "")`

- Tier 1 (no album artist): key by normalized album title; split variants by cover hash when two
  groups with the same title have clearly different art (M2).
- Tier 2: album artist from tags makes keys exact.
- Keys must be stable across rescans (they're in URLs and in persisted UI state).

### Ordering

`disc ASC → track ASC → (no numbers) originalIndex ASC`. Tracks with numbers always precede
unnumbered ones within a disc. Pure function, tested.

## Routing

Custom app root path = app id (`/crate`). `Spicetify.Platform.History` drives navigation;
`useRoute()` subscribes to `History.listen` and parses `location.pathname`.

## Playback

Playing an album should create a *context* so next/prev and shuffle work. Exact
`PlayerAPI.play(context, options)` shape for an ad-hoc list of local URIs is **spike S3**. Until
verified, the adapter falls back to: play first track, then enqueue the rest.

## Storage

- IndexedDB `crate` db, one `kv` store (`src/lib/idb.ts`): `library` = `{schema, savedAt, tracks}`
  (albums are rebuilt from tracks, so grouping changes never need a cache bump — Track shape changes
  bump `CACHE_SCHEMA`), `tints` = cover → header color. Later keys: `coverHashes`, `plays`, `uiState`.
- Store (`src/app/libraryStore.ts`): paint cache → live scan → `rebuildLibrary` keeps unchanged
  `Album` objects `===` so memoized views skip them → write cache only if the scan differs.
  Rescan triggers: Crate opened, window focus, LocalFilesAPI events (names UNVERIFIED).
- `Spicetify.LocalStorage` only for tiny settings.
- Helper is the source of truth for tag data and the write journal.

## Helper integration (M3+)

See `HELPER_API.md`. The app discovers the helper at `http://127.0.0.1:47823` (configurable),
performs pairing, caches the token, and polls `/v1/health`. Whether the Spotify renderer may fetch
localhost at all is **spike S2**; fallback is a WebSocket, also tested in S2.

## Error/compat strategy

- Adapter returns `Result<T, PlatformError>`; UI shows actionable states ("Local files are turned
  off in Spotify settings", "This Spotify version changed X — open Diagnostics").
- Diagnostics records Spotify + Spicetify versions and which probes pass; reports are copyable.
- v3 Spicetify (beta) uses a module store; keep entry points thin so porting is a packaging task.
