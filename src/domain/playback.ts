// Pure playback decisions (no Spicetify access).

/**
 * Where "Play album" starts. Like Spotify's own Play button: track 1 normally, a random track when
 * shuffle is on (Spotify then shuffles the rest of the context).
 */
export function pickStartIndex(trackCount: number, shuffle: boolean, rand: () => number = Math.random): number {
  if (trackCount <= 0 || !shuffle) return 0;
  return Math.min(trackCount - 1, Math.floor(rand() * trackCount));
}
