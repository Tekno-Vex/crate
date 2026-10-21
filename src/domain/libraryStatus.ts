// Why the library is empty or unreadable, from what Spotify tells us. Pure, so every branch is tested.

export type LibraryProblem =
  | { kind: 'ok' }
  /** "Show Local Files" is off in Spotify settings. */
  | { kind: 'disabled' }
  /** Local files are on, but no folder (or default source) is set up. */
  | { kind: 'no-folders' }
  /** Folders exist but Spotify found no playable files in them. */
  | { kind: 'empty-folders'; folders: string[] }
  /** The local-files API we rely on is missing — Spotify changed its internals. */
  | { kind: 'api-changed'; message: string }
  /** The API exists but reading failed. */
  | { kind: 'scan-failed'; message: string };

export interface LibraryFacts {
  trackCount: number;
  /** Error from the last scan, if it failed. code 'unavailable' = API missing. */
  scanError?: { code: string; message: string };
  /** From LocalFilesAPI.getIsEnabled(); undefined when unknown. */
  enabled?: boolean;
  folders?: string[];
  /** Spotify's built-in sources (Downloads, Music library) that are switched on. */
  enabledDefaultSources?: number;
}

export function diagnoseLibrary(f: LibraryFacts): LibraryProblem {
  if (f.scanError) {
    // A disabled feature can make the API refuse — say what the user can fix first.
    if (f.enabled === false) return { kind: 'disabled' };
    return f.scanError.code === 'unavailable'
      ? { kind: 'api-changed', message: f.scanError.message }
      : { kind: 'scan-failed', message: f.scanError.message };
  }
  if (f.trackCount > 0) return { kind: 'ok' };
  if (f.enabled === false) return { kind: 'disabled' };
  const folders = f.folders ?? [];
  if (folders.length === 0 && !f.enabledDefaultSources) return { kind: 'no-folders' };
  return { kind: 'empty-folders', folders };
}
