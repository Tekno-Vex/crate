# Spikes — unknowns about Spotify internals

Run these first, on the latest Spotify (1.3.x) + Spicetify (2.45.x) on Vivek's machine.
Each spike has a probe on the Diagnostics page. Record results in the table at the bottom with
the Spotify/Spicetify versions — internals change between releases.

## S1 — What does LocalFilesAPI return?

- Does `Spicetify.Platform.LocalFilesAPI` exist? Method names? (`getTracks` used by the old app.)
- Field inventory across all tracks: uri, name, album {name, uri, images}, artists, duration,
  **trackNumber? discNumber? addedAt? path?**
- Are images `spotify:localfileimage:…` URIs? Do they render in `<img src>`? Size?
- Timing for the full library.
- **Decides:** how much of Tier 2 (ordering!) Tier 1 already gets for free.

Probe: Diagnostics → "Probe local files".

## S2 — Can the app reach a localhost helper?

- `fetch('http://127.0.0.1:47823/v1/health')` → refused (fine, means allowed) vs CSP block?
- Same for `ws://127.0.0.1:47823`.
- Listen for `securitypolicyviolation` events to tell them apart.
- **Decides:** HTTP vs WS transport for the helper, or a different bridge entirely.

Probe: Diagnostics → "Test localhost reachability".

## S3 — Playing an ordered list of local tracks as one context

Try in order, note which gives working next/prev/shuffle and shows a sensible "Playing from":
1. `PlayerAPI.play({ uri: 'spotify:internal:local-files' , pages: [{ items }] }, {}, { skipTo: { index } })`
2. `PlayerAPI.play({ uri: '<our app uri>', pages: [{ items }] }, {}, { skipTo: { index } })`
3. Fallback: play first + `addToQueue(rest)`.

Probe: Diagnostics → "Playback experiments" (needs ≥3 local tracks).

## S4 — What happens to a track's URI after its tags change?

Manual: note a local track's URI, edit its title in iTunes/Mp3tag, restart Spotify (or toggle the
local files source), find it again.
- Does the URI change? (Expected: yes — `spotify:local:artist:album:title:seconds`.)
- Do playlist entries / Liked Songs with the old URI grey out?
- Does Spotify rescan without restart? What triggers a rescan?
- **Decides:** URI-migration design (HELPER_API.md §Migration).

## S5 — Exact local URI encoding

Collect ~20 URIs with odd characters (spaces, `:`, `+`, `/`, non-Latin, empty album/artist).
Confirm the parser in `src/domain/localUri.ts` round-trips them and how Spotify derives duration
seconds (round vs floor). Add every case to `tests/localUri.test.ts`.

## S6 — Where are Spotify's local-file source folders configured?

Is the folder list in Spotify's `prefs` file (key name?) on Windows/macOS? If yes, the helper can
auto-discover folders; if not, the helper asks the user once.

## S7 — Album art color + native components

- Does `Spicetify.colorExtractor(localTrackUri)` work for local tracks? If not, compute a
  dominant color from the image in a canvas (check for canvas tainting with local image URLs).
- Which `Spicetify.ReactComponent` primitives exist on 1.3.x (TextComponent, ContextMenu,
  Menu, MenuItem, TooltipWrapper, ConfirmDialog)?

## Results

