// Rescan diffing. Spotify gives us the whole local library each time; this decides what actually
// changed and rebuilds the Library while keeping unchanged Album objects identical (===), so React
// memoization skips them. Pure — no Spicetify access.

import { buildLibrary } from './grouping';
import type { Album, Library, Track } from './model';

/** Everything about a track that affects how it is grouped or displayed. */
export function trackFingerprint(t: Track): string {
  return [
    t.title,
    t.artistDisplay,
    t.album,
    t.albumArtist ?? '',
    t.trackNumber ?? '',
    t.discNumber ?? '',
    t.durationMs,
    t.imageUrl ?? '',
    t.addedAt ?? '',
    t.year ?? '',
    t.filePath ?? '',
  ].join('\u0001');
}

export interface TrackDiff {
  added: string[];
  removed: string[];
  changed: string[];
  /** Same tracks, same fingerprints, same order. */
  identical: boolean;
}

export function diffTracks(prev: readonly Track[], next: readonly Track[]): TrackDiff {
  const before = new Map(prev.map((t) => [t.uri, trackFingerprint(t)]));
  const after = new Map(next.map((t) => [t.uri, trackFingerprint(t)]));
  const added: string[] = [];
  const changed: string[] = [];
  for (const [uri, fp] of after) {
    const old = before.get(uri);
    if (old === undefined) added.push(uri);
    else if (old !== fp) changed.push(uri);
  }
  const removed = [...before.keys()].filter((uri) => !after.has(uri));
  const sameOrder = prev.length === next.length && prev.every((t, i) => t.uri === next[i]!.uri);
  return { added, removed, changed, identical: !added.length && !removed.length && !changed.length && sameOrder };
}

function sameAlbum(a: Album, b: Album): boolean {
  return (
    a.title === b.title &&
    a.albumArtist === b.albumArtist &&
    a.tracks.length === b.tracks.length &&
    a.tracks.every((t, i) => {
      const o = b.tracks[i]!;
      return t.uri === o.uri && t.originalIndex === o.originalIndex && trackFingerprint(t) === trackFingerprint(o);
    })
  );
}

/**
 * Library for a new scan. Returns `prev` itself when nothing changed; otherwise a new Library in
 * which every album whose tracks are unchanged is the *same object* as before.
 */
export function rebuildLibrary(prev: Library | undefined, tracks: Track[]): Library {
  if (prev && diffTracks(prev.tracks, tracks).identical) return prev;
  const next = buildLibrary(tracks);
  if (!prev) return next;
  const albums = next.albums.map((a) => {
    const old = prev.albumsByKey.get(a.key);
    return old && sameAlbum(a, old) ? old : a;
  });
  return { ...next, albums, albumsByKey: new Map(albums.map((a) => [a.key, a])) };
}
