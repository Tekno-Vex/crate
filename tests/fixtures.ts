import type { Track } from '../src/domain/model';

let idx = 0;

/** Build a Track with sensible defaults for tests. */
export function track(p: Partial<Track> & { title: string }): Track {
  const artistDisplay = p.artistDisplay ?? p.artists?.join(', ') ?? 'Artist';
  return {
    uri: p.uri ?? `spotify:local:${encodeURIComponent(artistDisplay)}:${encodeURIComponent(p.album ?? 'Album')}:${encodeURIComponent(p.title)}:200`,
    artists: p.artists ?? [artistDisplay],
    artistDisplay,
    album: p.album ?? 'Album',
    durationMs: p.durationMs ?? 200_000,
    source: 'spotify',
    originalIndex: p.originalIndex ?? idx++,
    ...p,
  };
}

/** Synthetic library generator for scale tests (M1: 20k tracks). */
export function syntheticLibrary(albumCount: number, tracksPerAlbum: number): Track[] {
  const out: Track[] = [];
  let i = 0;
  for (let a = 0; a < albumCount; a++) {
    for (let t = 0; t < tracksPerAlbum; t++) {
      out.push(
        track({
          title: `Song ${t + 1}`,
          album: `Album ${a}`,
          artists: [`Artist ${a % 500}`],
          trackNumber: t + 1,
          originalIndex: i++,
        }),
      );
    }
  }
  return out;
}
