import type { Track } from './model';

const BIG = Number.MAX_SAFE_INTEGER;

/**
 * Album track order: disc ASC → track ASC → original order.
 * Within a disc, numbered tracks come before unnumbered ones. Never alphabetical by accident.
 */
export function compareAlbumTracks(a: Track, b: Track): number {
  const discA = a.discNumber ?? 1;
  const discB = b.discNumber ?? 1;
  if (discA !== discB) return discA - discB;
  const trackA = a.trackNumber ?? BIG;
  const trackB = b.trackNumber ?? BIG;
  if (trackA !== trackB) return trackA - trackB;
  return a.originalIndex - b.originalIndex;
}

export function sortAlbumTracks(tracks: readonly Track[]): Track[] {
  return [...tracks].sort(compareAlbumTracks);
}

/** True if enough tracks carry numbers that the order shown is meaningful. */
export function hasReliableNumbering(tracks: readonly Track[]): boolean {
  if (tracks.length === 0) return false;
  const numbered = tracks.filter((t) => t.trackNumber !== undefined).length;
  return numbered / tracks.length >= 0.8;
}
