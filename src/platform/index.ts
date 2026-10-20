/* eslint-disable @typescript-eslint/no-explicit-any */
// THE adapter over Spotify/Spicetify internals. The only module allowed to touch
// Spicetify.Platform, Spicetify.Player, CosmosAsync, ContextMenu, etc.
// Every call feature-detects and returns a Result instead of throwing into the UI.

import { log } from '../lib/log';
import { pickHeaderColor } from '../domain/color';
import { isLocalUri } from '../domain/localUri';
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
  /** UNVERIFIED (spike S1): top-level Platform.version / Platform.operatingSystem values. */
  platformVersion?: unknown;
  operatingSystem?: unknown;
  /** Renderer origin — the helper's CORS allow-list needs this (spike S2). */
  origin?: string;
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
    // Verified 1.3.5: Platform.version = "1.3.5.3058".
    spotify:
      (typeof s?.Platform?.version === 'string' ? s.Platform.version : undefined) ??
      pd.client_version_quadruple ??
      pd.client_version_triple ??
      uaVersion,
    spicetify: s?.Config?.version,
    os: pd.os_name ?? osFromPlatform(pd.app_platform),
    osVersion: pd.os_version,
    platform: pd.app_platform,
    platformData,
    platformVersion: primitiveOrKeys(s?.Platform?.version),
    operatingSystem: primitiveOrKeys(s?.Platform?.operatingSystem),
    origin: globalThis.location?.origin,
  };
}

