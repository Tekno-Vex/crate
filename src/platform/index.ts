/* eslint-disable @typescript-eslint/no-explicit-any */
// THE adapter over Spotify/Spicetify internals. The only module allowed to touch
// Spicetify.Platform, Spicetify.Player, CosmosAsync, ContextMenu, etc.
// Every call feature-detects and returns a Result instead of throwing into the UI.

import { log } from '../lib/log';
import type { Track } from '../domain/model';
import { mapLocalTracks } from './mapLocalTrack';

export type PlatformErrorCode = 'not-ready' | 'unavailable' | 'failed';
export interface PlatformError {
  code: PlatformErrorCode;
  message: string;
  detail?: unknown;
}
export type Result<T> = { ok: true; value: T } | { ok: false; error: PlatformError };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(code: PlatformErrorCode, message: string, detail?: unknown): Result<T> => ({
  ok: false,
  error: { code, message, detail },
});

const S = (): any => (globalThis as any).Spicetify;

// ───────────────────────── readiness & versions ─────────────────────────

/** Resolves once the pieces we depend on exist. The extension must await this first. */
export async function whenReady(timeoutMs = 30_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const s = S();
    if (s?.Platform && s?.React && s?.ReactDOM && s?.Player && s?.showNotification) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  log.warn('Spicetify not ready after', timeoutMs, 'ms');
  return false;
}

export interface Versions {
  app: string;
  spotify?: string;
  spicetify?: string;
  os?: string;
  osVersion?: string;
  platform?: string;
  /** Primitive PlatformData fields, so Diagnostics shows the real key names. */
  platformData?: Record<string, string | number | boolean>;
}

function osFromPlatform(p: unknown): string | undefined {
  if (typeof p !== 'string') return undefined;
  if (p.startsWith('Win')) return 'windows';
  if (p.startsWith('OSX') || p.startsWith('Mac')) return 'macos';
  if (p.startsWith('Linux')) return 'linux';
  return undefined;
}

export function getVersions(): Versions {
  const s = S();
  const pd = s?.Platform?.PlatformData ?? {};
  // Verified 2026-10-20 on 1.3.5.3058 (Windows): PlatformData only has os_version, app_platform,
  // client_variant, is_developer_mode, remote_config_client_id — no client_version_* / os_name.
  // The CEF user agent carries "Spotify/<version>", so use it as the fallback.
  const uaVersion = /Spotify\/([\d.]+)/.exec(globalThis.navigator?.userAgent ?? '')?.[1];
  const platformData: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(pd)) {
    if (['string', 'number', 'boolean'].includes(typeof v)) platformData[k] = v as string | number | boolean;
  }
  return {
    app: __APP_VERSION__,
    spotify: pd.client_version_quadruple ?? pd.client_version_triple ?? uaVersion,
    spicetify: s?.Config?.version,
    os: pd.os_name ?? osFromPlatform(pd.app_platform),
    osVersion: pd.os_version,
    platform: pd.app_platform,
    platformData,
  };
}

/** Top-level Spicetify.Platform API names — Diagnostics uses this to find what moved. */
export function listPlatformApis(): string[] {
  const p = S()?.Platform;
  return p ? Object.keys(p).sort() : [];
}

export function describeApi(name: string): string[] {
  const api = S()?.Platform?.[name];
  if (!api) return [];
  const keys = new Set<string>(Object.keys(api));
  let proto = Object.getPrototypeOf(api);
  while (proto && proto !== Object.prototype) {
    for (const k of Object.getOwnPropertyNames(proto)) if (k !== 'constructor') keys.add(k);
    proto = Object.getPrototypeOf(proto);
  }
  return [...keys].sort();
}

// ───────────────────────── local files ─────────────────────────

/** Raw objects from Spotify. UNVERIFIED (spike S1): API name and method. */
export async function getLocalTracksRaw(): Promise<Result<unknown[]>> {
  const api = S()?.Platform?.LocalFilesAPI;
  if (!api) return fail('unavailable', 'Spicetify.Platform.LocalFilesAPI not found on this Spotify version');
  if (typeof api.getTracks !== 'function') {
    return fail('unavailable', 'LocalFilesAPI.getTracks is not a function', describeApi('LocalFilesAPI'));
  }
  try {
    const res = await api.getTracks();
    const list = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : null;
    if (!list) return fail('failed', 'Unexpected getTracks() result shape', res);
    return ok(list);
  } catch (e) {
    return fail('failed', 'LocalFilesAPI.getTracks() threw', String(e));
  }
}