| Spike | Date | Spotify | Spicetify | Result | Follow-up |
| ----- | ---- | ------- | --------- | ------ | --------- |
| S1    | 2026-10-20 | 1.3.5.3058 (Win) | 2.45.3 | ✅ `LocalFilesAPI.getTracks()` → plain array, 615 tracks in 57 ms. Per track: `trackNumber`, `discNumber` (numbers, **0 = untagged**; 581/615 numbered, 16 with disc > 0), `addedAt` (**Date**), `album.{name,uri,artist,images}`, `artists[]`, `duration.milliseconds`, `uid`, `isLocal/isPlayable`. Cover = `spotify:localfileimage:<encoded file path>` (609/615) → **file path for free**; renders in `<img>`. | Mapper updated + real fixture. Follow-up answered same day — see notes below. |
| S2    | 2026-10-20 | 1.3.5.3058 (Win) | 2.45.3 | ✅ No CSP block. HTTP to 127.0.0.1 and localhost, and WS to 127.0.0.1, all fail with a connection-refused error and record no CSP violations (≈2 s each — Windows refused-connect retry). | HTTP transport OK. Helper must answer CORS (+ Private Network Access preflight) for the renderer origin — origin now in the Versions block. |
| S3    | 2026-10-20 | 1.3.5.3058 (Win) | 2.45.3 | ✅ `PlayerAPI.play({uri, pages:[{items:[{uri}]}]}, {}, {skipTo:{index, uri}})` plays **our order**: a reversed 3-2-1 list went 3 → 2 → 1 for both `spotify:internal:local-files` and `spotify:app:crate` (Vivek pressed Next; `getState().nextItems` agreed). Prev restarts the track first (normal). local-files-context shows \"Local Files\" as the source. `Player.playUri` + queue plays **nothing** for local URIs. Shapes: `getState()` → `{context:{uri}, item:{uri}, index, nextItems[], previousItems[], shuffle, repeat, …}`; `getQueue()` → `{current, queued[], nextUp[]}`. | Default = local-files-context. app-context shows **no** source label (blank header; full-screen view falls back to the track title) → local-files-context stays default. Open: does shuffle stay within the album; can context metadata set a custom \"Playing from\" title. |
| S4    |      |         |           |        |           |
| S5    | 2026-10-20 | 1.3.5.3058 (Win) | 2.45.3 | Partial: 20 real URIs. Spotify percent-encodes `' ( ) $ ? / , & [ ]` and UTF-8; leaves `- .` raw; space → `+`. Our encoder left `'()` raw → **fixed**. | `tests/localUri.test.ts`. Still need `! * ~`, empty album/artist, duration rounding. |
| S6    | 2026-10-20 | 1.3.5.3058 (Win) | 2.45.3 | ✅ Not in prefs files. `LocalFilesAPI.getSources()` → `{ defaultSources: [{id: 'downloads' or 'windows_music_library', enabled}], folders: [{path}] }`. Vivek: one folder, `C:\Users\kathi\Music\iTunes\iTunes Media\Music`. | Helper gets library roots from the app (`getSources().folders`) — no prefs parsing, no asking the user. |
| S7    | 2026-10-20 | 1.3.5.3058 (Win) | 2.45.3 | ✅ `colorExtractor(localUri)` resolves **null** for every local cover. Canvas fallback works: `spotify:localfileimage:` images load into `<img>` and `getImageData` is **not** tainted (30–45 ms per cover at 32px); Ys header tinted correctly. `Spicetify.ReactComponent`: AlbumMenu, ArtistMenu, ButtonPrimary/Secondary/Tertiary, Cards, Chip, ConfirmDialog, ContextMenu, Dropdown, IconComponent, Menu, MenuItem, MenuSubMenuItem, Navigation, PlatformProvider, PlaylistMenu, PodcastShowMenu, RemoteConfigProvider, RightClickMenu, Route, Router, Routes, ScrollableContainer, Slider, Snackbar, StoreProvider, TextComponent, Toggle, TooltipWrapper, TrackMenu. | `headerColor()` skips the extractor for local URIs. Cache tints in the library store (M1). Use TrackMenu/RightClickMenu for track rows, ConfirmDialog for M4 write confirmation. |

### Notes — 2026-10-20 (Spotify 1.3.5.3058, Spicetify 2.45.3, Windows 11)

- **Tier 1 is much stronger than feared.** Spotify reads track numbers, disc numbers and date added
  for local files. Album pages get real track order, Recently Added works, and file paths (folder
  view, helper matching) come for free via the cover URI. The helper's job narrows to album
  artist, year, genre, composer, full-res art and **writing**.
- `PlatformData` has no `client_version_*` / `os_name` on 1.3.5; version comes from the user agent.
  `Platform.version` / `Platform.operatingSystem` exist (values pending).
- PlayerAPI on 1.3.5 has `play`, `updateContext`, `skipTo`, `insertIntoQueue`, `refreshCurrentContext`
  — candidates for S3.
- LocalFilesAPI has track-update events (`_subscribeToTracksUpdates`, `_emitTrackUpdate`, debounce
  timers) — relevant to S4 (rescan detection) and the library store's diff-on-rescan.

### S1 follow-up — 2026-10-20

- `album.artist` **never** differs from the first track artist (0/615) → it is *not* the album-artist
  tag. Confirms Better Local Files' finding; album artist stays helper-only (or heuristic).
- `artists[]` **never** has more than one entry (0/615) → Spotify passes the joined artist string as
  one artist. `splitArtists()` remains necessary; it correctly keeps "Captain Beefheart & His Magic
  Band" whole (we don't split on `&`).
