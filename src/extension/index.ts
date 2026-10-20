// Runs at Spotify startup (manifest subfiles_extension). Shares no variables with the app.
// Keep it light: it runs on every Spotify launch.

import { isLocalUri, parseLocalUri } from '../domain/localUri';
import { albumKey, stripDiscSuffix } from '../domain/normalize';
import { log } from '../lib/log';
import { navigate, registerTrackMenuItem, whenReady } from '../platform';

async function main() {
  if (!(await whenReady())) return;

  // Right-click a local track anywhere → open its Crate album page.
  // Key derivation must match groupAlbums() for Tier 1 (title only, disc suffix stripped).
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
  if (!menu.ok) log.warn('context menu unavailable:', menu.error.message);

  // TODO(M2): now-playing album-name click → Crate album page for local tracks.
  // TODO(M5): log plays of spotify:local: tracks (Player songchange) into IndexedDB for stats.

  log.info(`extension ready (v${__APP_VERSION__})`);
}

main().catch((e) => log.error('extension failed to start', e));
