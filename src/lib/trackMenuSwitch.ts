// On/off switch for the extension's "Go to album (Crate)" track-menu item, shared by the app
// (Diagnostics toggle) and the extension. They share no variables, so: localStorage for the stored
// value, a window CustomEvent carrying the new value for live changes.
//
// Verified 2026-10-20 (Spotify 1.3.5 / Spicetify 2.45.3): with the item registered via
// Spicetify.ContextMenu.Item, right-click and the ⋯ button on local tracks in native playlists stop
// opening at all, and the item itself never shows. Off → menus work again. So it is OFF by default
// (opt-in, experimental) until M2 finds a registration that works on 1.3.x.

import { readUi, writeUi } from './uiState';

// v2: the default flipped to off; a new key resets anyone who had it on under the old default.
const KEY = 'trackMenuItem.v2';
export const TRACK_MENU_EVENT = `${__APP_ID__}:track-menu-item`;

export function isTrackMenuItemEnabled(): boolean {
  return readUi<boolean>(KEY, false, true);
}

export function setTrackMenuItemEnabled(enabled: boolean): void {
  writeUi(KEY, enabled, true);
  window.dispatchEvent(new CustomEvent<boolean>(TRACK_MENU_EVENT, { detail: enabled }));
}
