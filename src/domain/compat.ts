// Version-dependent decisions. Pure, tested.

/** Compare dotted versions numerically ("1.3.10" > "1.3.9"); missing parts count as 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/**
 * Whether adding items to Spotify's menus is safe. Verified 2026-10-20: Spicetify 2.45.3 on Spotify
 * 1.3.5 (unsupported — 2.45.x supports ≤1.3.1) broke every menu Spicetify extends; 2.46.2 fixed it
 * (2.46.0 added 1.3.5/1.3.6 support). Unknown versions → assume safe.
 */
export function menuItemsSafe(spicetify: string | undefined, spotify: string | undefined): boolean {
  if (!spicetify || !spotify) return true;
  return !(compareVersions(spicetify, '2.46.0') < 0 && compareVersions(spotify, '1.3.2') >= 0);
}
