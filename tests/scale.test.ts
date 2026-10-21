// CLAUDE.md performance budget: 20k+ tracks. Budgets are generous (CI machines vary); the printed
// timings are what to watch for regressions.
import { describe, expect, it } from 'vitest';
import { buildLibrary } from '../src/domain/grouping';
import { diffTracks, rebuildLibrary } from '../src/domain/libraryDiff';
import { normalizeText } from '../src/domain/normalize';
import { syntheticTracks } from '../src/domain/synthetic';
import { gridMetrics, visibleRows } from '../src/domain/virtualGrid';

const N = 20_000;
const time = <T,>(label: string, fn: () => T): T => {
  const t0 = performance.now();
  const v = fn();
  console.info(`[scale] ${label}: ${Math.round(performance.now() - t0)} ms`);
  return v;
};

describe(`scale: ${N.toLocaleString()} tracks`, () => {
  const tracks = syntheticTracks({ trackCount: N, imagePool: ['img:a', 'img:b'] });

  it('generates a realistic, deterministic library', () => {
    expect(tracks).toHaveLength(N);
    expect(syntheticTracks({ trackCount: 50 })).toEqual(syntheticTracks({ trackCount: 50 }));
    expect(tracks.some((t) => /\(Disc 2\)$/.test(t.album))).toBe(true);
    expect(tracks.some((t) => t.trackNumber === undefined)).toBe(true);
    expect(tracks.some((t) => t.artists.length > 1)).toBe(true);
  });

  it('builds the library within budget', () => {
    const lib = time('buildLibrary', () => buildLibrary(tracks));
    expect(lib.tracks).toHaveLength(N);
    expect(lib.albums.length).toBeGreaterThan(1000);
    expect(lib.artists.length).toBeGreaterThan(500);
    // "(Disc N)" titles merged into one album with both discs.
    expect(lib.albums.some((a) => a.discs.length === 2)).toBe(true);
    const t0 = performance.now();
    buildLibrary(tracks);
    expect(performance.now() - t0).toBeLessThan(3000);
  });

  it('rescans cheaply: identical scan reuses everything, one edit replaces one album', () => {
    const first = buildLibrary(tracks);
    const same = time('rebuild (no change)', () => rebuildLibrary(first, tracks.map((t) => ({ ...t }))));
    expect(same).toBe(first);

    const edited = tracks.map((t, i) => (i === 1234 ? { ...t, title: `${t.title} (edit)` } : t));
    const diff = time('diffTracks', () => diffTracks(tracks, edited));
    expect(diff).toMatchObject({ added: [], removed: [], changed: [tracks[1234]!.uri] });

    const second = time('rebuild (1 edit)', () => rebuildLibrary(first, edited));
    const replaced = second.albums.filter((a) => first.albumsByKey.get(a.key) !== a);
    expect(replaced).toHaveLength(1);
  });

  it('searches the album list fast enough to run per keystroke', () => {
    const lib = buildLibrary(tracks);
    const index = new Map(lib.albums.map((a) => [a, normalizeText(`${a.title} ${a.albumArtist} ${a.artists.join(' ')}`)]));
    const hits = time('search (prebuilt index)', () => lib.albums.filter((a) => index.get(a)!.includes('ember')));
    expect(hits.length).toBeGreaterThan(0);
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) lib.albums.filter((a) => index.get(a)!.includes('glass'));
    expect((performance.now() - t0) / 20).toBeLessThan(50);
  });

  it('renders a constant number of grid rows regardless of library size', () => {
    const metrics = gridMetrics(1400, { minColumnWidth: 180, gap: 24, extraHeight: 56 });
    const rows = (itemCount: number) =>
      visibleRows({ itemCount, metrics, gap: 24, scrollTop: 50_000, viewportHeight: 900, gridTop: 120 });
    const small = rows(2_000);
    const big = rows(200_000);
    expect(big.end - big.start).toBe(small.end - small.start);
    expect((big.end - big.start) * metrics.columns).toBeLessThan(60);
  });
});
