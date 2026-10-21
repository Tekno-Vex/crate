// Seeded, realistic fake library for scale testing (tests/scale.test.ts and Diagnostics → Stress test).
// Covers the shapes that cost time: many small albums, some huge ones, multi-disc via "(Disc N)"
// titles, joined/featured artists, compilations, untagged singles, non-Latin text.

import { splitArtists } from './artists';
import type { Track } from './model';

/** mulberry32 — tiny deterministic PRNG so runs are comparable. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = ['Night', 'Glass', 'River', 'Static', 'Ember', 'Hollow', 'Neon', 'Paper', 'Winter', 'Signal', 'Velvet', 'Iron', 'Ghost', 'Salt', 'Echo', 'Ash'];
const JP = ['夜', '海', '光', '風', '夢', '星', '雨', '影'];

export interface SyntheticOptions {
  trackCount: number;
  seed?: number;
  /** Real cover URLs to reuse so the grid renders real images (Diagnostics passes the user's). */
  imagePool?: string[];
}

export function syntheticTracks({ trackCount, seed = 42, imagePool = [] }: SyntheticOptions): Track[] {
  const r = rng(seed);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
  const words = (n: number) => Array.from({ length: n }, () => pick(WORDS)).join(' ');
  const artistCount = Math.max(1, Math.round(trackCount / 25));
  const artistName = (i: number) => (i % 37 === 0 ? `${pick(JP)}${pick(JP)} ${i}` : `${words(2)} ${i}`);

  const out: Track[] = [];
  let albumNo = 0;
  const now = Date.UTC(2026, 9, 20);
  while (out.length < trackCount) {
    const a = albumNo++;
    const kind = r();
    const size = kind < 0.12 ? 1 : kind < 0.9 ? 6 + Math.floor(r() * 10) : 20 + Math.floor(r() * 40);
    const discs = size >= 20 && r() < 0.5 ? 2 : 1;
    const compilation = size > 1 && r() < 0.05;
    const owner = artistName(Math.floor(r() * artistCount));
    const title = r() < 0.05 ? `${pick(JP)}${pick(JP)}${pick(JP)} ${a}` : `${words(1 + Math.floor(r() * 3))} ${a}`;
    const image = imagePool.length && r() > 0.02 ? imagePool[a % imagePool.length] : undefined;
    const addedAt = now - Math.floor(r() * 5 * 365) * 86_400_000;
    const tagged = r() > 0.1;
    for (let t = 0; t < size && out.length < trackCount; t++) {
      const disc = discs > 1 ? (t < size / 2 ? 1 : 2) : undefined;
      const trackOnDisc = disc === 2 ? t - Math.ceil(size / 2) + 1 : t + 1;
      let display = compilation ? artistName(Math.floor(r() * artistCount)) : owner;
      if (!compilation && r() < 0.1) display += `, ${artistName(Math.floor(r() * artistCount))}`;
      const songTitle = `${words(1 + Math.floor(r() * 3))}${r() < 0.08 ? ` (feat. ${artistName(Math.floor(r() * artistCount))})` : ''}`;
      const album = disc ? `${title} (Disc ${disc})` : title;
      const durationMs = (90 + Math.floor(r() * 400)) * 1000;
      out.push({
        uri: `spotify:local:${encodeURIComponent(display)}:${encodeURIComponent(album)}:${encodeURIComponent(songTitle)}:${durationMs / 1000}`,
        title: songTitle,
        artists: splitArtists(display),
        artistDisplay: display,
        album,
        trackNumber: tagged ? trackOnDisc : undefined,
        durationMs,
        imageUrl: image,
        addedAt,
        source: 'spotify',
        originalIndex: out.length,
      });
    }
  }
  return out;
}
