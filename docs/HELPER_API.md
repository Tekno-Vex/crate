# Crate Helper — API contract (v1)

The helper is an optional, small, always-local process that reads and writes audio file tags.
The custom app works without it; with it, Crate gets true tags and editing.

## Implementation choice

- **Rust + [`lofty`](https://crates.io/crates/lofty)** for tags (MP3/ID3v2, M4A/MP4, FLAC/Vorbis,
  OGG, Opus, WAV, AIFF), `axum` for HTTP, `notify` for file watching. Single static binary per OS.
- Prototype allowed in Python (`mutagen` + `fastapi`) to de-risk the contract quickly; the
  contract below is what matters — the Rust build must pass the same contract tests.
- Runs as a user process (tray icon later). No admin rights. No network except localhost, plus
  optional user-initiated MusicBrainz/Cover Art Archive calls (proxied so the app can't be used
  to hit arbitrary hosts).

## Transport & security

- Bind `127.0.0.1:47823` only (port configurable). Never `0.0.0.0`.
- **Pairing:** first launch prints/shows a 6-digit code. App calls `POST /v1/pair {code}` →
  `{token}`. Every other request needs `Authorization: Bearer <token>`. Token stored by the app.
- Check `Origin` — allow only the Spotify renderer's origin(s) (value: Diagnostics → Versions → `origin`).
  S2 (1.3.5): the renderer may fetch 127.0.0.1 with no CSP block, so the helper must answer CORS
  preflights (`Access-Control-Allow-Origin` = that origin, `Access-Control-Allow-Headers: authorization,
  content-type`) and Chromium's Private Network Access preflight (`Access-Control-Allow-Private-Network: true`).
- Rate-limit write endpoints. Reject paths outside configured library roots (canonicalize first;
  no symlink escapes).
- Transport is HTTP+JSON unless S2 shows the renderer can't fetch localhost; then WebSocket with
  the same message shapes.

## Endpoints

| Method | Path                        | Purpose |
| ------ | --------------------------- | ------- |
| GET    | `/v1/health`                | `{version, apiVersion: 1, roots: [...], scanning: bool, trackCount}` (no auth; no data) |
| POST   | `/v1/pair`                  | `{code}` → `{token}` |
| GET    | `/v1/roots`                 | configured library folders |
| PUT    | `/v1/roots`                 | set folders (also try auto-discover from Spotify prefs, spike S6) |
| POST   | `/v1/scan`                  | start/refresh scan → `{jobId}`; progress via `/v1/events` |
| GET    | `/v1/tracks?since=<cursor>` | paged `HelperTrack[]` + `nextCursor`; `since` gives changes only |
| GET    | `/v1/tracks/:id`            | one track |
| GET    | `/v1/art/:artId?size=640`   | embedded or folder art (JPEG/PNG), cached, resized |
| POST   | `/v1/writes/preview`        | `WriteRequest` → `WritePreview` (diff, warnings, resulting local URIs) |
| POST   | `/v1/writes`                | `WriteRequest` + `previewId` → `{journalId, results[]}` |
| GET    | `/v1/journal?limit=50`      | recent write journal entries |
| POST   | `/v1/journal/:id/undo`      | restore previous tags (and art) from journal |
| GET    | `/v1/events`                | SSE: scan progress, file changed/added/removed, write done |

### Types

```ts
type HelperTrack = {
  id: string;              // stable: hash of canonical path
  path: string;
  format: 'mp3'|'m4a'|'flac'|'ogg'|'opus'|'wav'|'aiff'|'other';
  bitrateKbps?: number; sampleRate?: number; durationMs: number;
  mtime: number; ctime?: number; size: number;
  tags: {
    title?: string; artists?: string[]; album?: string; albumArtist?: string;
    trackNumber?: number; trackTotal?: number; discNumber?: number; discTotal?: number;
    year?: number; date?: string; genre?: string[]; composer?: string[];
    compilation?: boolean; lyrics?: string; comment?: string;
  };
  artId?: string;          // content hash of embedded (or folder) art
  spotifyLocalUri: string; // what Spotify will call this file (see Matching)
};

type WriteRequest = {
  trackIds: string[];
  set?: Partial<HelperTrack['tags']>;      // applied to all
  perTrack?: Record<string, Partial<HelperTrack['tags']>>;
  art?: { mode: 'replace'|'remove'; dataBase64?: string; mime?: string };
};

type WritePreview = {
  previewId: string;
  changes: { trackId: string; field: string; before: unknown; after: unknown }[];
  uriChanges: { trackId: string; before: string; after: string }[];
  warnings: string[];      // e.g. "file is currently playing", "read-only file"
};
```

## Matching helper tracks ↔ Spotify tracks

Spotify local URIs look like `spotify:local:<artist>:<album>:<title>:<seconds>` (URL-encoded,
`+` for spaces — confirm in S5). The helper computes `spotifyLocalUri` from tags using exactly
Spotify's rules; the app joins on that. Fallback join: normalized (title, album, artist) +
duration within ±2s. Unmatched tracks are shown in Diagnostics.

## Write pipeline (non-negotiable)

1. App sends `WriteRequest` → `/writes/preview`. User sees the diff + URI changes + warnings.
2. User confirms → `/writes` with `previewId`. Helper re-reads current tags; if they changed
   since preview, abort with a conflict.
3. Helper writes a **journal entry** (previous tags + art bytes) to disk *before* modifying files.
4. Write to a temp copy → fsync → atomic rename over the original (keeps file intact on crash).
   Preserve mtime unless user opts otherwise.
5. Skip files currently playing / locked (app tells helper the current track id); return them as
   `deferred` and retry when playback moves on.
6. Return results; app runs **URI migration**.

## URI migration (app side)

For each `{before, after}` URI change:
- Wait until Spotify has rescanned and `after` exists (poll local tracks; S4 tells us how to
  trigger a rescan).
- For every user playlist containing `before`: insert `after` at the same index, remove `before`.
- If `before` was liked/saved, save `after`.
- Log a migration record so it can be undone alongside the journal.

## Contract tests

`helper/tests/contract/` — fixture audio files per format with known tags; tests run the HTTP
server and assert read, preview, write, undo, and `spotifyLocalUri` generation against the
fixture expectations collected in spike S5.
