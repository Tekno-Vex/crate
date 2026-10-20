// Runs at Spotify startup (manifest subfiles_extension). Shares no variables with the app.
// Keep it light: it runs on every Spotify launch.

import { isLocalUri, parseLocalUri } from '../domain/localUri';
import { albumKey, stripDiscSuffix } from '../domain/normalize';
import { log } from '../lib/log';
import { isTrackMenuItemEnabled, TRACK_MENU_EVENT } from '../lib/trackMenuSwitch';
import { navigate, registerTrackMenuItem, whenReady } from '../platform';

async function main() {
  if (!(await whenReady())) return;

  // Right-click a local track anywhere → open its Crate album page.
  // Key derivation must match groupAlbums() for Tier 1 (title only, disc suffix stripped).
  // Switchable at runtime from Diagnostics (see lib/trackMenuSwitch.ts for why).
  let deregister: (() => void) | undefined;
  const applyMenuItem = (enabled: boolean) => {
    if (enabled && !deregister) {
      const menu = registerTrackMenuItem(
        'Go to album (Crate)',
        (uris) => uris.length === 1 && isLocalUri(uris[0]!),
        (uris) => {
          const parts = parseLocalUri(uris[0]!);
          if (!parts) return;
          const { title } = stripDiscSuffix(parts.album || 'Unknown Album');
          navigate(`/${__APP_ID__}/album/${encodeURIComponent(albumKey(title))}`);
        },
      );
      if (menu.ok) deregister = menu.value;
      else log.warn('context menu unavailable:', menu.error.message);
    } else if (!enabled && deregister) {
      deregister();
      deregister = undefined;
    }
    log.info(`track menu item ${enabled ? 'enabled' : 'disabled'}`);
  };
  applyMenuItem(isTrackMenuItemEnabled());
  window.addEventListener(TRACK_MENU_EVENT, (e) => applyMenuItem((e as CustomEvent<boolean>).detail));

  // TODO(M2): now-playing album-name click → Crate album page for local tracks.
  // TODO(M5): log plays of spotify:local: tracks (Player songchange) into IndexedDB for stats.

  log.info(`extension ready (v${__APP_VERSION__})`);
}

main().catch((e) => log.error('extension failed to start', e));
