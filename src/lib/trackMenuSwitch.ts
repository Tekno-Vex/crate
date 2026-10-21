// On/off switch for the extension's "Go to album (Crate)" track-menu item, shared by the app
// (Diagnostics toggle) and the extension. They share no variables, so: localStorage for the stored
// value, a window CustomEvent carrying the new value for live changes.
//
// History (2026-10-20): on Spotify 1.3.5 with Spicetify 2.45.3 the item broke native menus for local
// tracks. Cause: that Spicetify didn't support 1.3.5 (it broke the profile menu too). Spicetify 2.46.2
// fixed it — item works, menus fine. Default is now ON unless the running versions are the known-bad
// combination (domain/compat.ts); an explicit user choice always wins.

import { readUi, writeUi } from './uiState';

// v3: default back to on (version-aware). New key so choices made while it was broken don't stick.
const KEY = 'trackMenuItem.v3';
export const TRACK_MENU_EVENT = `${__APP_ID__}:track-menu-item`;

/** `safeByDefault`: from menuItemsSafe(spicetify, spotify) — used when the user never chose. */
export function isTrackMenuItemEnabled(safeByDefault = true): boolean {
  return readUi<boolean>(KEY, safeByDefault, true);
}

export function setTrackMenuItemEnabled(enabled: boolean): void {
  writeUi(KEY, enabled, true);
  window.dispatchEvent(new CustomEvent<boolean>(TRACK_MENU_EVENT, { detail: enabled }));
}