function primitiveOrKeys(v: unknown): unknown {
  if (v === null || typeof v !== 'object') return typeof v === 'function' ? '[function]' : v;
  return { keys: Object.keys(v) };
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

/**
 * Folders Spotify scans for local files. Verified on 1.3.5 (spike S6, 2026-10-20):
 * { defaultSources: [{ id: 'downloads' | 'windows_music_library', enabled }], folders: [{ path }] }.
 */
export async function getLocalSourcesRaw(): Promise<Result<unknown>> {
  const api = S()?.Platform?.LocalFilesAPI;
  if (typeof api?.getSources !== 'function') return fail('unavailable', 'LocalFilesAPI.getSources not found');
  try {
    return ok(await api.getSources());
  } catch (e) {
    return fail('failed', 'LocalFilesAPI.getSources() threw', String(e));
  }
}

/**
 * Event names we try on LocalFilesAPI.getEvents(). UNVERIFIED (spike S4): the API has _emitUpdate /
 * _emitTrackUpdate on 1.3.5 but the event names are unknown — describeLocalFilesEvents() finds them.
 * Subscribing to a name that never fires is harmless; the store also rescans on open/focus.
 */
const LOCAL_FILES_EVENT_CANDIDATES = ['update', 'tracks_update', 'track_update', 'tracksUpdate', 'trackUpdate'];

function localFilesEmitter(): any {
  const api = S()?.Platform?.LocalFilesAPI;
  try {
    return typeof api?.getEvents === 'function' ? api.getEvents() : api?._events;
  } catch {
    return undefined;
  }
}

/** Calls `cb` when Spotify reports local files changed. Returns an unsubscribe function. */
export function onLocalTracksChanged(cb: () => void): () => void {
  const em = localFilesEmitter();
  const add = em?.addListener ?? em?.on;
  const remove = em?.removeListener ?? em?.off;
  if (typeof add !== 'function') return () => {};
  const subs: (() => void)[] = [];
  for (const name of LOCAL_FILES_EVENT_CANDIDATES) {
    try {
      const ret = add.call(em, name, cb);
      subs.push(typeof ret === 'function' ? ret : () => remove?.call(em, name, cb));
    } catch {
      // emitter rejected the name — ignore
    }
  }
  return () => subs.forEach((off) => off());
}

/** Diagnostics: shape of LocalFilesAPI's event emitter, including event names Spotify listens to. */
export function describeLocalFilesEvents(): unknown {
  const em = localFilesEmitter();
  if (!em) return { found: false };
  // 1.3.5: the wrapper holds `_emitter`, whose `_listeners` / `_metaListeners` are keyed by event
  // name — walk a few levels and report the keys of every map-like value.
  const listenerNames: Record<string, string[]> = {};
  const walk = (v: unknown, path: string, depth: number) => {
    if (!v || typeof v !== 'object' || Array.isArray(v) || depth > 3) return;
    const entries: [string, unknown][] =
      v instanceof Map ? [...v.entries()].map(([k, x]) => [String(k), x]) : Object.entries(v);
    listenerNames[path] = entries.map(([k]) => k);
    for (const [k, x] of entries) if (!(x instanceof Function)) walk(x, `${path}.${k}`, depth + 1);
  };
  for (const [k, v] of Object.entries(em)) walk(v, k, 0);
  let proto = Object.getPrototypeOf(em);
  const methods = new Set<string>();
  while (proto && proto !== Object.prototype) {
    for (const k of Object.getOwnPropertyNames(proto)) if (k !== 'constructor') methods.add(k);
    proto = Object.getPrototypeOf(proto);
  }
  return { found: true, ownKeys: Object.keys(em), methods: [...methods].sort(), listenerNames };
}

/** Raw objects from Spotify. Verified on 1.3.5 (S1): getTracks() resolves to a plain array. */
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
 * Verified on 1.3.5 (spike S3, 2026-10-20): both context strategies play OUR page order (a
 * reversed 3-2-1 list played 3 → 2 → 1), Next/Prev work, and local-files-context shows
 * "Local Files" as the source. queue-fallback plays NOTHING (Player.playUri ignores
 * spotify:local: URIs) — kept only for Diagnostics.
 */
export async function playTracks(
  uris: string[],
  index = 0,
  strategy: PlayStrategy = 'local-files-context',
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

export interface PlayerSnapshot {
  contextUri?: string;
  current?: string;
  /** Upcoming context tracks (PlayerAPI state.nextItems), first 5. */
  next: string[];
  previous: string[];
  /** User-queued tracks (getQueue().queued), first 5. */
  queued: string[];
}

const uris = (list: unknown, n = 5): string[] =>
  Array.isArray(list) ? list.slice(0, n).map((x: any) => x?.uri).filter((u): u is string => typeof u === 'string') : [];

/**
 * What the player is playing and what comes next. Verified on 1.3.5 (spike S3, 2026-10-20):
 * getState() → { context: { uri }, item: { uri }, nextItems[], previousItems[], index, shuffle, … };
 * getQueue() → { current, queued[], nextUp[] }.
 */
export async function getPlayerSnapshot(): Promise<Result<PlayerSnapshot>> {
  const api = S()?.Platform?.PlayerAPI;
  if (!api?.getState) return fail('unavailable', 'PlayerAPI.getState not found');
  try {
    const state = await api.getState();
    const queue = api.getQueue ? await api.getQueue() : undefined;
    return ok({
      contextUri: state?.context?.uri,
      current: state?.item?.uri,
      next: uris(state?.nextItems),
      previous: uris(state?.previousItems),
      queued: uris(queue?.queued),
    });
  } catch (e) {
    return fail('failed', 'PlayerAPI snapshot threw', String(e));
  }
}

/**
 * Current shuffle mode, read synchronously from Player.data. Verified 1.3.5 (2026-10-20): a boolean
 * that follows both our toggle and the player bar's.
 */
export function getShuffle(): boolean {
  const p = S()?.Player;
  const v = p?.data?.shuffle ?? (typeof p?.getShuffle === 'function' ? p.getShuffle() : undefined);
  return v === true;
}

/**
 * Calls `cb` when shuffle mode changes, including toggles from Spotify's player bar. No verified
 * shuffle event exists on 1.3.5, so this polls the (synchronous) state — one property read per tick.
 */
export function onShuffleChange(cb: (on: boolean) => void, intervalMs = 500): () => void {
  let last = getShuffle();
  const timer = setInterval(() => {
    const now = getShuffle();
    if (now !== last) cb((last = now));
  }, intervalMs);
  return () => clearInterval(timer);
}

/** Verified 1.3.5 (S3 follow-up, 2026-10-20): PlayerAPI.setShuffle(boolean) toggles global shuffle. */
export async function setShuffle(on: boolean): Promise<Result<boolean>> {
  const s = S();
  const api = s?.Platform?.PlayerAPI;
  try {
    if (typeof api?.setShuffle === 'function') await api.setShuffle(on);
    else if (typeof s?.Player?.setShuffle === 'function') await s.Player.setShuffle(on);
    else return fail('unavailable', 'setShuffle not found');
    return ok(on);
  } catch (e) {
    return fail('failed', 'setShuffle threw', String(e));
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

/**
 * Verified 1.3.5 (spike S7, 2026-10-20): resolves null for spotify:local: URIs — useful only for
 * catalog URIs. Local covers go through sampleImagePixels + pickHeaderColor instead.
 */
export async function extractColors(uri: string): Promise<Result<Record<string, string>>> {
  const fn = S()?.colorExtractor;
  if (typeof fn !== 'function') return fail('unavailable', 'colorExtractor not found');
  try {
    const res = await fn(uri);
    if (!res || typeof res !== 'object' || !Object.values(res).some((v) => typeof v === 'string' && v)) {
      return fail('failed', 'colorExtractor returned no colors', res);
    }
    return ok(res);
  } catch (e) {
    return fail('failed', 'colorExtractor threw', String(e));
  }
}

/**
 * Downscaled RGBA pixels of an image the renderer can load (e.g. spotify:localfileimage:…).
 * Verified 1.3.5 (spike S7): local covers don't taint the canvas; ~30–45 ms per cover at 32px.
 */
export function sampleImagePixels(url: string, size = 32, timeoutMs = 4000): Promise<Result<Uint8ClampedArray>> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(fail('failed', 'image load timed out')), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(fail('unavailable', 'no 2d canvas context'));
        ctx.drawImage(img, 0, 0, size, size);
        resolve(ok(ctx.getImageData(0, 0, size, size).data));
      } catch (e) {
        resolve(fail('failed', 'canvas read blocked (tainted?)', String(e)));
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(fail('failed', 'image failed to load', url));
    };
    img.src = url;
  });
}

