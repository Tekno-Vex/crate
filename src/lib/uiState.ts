// Per-view UI state (search, sort, scroll). Session memory for everything; `persist` also writes to
// localStorage so it survives a Spotify restart. Storage failures are ignored — UI state is a nicety.

const mem = new Map<string, unknown>();
const LS_PREFIX = `${__APP_ID__}:ui:`;

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function readUi<T>(key: string, fallback: T, persist = false): T {
  if (mem.has(key)) return mem.get(key) as T;
  if (persist) {
    try {
      const raw = storage()?.getItem(LS_PREFIX + key);
      if (raw != null) {
        const value = JSON.parse(raw) as T;
        mem.set(key, value);
        return value;
      }
    } catch {
      // corrupt or unavailable — use the fallback
    }
  }
  return fallback;
}

export function writeUi(key: string, value: unknown, persist = false): void {
  mem.set(key, value);
  if (!persist) return;
  try {
    storage()?.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch {
    // quota / unavailable — memory still has it for this session
  }
}
