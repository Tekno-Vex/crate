// Library store: show the cached library instantly, rescan Spotify in the background, apply only
// what changed. One store per app session (the custom app's JS lives as long as Spotify does once
// opened), so navigating between pages never reloads the library.
//
// Dependencies are injected so tests run without Spotify or IndexedDB (tests/libraryStore.test.ts).

import { rebuildLibrary, diffTracks } from '../domain/libraryDiff';
import type { Library, Track } from '../domain/model';
import { kv, type KeyValueStore } from '../lib/idb';
import { log } from '../lib/log';
import { getLocalTracks, onLocalFilesEnabledChange, onLocalTracksChanged, type PlatformError, type Result } from '../platform';

/** Bump when the cached Track shape changes (mapper/model changes), to discard old caches. */
export const CACHE_SCHEMA = 1;
const LIBRARY_KEY = 'library';
const TINTS_KEY = 'tints';

interface CachedLibrary {
  schema: number;
  savedAt: number;
  tracks: Track[];
}

export type LibraryState =
  | { status: 'loading' }
  | { status: 'error'; error: PlatformError }
  | {
      status: 'ready';
      library: Library;
      /** Where the library currently shown came from. */
      source: 'cache' | 'live';
      updatedAt: number;
      refreshing: boolean;
      /** Last live-scan failure while a cached library is still shown. */
      staleError?: PlatformError;
    };

export interface LibraryStoreDeps {
  fetchTracks: () => Promise<Result<Track[]>>;
  cache: KeyValueStore;
  /** Subscribe to "local files changed" signals; returns unsubscribe. */
  onExternalChange?: (cb: () => void) => () => void;
  now?: () => number;
  debounceMs?: number;
}

export interface LibraryStore {
  getState(): LibraryState;
  subscribe(listener: () => void): () => void;
  /** First call: load cache, then rescan, then watch for changes. Later calls: rescan. */
  start(): Promise<void>;
  /** Rescan Spotify now; concurrent calls share one scan. */
  refresh(): Promise<void>;
  getTint(key: string): string | undefined;
  setTint(key: string, color: string): void;
  stop(): void;
}

export function createLibraryStore(deps: LibraryStoreDeps): LibraryStore {
  const now = deps.now ?? Date.now;
  let state: LibraryState = { status: 'loading' };
  const listeners = new Set<() => void>();
  let started: Promise<void> | null = null;
  let inflight: Promise<void> | null = null;
  let cachedTracks: Track[] | undefined;
  let unsubscribeExternal: (() => void) | undefined;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  const tints = new Map<string, string>();
  let tintSave: ReturnType<typeof setTimeout> | undefined;

  const set = (next: LibraryState) => {
    state = next;
    listeners.forEach((l) => l());
  };
  const current = () => (state.status === 'ready' ? state.library : undefined);

  async function loadCache() {
    const [cached, savedTints] = await Promise.all([
      deps.cache.get<CachedLibrary>(LIBRARY_KEY),
      deps.cache.get<Record<string, string>>(TINTS_KEY),
    ]);
    if (savedTints) for (const [k, v] of Object.entries(savedTints)) tints.set(k, v);
    if (cached?.schema !== CACHE_SCHEMA || !Array.isArray(cached.tracks)) return;
    cachedTracks ??= cached.tracks;
    // A live scan may already have landed (cache read raced it) — never overwrite live data.
    if (state.status === 'ready') return;
    set({
      status: 'ready',
      library: rebuildLibrary(undefined, cached.tracks),
      source: 'cache',
      updatedAt: cached.savedAt,
      // If the live scan already failed, show the cache but remember why it's stale.
      refreshing: state.status === 'loading',
      staleError: state.status === 'error' ? state.error : undefined,
    });
  }

  async function scan() {
    if (state.status === 'ready') set({ ...state, refreshing: true });
    const start = now();
    const res = await deps.fetchTracks();
    if (!res.ok) {
      if (state.status === 'ready') {
        log.warn('rescan failed; keeping cached library', res.error.message);
        set({ ...state, refreshing: false, staleError: res.error });
      } else {
        set({ status: 'error', error: res.error });
      }
      return;
    }
    const library = rebuildLibrary(current(), res.value);
    set({ status: 'ready', library, source: 'live', updatedAt: now(), refreshing: false });
    log.debug(`scan: ${res.value.length} tracks in ${now() - start} ms`);

    if (!cachedTracks || !diffTracks(cachedTracks, res.value).identical) {
      cachedTracks = res.value;
      await deps.cache.set(LIBRARY_KEY, { schema: CACHE_SCHEMA, savedAt: now(), tracks: res.value } satisfies CachedLibrary);
    }
  }

  const store: LibraryStore = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (started) return started.then(() => store.refresh());
      started = (async () => {
        // Cache and live scan run concurrently: the cache paints first, the scan replaces it.
        const cache = loadCache().catch((e) => log.warn('cache load failed', e));
        await Promise.all([cache, store.refresh()]);
        unsubscribeExternal = deps.onExternalChange?.(() => {
          clearTimeout(debounce);
          debounce = setTimeout(() => void store.refresh(), deps.debounceMs ?? 500);
        });
      })();
      return started;
    },
    refresh() {
      inflight ??= scan()
        .catch((e) => log.error('scan crashed', e))
        .finally(() => {
          inflight = null;
        });
      return inflight;
    },
    getTint: (key) => tints.get(key),
    setTint(key, color) {
      if (tints.get(key) === color) return;
      tints.set(key, color);
      clearTimeout(tintSave);
      tintSave = setTimeout(() => void deps.cache.set(TINTS_KEY, Object.fromEntries(tints)), 1000);
    },
    stop() {
      unsubscribeExternal?.();
      clearTimeout(debounce);
      clearTimeout(tintSave);
      listeners.clear();
    },
  };
  return store;
}

let defaultStore: LibraryStore | undefined;

/** The app's store, created on first use (never at module evaluation — Spicetify may not be ready). */
export function libraryStore(): LibraryStore {
  defaultStore ??= createLibraryStore({
    fetchTracks: getLocalTracks,
    cache: kv,
    onExternalChange: (cb) => {
      const offSpotify = onLocalTracksChanged(cb);
      const offEnabled = onLocalFilesEnabledChange(cb);
      // Rescan when Spotify regains focus — covers files added while the window was in background.
      const onFocus = () => cb();
      window.addEventListener('focus', onFocus);
      return () => {
        offSpotify();
        offEnabled();
        window.removeEventListener('focus', onFocus);
      };
    },
  });
  return defaultStore;
}
