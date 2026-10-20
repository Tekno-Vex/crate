import { describe, expect, it, vi } from 'vitest';
import { createLibraryStore, CACHE_SCHEMA, type LibraryState } from '../src/app/libraryStore';
import { diffTracks, rebuildLibrary } from '../src/domain/libraryDiff';
import type { Track } from '../src/domain/model';
import type { KeyValueStore } from '../src/lib/idb';
import type { Result } from '../src/platform';
import { track } from './fixtures';

const lib = () => [
  track({ uri: 'spotify:local:A:One:a1:1', title: 'a1', album: 'One', trackNumber: 1, originalIndex: 0 }),
  track({ uri: 'spotify:local:A:One:a2:1', title: 'a2', album: 'One', trackNumber: 2, originalIndex: 1 }),
  track({ uri: 'spotify:local:B:Two:b1:1', title: 'b1', album: 'Two', trackNumber: 1, originalIndex: 2 }),
];

describe('diffTracks', () => {
  it('detects identical scans', () => {
    expect(diffTracks(lib(), lib()).identical).toBe(true);
  });
  it('reports added, removed and changed tracks', () => {
    const next = lib();
    next[0] = { ...next[0]!, trackNumber: 9 };
    next.pop();
    next.push(track({ uri: 'spotify:local:C:Three:c1:1', title: 'c1', album: 'Three' }));
    const d = diffTracks(lib(), next);
    expect(d).toMatchObject({
      added: ['spotify:local:C:Three:c1:1'],
      removed: ['spotify:local:B:Two:b1:1'],
      changed: ['spotify:local:A:One:a1:1'],
      identical: false,
    });
  });
  it('treats a reorder as not identical', () => {
    expect(diffTracks(lib(), lib().reverse()).identical).toBe(false);
  });
});

describe('rebuildLibrary', () => {
  it('returns the same Library object when nothing changed', () => {
    const first = rebuildLibrary(undefined, lib());
    expect(rebuildLibrary(first, lib())).toBe(first);
  });
  it('keeps unchanged albums identical and replaces changed ones', () => {
    const first = rebuildLibrary(undefined, lib());
    const next = lib();
    next[2] = { ...next[2]!, title: 'b1 (remaster)' };
    const second = rebuildLibrary(first, next);
    expect(second).not.toBe(first);
    expect(second.albumsByKey.get('one')).toBe(first.albumsByKey.get('one'));
    expect(second.albumsByKey.get('two')).not.toBe(first.albumsByKey.get('two'));
    expect(second.albumsByKey.get('two')!.tracks[0]!.title).toBe('b1 (remaster)');
  });
});

function memoryCache(initial: Record<string, unknown> = {}): KeyValueStore & { data: Map<string, unknown>; sets: number } {
  const data = new Map(Object.entries(initial));
  const cache = {
    data,
    sets: 0,
    get: async <T,>(k: string) => data.get(k) as T | undefined,
    set: async (k: string, v: unknown) => {
      cache.sets++;
      data.set(k, v);
    },
  };
  return cache;
}

const okTracks = (tracks: Track[]): Promise<Result<Track[]>> => Promise.resolve({ ok: true, value: tracks });

describe('library store', () => {
  it('loads live, then caches the scan', async () => {
    const cache = memoryCache();
    const store = createLibraryStore({ fetchTracks: () => okTracks(lib()), cache });
    await store.start();
    const st = store.getState() as Extract<LibraryState, { status: 'ready' }>;
    expect(st).toMatchObject({ status: 'ready', source: 'live', refreshing: false });
    expect(st.library.albums).toHaveLength(2);
    expect((cache.data.get('library') as { tracks: Track[] }).tracks).toHaveLength(3);
  });

  it('paints the cached library before the live scan finishes', async () => {
    const cache = memoryCache({ library: { schema: CACHE_SCHEMA, savedAt: 1, tracks: lib() } });
    let release!: (r: Result<Track[]>) => void;
    const store = createLibraryStore({ fetchTracks: () => new Promise((r) => (release = r)), cache });
    const seen: string[] = [];
    store.subscribe(() => {
      const s = store.getState();
      seen.push(s.status === 'ready' ? `${s.source}${s.refreshing ? '+refreshing' : ''}` : s.status);
    });
    const started = store.start();
    await vi.waitFor(() => expect(seen).toContain('cache+refreshing'));
    release({ ok: true, value: lib() });
    await started;
    expect(seen.at(-1)).toBe('live');
    expect(cache.sets).toBe(0); // live scan identical to cache → no write
  });

  it('ignores caches from an older schema', async () => {
    const cache = memoryCache({ library: { schema: CACHE_SCHEMA - 1, savedAt: 1, tracks: lib() } });
    const store = createLibraryStore({ fetchTracks: () => new Promise(() => {}), cache });
    void store.start();
    await new Promise((r) => setTimeout(r, 10));
    expect(store.getState().status).toBe('loading');
  });

  it('keeps the cached library when a live scan fails', async () => {
    const cache = memoryCache({ library: { schema: CACHE_SCHEMA, savedAt: 1, tracks: lib() } });
    const store = createLibraryStore({
      fetchTracks: () => Promise.resolve({ ok: false, error: { code: 'unavailable', message: 'gone' } }),
      cache,
    });
    await store.start();
    expect(store.getState()).toMatchObject({ status: 'ready', source: 'cache', staleError: { message: 'gone' } });
  });

  it('errors when there is neither cache nor a live library', async () => {
    const store = createLibraryStore({
      fetchTracks: () => Promise.resolve({ ok: false, error: { code: 'unavailable', message: 'gone' } }),
      cache: memoryCache(),
    });
    await store.start();
    expect(store.getState()).toMatchObject({ status: 'error' });
  });

  it('shares one scan between concurrent refreshes and rescans on external change', async () => {
    const fetchTracks = vi.fn(() => okTracks(lib()));
    let fire!: () => void;
    const store = createLibraryStore({
      fetchTracks,
      cache: memoryCache(),
      onExternalChange: (cb) => ((fire = cb), () => {}),
      debounceMs: 1,
    });
    await store.start();
    expect(fetchTracks).toHaveBeenCalledTimes(1);
    await Promise.all([store.refresh(), store.refresh()]);
    expect(fetchTracks).toHaveBeenCalledTimes(2);
    fire();
    fire();
    await vi.waitFor(() => expect(fetchTracks).toHaveBeenCalledTimes(3));
  });

  it('persists header tints', async () => {
    vi.useFakeTimers();
    const cache = memoryCache();
    const store = createLibraryStore({ fetchTracks: () => okTracks(lib()), cache });
    store.setTint('cover', '#112233');
    expect(store.getTint('cover')).toBe('#112233');
    await vi.advanceTimersByTimeAsync(1100);
    expect(cache.data.get('tints')).toEqual({ cover: '#112233' });
    vi.useRealTimers();
  });
});
