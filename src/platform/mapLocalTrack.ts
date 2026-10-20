/* eslint-disable @typescript-eslint/no-explicit-any */
// Maps whatever Spotify's LocalFilesAPI returns into our Track model.
// The raw shape is UNVERIFIED (spike S1) — read every field defensively and accept common variants.
// Pure: no Spicetify access, so it is unit-tested.

import { splitArtists } from '../domain/artists';
import type { Track } from '../domain/model';
import { parseLocalUri } from '../domain/localUri';

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : undefined;
};

function durationMs(raw: any): number {
  const d = raw?.duration;
  if (typeof d === 'number') return d > 10_000 ? d : d * 1000; // seconds vs ms
  return num(d?.milliseconds) ?? num(raw?.duration_ms) ?? num(raw?.durationMs) ?? 0;
}

/** spotify:image:<id> → https; everything else (e.g. spotify:localfileimage:…) passes through. */
export function toImageUrl(uri: string | undefined): string | undefined {
  if (!uri) return undefined;
  const m = /^spotify:image:([0-9a-f]+)$/i.exec(uri);
  return m ? `https://i.scdn.co/image/${m[1]}` : uri;
}

function pickImage(raw: any): string | undefined {
  const images: any[] = raw?.album?.images ?? raw?.images ?? raw?.album?.coverArt?.sources ?? [];
  if (!Array.isArray(images) || images.length === 0) return toImageUrl(str(raw?.album?.image));
  const best = [...images].sort((a, b) => (num(b?.width) ?? 0) - (num(a?.width) ?? 0))[0];
  return toImageUrl(str(best?.url) ?? str(best?.uri));
}

function artistDisplay(raw: any): string {
  const list: any[] = Array.isArray(raw?.artists) ? raw.artists : [];
  const names = list.map((a) => str(a?.name) ?? str(a)).filter((x): x is string => !!x);
  if (names.length) return names.join(', ');
  return str(raw?.artist?.name) ?? str(raw?.artist) ?? '';
}

export function mapLocalTrack(raw: any, originalIndex: number): Track | null {
  const uri = str(raw?.uri);
  if (!uri) return null;
  const fromUri = parseLocalUri(uri);
  const display = artistDisplay(raw) || fromUri?.artist || '';
  const added = raw?.addedAt ?? raw?.added_at ?? raw?.dateAdded;
  return {
    uri,
    title: str(raw?.name) ?? str(raw?.title) ?? fromUri?.title ?? 'Unknown Title',
    artists: splitArtists(display),
    artistDisplay: display,
    album: str(raw?.album?.name) ?? str(raw?.album) ?? fromUri?.album ?? '',
    // UNVERIFIED (spike S1): field names for track/disc numbers on local tracks.
    trackNumber: num(raw?.trackNumber) ?? num(raw?.track_number) ?? num(raw?.trackIndex),
    discNumber: num(raw?.discNumber) ?? num(raw?.disc_number),
    durationMs: durationMs(raw) || (fromUri?.durationSec ?? 0) * 1000,
    imageUrl: pickImage(raw),
    addedAt: typeof added === 'number' ? added : typeof added === 'string' ? Date.parse(added) || undefined : undefined,
    source: 'spotify',
    originalIndex,
  };
}

export function mapLocalTracks(raws: unknown[]): Track[] {
  const out: Track[] = [];
  raws.forEach((raw, i) => {
    const t = mapLocalTrack(raw, i);
    if (t) out.push(t);
  });
  return out;
}

/** Field inventory across raw objects (dot paths, depth ≤ 3) — used by Diagnostics for spike S1. */
export function fieldInventory(raws: unknown[], maxDepth = 3): Record<string, { count: number; types: string[] }> {
  const inv: Record<string, { count: number; types: Set<string> }> = {};
  const walk = (v: any, p: string, depth: number) => {
    if (p) {
      const type = Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v;
      const e = (inv[p] ??= { count: 0, types: new Set() });
      e.count++;
      e.types.add(type);
    }
    if (depth >= maxDepth || v === null || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      if (v.length) walk(v[0], `${p}[]`, depth + 1);
      return;
    }
    for (const k of Object.keys(v)) walk(v[k], p ? `${p}.${k}` : k, depth + 1);
  };
  raws.forEach((r) => walk(r, '', 0));
  return Object.fromEntries(
    Object.entries(inv)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, e]) => [k, { count: e.count, types: [...e.types] }]),
  );
}