export async function getLocalTracks(): Promise<Result<Track[]>> {
  const raw = await getLocalTracksRaw();
  if (!raw.ok) return raw;
  return ok(mapLocalTracks(raw.value));
}

// ───────────────────────── playback ─────────────────────────

export type PlayStrategy = 'local-files-context' | 'app-context' | 'queue-fallback';

/**
 * Play an ordered list of URIs starting at `index`.
 * UNVERIFIED (spike S3): which context shape gives working next/prev/shuffle.
 * Default stays on the fallback until S3 picks a winner.
 */
export async function playTracks(
  uris: string[],
  index = 0,
  strategy: PlayStrategy = 'queue-fallback',
): Promise<Result<PlayStrategy>> {
  const s = S();
  const api = s?.Platform?.PlayerAPI;
  if (!uris.length) return fail('failed', 'Nothing to play');
  try {
    if (strategy !== 'queue-fallback') {
      if (!api?.play) return fail('unavailable', 'PlayerAPI.play not found');
      const contextUri =
        strategy === 'local-files-context' ? 'spotify:internal:local-files' : `spotify:app:${__APP_ID__}`;
      await api.play(
        { uri: contextUri, pages: [{ items: uris.map((uri) => ({ uri })) }] },
        {},
        { skipTo: { index, uri: uris[index] } },
      );
      return ok(strategy);
    }
    // Fallback: play the chosen track, queue the rest. Next works; shuffle/prev don't know the album.
    const first = uris[index]!;
    await s.Player.playUri(first);
    const rest = uris.slice(index + 1).map((uri) => ({ uri }));
    if (rest.length && api?.addToQueue) await api.addToQueue(rest);
    return ok('queue-fallback');
  } catch (e) {
    return fail('failed', `play (${strategy}) threw`, String(e));
  }
}

export function getCurrentTrackUri(): string | undefined {
  return S()?.Player?.data?.item?.uri ?? S()?.Player?.data?.track?.uri;
}

export function onSongChange(cb: (uri: string | undefined) => void): () => void {
  const player = S()?.Player;
  if (!player?.addEventListener) return () => {};
  const handler = () => cb(getCurrentTrackUri());
  player.addEventListener('songchange', handler);
  return () => player.removeEventListener?.('songchange', handler);
}

// ───────────────────────── navigation ─────────────────────────

export interface Location {
  pathname: string;
  search?: string;
  state?: Record<string, unknown>;
}

export function currentLocation(): Location {
  return S()?.Platform?.History?.location ?? { pathname: `/${__APP_ID__}` };
}

export function navigate(pathname: string, state?: Record<string, unknown>): void {
  const history = S()?.Platform?.History;
  if (!history) return log.warn('History unavailable; cannot navigate to', pathname);
  history.push(state ? { pathname, state } : pathname);
}

export function onLocationChange(cb: (loc: Location) => void): () => void {
  const history = S()?.Platform?.History;
  if (!history?.listen) return () => {};
  return history.listen((loc: Location) => cb(loc));
}

// ───────────────────────── UI helpers ─────────────────────────

export function notify(message: string, isError = false): void {
  S()?.showNotification?.(message, isError);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const clip = S()?.Platform?.ClipboardAPI;
    if (clip?.copy) {
      await clip.copy(text);
      return true;
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    log.warn('clipboard failed', e);
    return false;
  }
}

/** UNVERIFIED (spike S7): whether this works for spotify:local: URIs. */
export async function extractColors(uri: string): Promise<Result<Record<string, string>>> {
  const fn = S()?.colorExtractor;
  if (typeof fn !== 'function') return fail('unavailable', 'colorExtractor not found');
  try {
    return ok(await fn(uri));
  } catch (e) {
    return fail('failed', 'colorExtractor threw', String(e));
  }
}

// ───────────────────────── context menu ─────────────────────────

export function registerTrackMenuItem(
  label: string,
  shouldAdd: (uris: string[]) => boolean,
  onClick: (uris: string[]) => void,
): Result<() => void> {
  const CM = S()?.ContextMenu;
  if (!CM?.Item) return fail('unavailable', 'Spicetify.ContextMenu.Item not found');
  try {
    const item = new CM.Item(label, (uris: string[]) => onClick(uris), (uris: string[]) => shouldAdd(uris), 'album');
    item.register();
    return ok(() => item.deregister());
  } catch (e) {
    return fail('failed', 'ContextMenu registration threw', String(e));
  }
}
