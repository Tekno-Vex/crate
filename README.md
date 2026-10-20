# Crate

**A real album library for your Spotify local files.** Browse local music as albums with
cover art, open an album and see its tracklist in order — just like any album on Spotify.
An optional companion (coming soon) lets you edit tags and artwork without leaving Spotify.

> Status: early development (v0.0.x). Not on the Marketplace yet.

## Features

- Album grid with covers, search and sort
- Native-feeling album pages: header tinted from the cover, numbered tracklist, disc separators
- Albums that Spotify splits apart (featured artists, "Disc 1/Disc 2" titles) are merged
- Right-click any local track → **Go to album (Crate)**
- Diagnostics page for bug reports

Planned: artists view, multi-select, cover-based album matching, Crate Helper (real tags,
in-app tag editor, "borrow metadata from Spotify", library health), listening stats, smart
playlists. See [docs/VISION.md](docs/VISION.md).

## Install (from source)

Requires [Spicetify](https://spicetify.app) and Node.js 20+.

```bash
npm install
npm run build
npm run install-app
spicetify config custom_apps crate
spicetify apply
```

## Uninstall

```bash
spicetify config custom_apps crate-
spicetify apply
```

Then delete the `crate` folder from Spicetify's `CustomApps` folder (`spicetify config-dir`).

## Known limitations

Without the Crate Helper, Crate only sees what Spotify exposes about local files: Spotify ignores
album-artist tags and merges multiple artists into one name, and may not expose track numbers.
Crate works around this where it can; the helper removes these limits.

## Credits

Inspired by Pithaya's [Better Local Files](https://github.com/Pithaya/spicetify-apps).

## License

MIT
