# Changelog

## [0.1.0] - 2026-10-20

First release: your local files as a real album library.

### Added
- **Albums grid** with covers, search and sort (album, artist, track count, recently added). Search,
  sort and scroll position are remembered. Only on-screen rows are drawn, so it stays smooth with
  50,000+ tracks.
- **Album pages**:
  - a header tinted from the cover, matching Spotify's top bar
  - tracks in disc and track order, with disc separators
  - Play, a Shuffle toggle that follows the player bar, and the playing track highlighted
- **Track rows**: click selects, double-click or Enter plays, a play icon shows on hover. Right-click
  opens Spotify's own track menu.
- **Artists**: an artists grid and artist pages with Albums and "Appears on".
- **Go to album (Crate)** in Spotify's right-click menu for local tracks. It turns itself off on
  Spicetify versions older than 2.46 running on Spotify 1.3.2+, where Spicetify breaks menus.
- Albums that Spotify splits ("(Disc 1)/(Disc 2)" titles, guest artists) are merged.
- **Library cache**: Crate opens instantly and rescans when it opens, when Spotify regains focus,
  and when local files are switched on or off.
- **Clear empty and error states** with one-click fixes: local files off, no folders, empty
  folders, Spotify internals changed.
- **Diagnostics page**: version info, checks of the Spotify internals Crate relies on, Copy report,
  and a stress test.

### Requirements
- Spicetify 2.46+ for Spotify 1.3.5 and later. Tested on Spotify 1.3.5 (Windows) with Spicetify 2.46.2.
