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
| S1    | 2026-10-20 | 1.3.5.3058 (Win) | 2.45.3 | ✅ `LocalFilesAPI.getTracks()` → plain array, 615 tracks in 57 ms. Per track: `trackNumber`, `discNumber` (numbers, **0 = untagged**; 581/615 numbered, 16 with disc > 0), `addedAt` (**Date**), `album.{name,uri,artist,images}`, `artists[]`, `duration.milliseconds`, `uid`, `isLocal/isPlayable`. Cover = `spotify:localfileimage:<encoded file path>` (609/615) → **file path for free**; renders in `<img>`. | Mapper updated + real fixture. Follow-up probe: does `album.artist` reflect the album-artist tag? are `artists[]` ever split? why 27 albums lack numbering? |
| S2    | 2026-10-20 | 1.3.5.3058 (Win) | 2.45.3 | ✅ No CSP block. HTTP to 127.0.0.1 and localhost, and WS to 127.0.0.1, all fail with a connection-refused error and record no CSP violations (≈2 s each — Windows refused-connect retry). | HTTP transport OK. Helper must answer CORS (+ Private Network Access preflight) for the renderer origin — origin now in the Versions block. |
| S3    |      |         |           |        |           |
| S4    |      |         |           |        |           |
| S5    | 2026-10-20 | 1.3.5.3058 (Win) | 2.45.3 | Partial: 20 real URIs. Spotify percent-encodes `' ( ) $ ? / , & [ ]` and UTF-8; leaves `- .` raw; space → `+`. Our encoder left `'()` raw → **fixed**. | `tests/localUri.test.ts`. Still need `! * ~`, empty album/artist, duration rounding. |
| S6    | 2026-10-20 | 1.3.5.3058 (Win) | 2.45.3 | Partial: no local-folder keys in either prefs file. But `LocalFilesAPI.getSources()` exists (also `addFolder/removeFolder/browseForFolder`), and every track's file path is in its cover URI. | `getLocalSourcesRaw()` added; shape pending next report. Helper can take folders from the app — no prefs parsing. |
| S7    |      |         |           |        |           |

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
