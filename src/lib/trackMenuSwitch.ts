// On/off switch for the extension's "Go to album (Crate)" track-menu item, shared by the app
// (Diagnostics toggle) and the extension. They share no variables, so: localStorage for the stored
// value, a window CustomEvent carrying the new value for live changes.
//
// Why it exists (2026-10-20, Spotify 1.3.5 / Spicetify 2.45.3): right-click on local tracks stopped
// opening anywhere in Spotify while the app's own TrackMenu (where the item is not injected) worked.

import { readUi, writeUi } from './uiState';

const KEY = 'trackMenuItem';
export const TRACK_MENU_EVENT = `${__APP_ID__}:track-menu-item`;

export function isTrackMenuItemEnabled(): boolean {
  return readUi<boolean>(KEY, true, true);
}

export function setTrackMenuItemEnabled(enabled: boolean): void {
  writeUi(KEY, enabled, true);
  window.dispatchEvent(new CustomEvent<boolean>(TRACK_MENU_EVENT, { detail: enabled }));
}
