import { useEffect, useSyncExternalStore } from 'react';
import { libraryStore, type LibraryState } from './libraryStore';

export type { LibraryState };

/** Subscribe to the library store. Starting is idempotent; every page shares one library. */
export function useLibrary(): LibraryState & { reload: () => void } {
  const store = libraryStore();
  const state = useSyncExternalStore(store.subscribe, store.getState);
  useEffect(() => {
    void store.start();
  }, [store]);
  return { ...state, reload: () => void store.refresh() };
}