- The 27 albums with weak numbering are almost all **single-track "albums"** (downloaded singles with
  no track tag) plus one genuinely untagged album (Days Before Rodeo, 5 tracks). Nothing to fix in
  code — Library Health (M5) / the editor should flag them.
- No album has duplicate (disc, track) pairs → title-only grouping isn't merging distinct albums in
  this library.
- 609/615 file paths; common prefix = the one configured source folder.
- Versions: `Platform.version` = "1.3.5.3058", `Platform.operatingSystem` = "Windows",
  renderer origin = **`https://xpui.app.spotify.com`**.
- For M2: SEGA OSTs come as "… (Side A)" — candidate for `stripDiscSuffix` if a Side B shows up.

### Rescan events + top bar — 2026-10-20 (1.3.5)

- `LocalFilesAPI.getEvents()` → wrapper `{ _emitter: { _listeners, _metaListeners } }` with
  `addListener/removeListener/emit/emitSync/createEvent`. With Spotify's Local Files page closed, the
  only `_listeners` keys were **our own guesses** (`update`, `tracks_update`, …) — Spotify's UI does
  not hold a listener there, so the real event name is still unknown. Rescan-on-open/focus covers the
  M1 need (verified: retitled a track in iTunes, refocused Spotify, Crate updated). Revisit in S4:
  temporarily wrap `_emitter.emit` in Diagnostics to record emitted names while a file changes.
- Spotify's main-view top bar keeps the last native page's color on custom-app routes (purple after
  Liked Songs, black otherwise). Point sampling (`elementsFromPoint`) can't see it (pointer-events
  none). Verified shape: `header[data-testid="topbar"]` > layer `div` whose color is an **inline CSS
  variable** `--background-base: #5038a0` (opacity fades on scroll). Crate sets that variable — album
  tint on album pages, `#main-view`'s computed background elsewhere — and re-applies via
  MutationObserver if Spotify rewrites it. Smoke mock reproduces the shape.
- Main-view scroll container (2026-10-20, 1.3.5): `findScrollParent(.crate-root)` → an unnamed `div`
  with `overflow-y: scroll` (clientHeight 868 at Vivek's window size). Virtual grid measures against
  it; scroll restore, search persistence and album-opens-at-top verified live.
- Top bar after a fresh Spotify start: the color layer has **no** inline `--background-base` until a
  native page sets one, so the bar showed black. Crate now falls back to the full-width absolutely
  positioned element inside `header[data-testid="topbar"]` and sets the variable itself.
- Shuffle (S3 follow-up, 2026-10-20): `PlayerAPI.setShuffle(bool)` toggles global shuffle (player bar
  follows); `Player.data.shuffle` is a boolean; shuffled playback of our album context stays inside the
  album. No verified shuffle-changed event — Crate polls `Player.data.shuffle` (500 ms) on album pages.

### Context-menu injection on 1.3.5 — 2026-10-20 (Spotify 1.3.5.3058, Spicetify 2.45.3)

- **`Spicetify.ContextMenu.Item` breaks native menus for the tracks it applies to.** With "Go to
  album (Crate)" registered (shouldAdd = single local track), right-click and ⋯ on a local track in a
  native playlist open nothing, and the item never renders. Deregistered live → the native menu
  works again (incl. "Remove from this playlist"). Not a throw in our callbacks (hardened; still
  broke). Likely Spicetify 2.45.x's menu patch vs Spotify 1.3.5 (newer than its supported 1.3.1).
  → Item is **off by default** (Diagnostics opt-in). Re-test after Spicetify updates.
- Menu APIs present on 2.45.3 (Diagnostics → "Spicetify menu APIs"): `ContextMenu {Item, SubMenu}`,
  `Menu {Item, SubMenu}`, and **`ContextMenuV2 {Item, ItemSubMenu, registerItem, unregisterItem,
  renderItems, parseProps, _context}`**. M2: try registering via ContextMenuV2 (props/signature
  UNVERIFIED — read spicetify-cli's wrapper source for this version first), behind the same opt-in.
- Verified live after the fix: native playlist right-click/⋯ on local tracks works with the item off;
  Crate track rows highlight on click (color-mix fix).
- Spotify's **Local Files page**: right-click on local tracks does not open **even with our item off**
  — separate cause, not yet known (pre-existing? `full-queue-clear`? theme?). Crate's own album pages
  use `ReactComponent.TrackMenu` directly and work.
