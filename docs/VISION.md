# Crate — Vision

**One line:** your local files finally look and behave like a real Spotify album library, with an
iTunes-grade tag editor built in.

## Who it's for

People with large local libraries (rips, Bandcamp purchases, rare/out-of-catalog releases,
game/anime OSTs, DJ crates) who use Spotify as their player and currently get one flat list of
tracks. Today they tag in iTunes/Mp3tag/MusicBrainz Picard, then stare at that list.

## The core insight

Spotify's local-file parsing is lossy (documented by the old Better Local Files app):
- multiple artist tags collapse into one string (`"A, B"`)
- album-artist tags are ignored
- no artist images
- album identity = track artist(s) + album name, so compilations/feature-heavy albums split apart

Anything built only on what Spotify exposes inherits that broken view. Reading the real tags
fixes it — and the same capability enables editing. Hence two tiers.

## Tier 1 — works out of the box (pure Spicetify)

- **Album grid** with covers; search, sort (artist, album, year if known, recently added if known),
  filter. State (search/sort/scroll) persists per view.
- **Native-feeling album page:** large cover, header tinted from the art (`colorExtractor`), album
  artist, year, track count, total runtime, Play / Shuffle, Spotify-style tracklist with numbers,
  durations, hover-to-play, multi-select.
- **Correct ordering:** disc → track number when known; otherwise a stable heuristic (filename
  order if exposed, then original order) — never alphabetical by accident.
- **Smart grouping:** merge albums Spotify splits (same album name, shared cover via perceptual
  hash), "Various Artists" detection, split same-name albums with different covers. Incremental —
  no manual "rebuild cache" button required (the old app needed one).
- **Artists & Years views,** artist → albums page.
- **Scale:** virtualized lists/grids, IndexedDB cache, diff-on-rescan. 20k+ tracks smooth.
- **Everywhere integration (bundled extension):**
  - Right-click a local track anywhere → *Go to album (Crate)*
  - Now-playing album name → opens the Crate album page for local tracks
  - Multi-select → add to queue / add to playlist
- **Diagnostics page** (doubles as our support tool: users paste a report into issues).

## Tier 2 — Crate Helper (optional companion) unlocks real tags

A small signed binary that reads/writes tags (Rust + `lofty`). Talks to the app over
`127.0.0.1` with a pairing token. See `HELPER_API.md`.

- **True tags:** track/disc numbers and totals, album artist, compilation flag, year/date,
  genre, composer, embedded lyrics, embedded artwork at full resolution, file path, format,
  bitrate, date added (file mtime/ctime).
- **Disc separators** ("Disc 1", "Disc 2") on album pages.
- **Get Info editor:** single or batch, "Mixed" values for multi-select, artwork drag-drop /
  paste / pick file, auto-number from filename, title-case fixer, diff preview, undo journal.
- **Borrow from Spotify:** match a local album to a catalog album (user picks from search
  results) and pull track order, titles, year, and hi-res cover into the editor as a proposed diff.
- **Optional MusicBrainz / Cover Art Archive lookup** (user-initiated, rate-limited).
- **URI migration:** after any edit that changes artist/album/title/duration, Spotify's local URI
  changes; Crate rewrites affected playlist entries (and re-likes) so nothing greys out.
  Nobody else does this. It is what makes the editor trustworthy.
- **Library Health:** missing art, missing track numbers, inconsistent album artist across an
  album, duplicates, low bitrate, unsupported formats — each with a one-click fix that goes through
  the same preview/journal pipeline.
- **Folder view.**

## Tier 3 — delight

- **Local listening stats** (extension logs plays of `spotify:local:` tracks): most-played local
  albums, "Jump back in" shelf, a yearly local recap card.
- **Smart playlists (iTunes-style rules)** materialized into real Spotify playlists, so they show
  on mobile.
- **Catalog bridge:** "This album is on Spotify" + "you're missing 3 tracks" + Open on Spotify.
- **Display modes:** dense grid, large "shelf" mode, art-tinted backdrop on album pages.

## Non-goals (for now)

- Transcoding / file conversion. Moving or renaming files on disk (maybe later, behind the
  same journal). Streaming local files to other devices beyond what Spotify already does.
- Scraping lyrics sites. (Embedded lyrics only.)

## Positioning on the Marketplace

- Name: **Crate** (working name; also consider "Liner Notes", "Shelf").
- Hero screenshot: album grid → album page with tinted header + numbered tracklist.
- Promise: "Works instantly. Install the helper to edit tags without leaving Spotify."
- Credit Pithaya's Better Local Files as inspiration.