/** Header tint for an album: Spotify's extractor first, then our own pick from the cover pixels. */
export async function headerColor(
  trackUri: string,
  imageUrl: string | undefined,
): Promise<Result<{ color: string; source: 'colorExtractor' | 'canvas' }>> {
  if (!isLocalUri(trackUri)) {
    const ext = await extractColors(trackUri);
    const extColor = ext.ok ? (ext.value.DARK_VIBRANT ?? ext.value.PROMINENT ?? ext.value.VIBRANT) : undefined;
    if (extColor) return ok({ color: extColor, source: 'colorExtractor' });
  }
  if (!imageUrl) return fail('unavailable', 'no cover image');
  const px = await sampleImagePixels(imageUrl);
  if (!px.ok) return px;
  const color = pickHeaderColor(px.value);
  return color ? ok({ color, source: 'canvas' }) : fail('failed', 'cover has no usable pixels');
}

/** Names on Spicetify.ReactComponent (spike S7: which native primitives exist on this version). */
export function listReactComponents(): string[] {
  const rc = S()?.ReactComponent;
  return rc ? Object.keys(rc).sort() : [];
}

// ───────────────────────── context menu ─────────────────────────

/** Diagnostics: Spicetify's menu-extension APIs on this version (ContextMenu, ContextMenuV2, …). */
export function describeMenuApis(): Record<string, string[]> {
  const s = S() ?? {};
  const out: Record<string, string[]> = {};
  for (const name of Object.keys(s).filter((k) => /menu/i.test(k))) {
    const v = s[name];
    out[name] = v && (typeof v === 'object' || typeof v === 'function') ? Object.keys(v).sort() : [typeof v];
  }
  return out;
}

export function registerTrackMenuItem(
  label: string,
  shouldAdd: (uris: string[]) => boolean,
  onClick: (uris: string[]) => void,
): Result<() => void> {
  const CM = S()?.ContextMenu;
  if (!CM?.Item) return fail('unavailable', 'Spicetify.ContextMenu.Item not found');
  // Spicetify calls these inside Spotify's own menu render: a throw there can break the native menu
  // for every page, so neither may ever throw. Icon only if this Spicetify version knows it.
  const safeShouldAdd = (uris: unknown) => {
    try {
      return Array.isArray(uris) && shouldAdd(uris as string[]);
    } catch (e) {
      log.warn(`menu item "${label}" shouldAdd threw`, e);
      return false;
    }
  };
  const safeOnClick = (uris: unknown) => {
    try {
      if (Array.isArray(uris)) onClick(uris as string[]);
    } catch (e) {
      log.error(`menu item "${label}" failed`, e);
    }
  };
  const icon = S()?.SVGIcons?.album ? 'album' : undefined;
  try {
    const item = new CM.Item(label, safeOnClick, safeShouldAdd, icon);
    item.register();
    return ok(() => item.deregister());
  } catch (e) {
    return fail('failed', 'ContextMenu registration threw', String(e));
  }
}

// ───────────────────────── top bar ─────────────────────────

export { describeTopBar, setTopBarColor } from './topBar';

// ───────────────────────── scrolling ─────────────────────────

export { describeScrollParent, findScrollParent } from './ui';

// ───────────────────────── native components ─────────────────────────

export { NativeTrackMenu, type MenuTriggerProps } from './components';
