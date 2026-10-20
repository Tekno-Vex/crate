import { useState } from 'react';
import { readUi, writeUi } from '../lib/uiState';

/** useState that survives navigation (and, with `persist`, a Spotify restart). */
export function useUiState<T>(key: string, initial: T, persist = false): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => readUi(key, initial, persist));
  return [
    value,
    (next: T) => {
      writeUi(key, next, persist);
      setValue(next);
    },
  ];
}
