import { useCallback, useEffect, useState } from 'react';
import { buildLibrary } from '../domain/grouping';
import type { Library } from '../domain/model';
import { getLocalTracks, type PlatformError } from '../platform';

// TODO(M1): replace with a proper store — IndexedDB cache, diff on rescan, subscriptions,
// and helper-tag merge (M3). This module-level promise is just enough for the scaffold.

export type LibraryState =
  | { status: 'loading' }
  | { status: 'error'; error: PlatformError }
  | { status: 'ready'; library: Library; loadedAt: number; loadMs: number };

let inflight: Promise<LibraryState> | null = null;

async function load(): Promise<LibraryState> {
  const start = performance.now();
  const res = await getLocalTracks();
  if (!res.ok) return { status: 'error', error: res.error };
  const library = buildLibrary(res.value);
  return { status: 'ready', library, loadedAt: Date.now(), loadMs: Math.round(performance.now() - start) };
}

export function useLibrary(): LibraryState & { reload: () => void } {
  const [state, setState] = useState<LibraryState>({ status: 'loading' });

  const run = useCallback((force: boolean) => {
    if (force || !inflight) inflight = load();
    setState({ status: 'loading' });
    inflight.then(setState);
  }, []);

  useEffect(() => run(false), [run]);

  return { ...state, reload: () => run(true) };
}
