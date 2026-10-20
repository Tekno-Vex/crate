// Smoke test (npm run smoke): loads the BUILT dist/crate/index.js + extension.js into jsdom with a
// mocked Spicetify global (real React stands in for Spicetify.React), renders the app, navigates,
// and asserts the main flows. Mocks reflect UNVERIFIED shapes — update them as spikes land.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const React = require('react');
const ReactDOMClient = require('react-dom/client');
const { act } = require('react');

const dist = process.argv[2] ?? path.join(__dirname, '..', 'dist', 'crate');
const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const w = dom.window;
w.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const listeners = [];
const history = {
  location: { pathname: '/crate' },
  push(p) {
    this.location = typeof p === 'string' ? { pathname: p } : p;
    listeners.forEach((l) => l(this.location));
  },
  listen(l) {
    listeners.push(l);
    return () => listeners.splice(listeners.indexOf(l), 1);
  },
};
const played = [];
const menuItems = [];
// Same shape LocalFilesAPI.getTracks() returns on Spotify 1.3.5.3058 (spike S1, 2026-10-20):
// discNumber/trackNumber always numbers (0 = untagged), addedAt a Date, cover URI = file path.
const rawTrack = (uri, name, album, artists, trackNumber, sec) => ({
  type: 'track',
  uid: uri,
  addedAt: new Date('2026-09-03T16:54:24.000Z'),
  uri,
  name,
  album: {
    type: 'album',
    uri: uri.split(':').slice(0, 4).join(':'),
    name: album,
    artist: { type: 'artist', uri: 'spotify:local:' + encodeURIComponent(artists[0]), name: artists[0] },
    images: [{ url: 'spotify:localfileimage:' + encodeURIComponent('/music/' + album + '/' + name + '.mp3'), label: 'standard' }],
  },
  artists: artists.map((n) => ({ type: 'artist', uri: 'spotify:local:' + encodeURIComponent(n), name: n })),
  discNumber: 0,
  trackNumber,
  duration: { milliseconds: sec * 1000 },
  isExplicit: false,
  isLocal: true,
  isPlayable: true,
  is19PlusOnly: false,
  isBanned: false,
});
const rawTracks = [
  rawTrack('spotify:local:Artist+A:Box+%28Disc+2%29:Third:200', 'Third', 'Box (Disc 2)', ['Artist A'], 1, 200),
  rawTrack('spotify:local:Artist+A:Box+%28Disc+1%29:First:100', 'First', 'Box (Disc 1)', ['Artist A'], 1, 100),
  rawTrack('spotify:local:Artist+A%2C+Guest:Box+%28Disc+1%29:Second:150', 'Second', 'Box (Disc 1)', ['Artist A', 'Guest'], 2, 150),
  rawTrack('spotify:local:Solo:Other:Song:180', 'Song', 'Other', ['Solo'], 0, 180),
];
w.Spicetify = {
  React,
  ReactDOM: require('react-dom'),
  Config: { version: '2.45.1' },
  showNotification: (m, e) => console.log('  notify:', m, e ? '(error)' : ''),
  colorExtractor: async () => ({ DARK_VIBRANT: '#123456' }),
  ContextMenu: {
    Item: class {
      constructor(name, onClick, shouldAdd) {
        Object.assign(this, { name, onClick, shouldAdd });
      }
      register() { menuItems.push(this); }
      deregister() {}
    },
  },
  Player: {
    data: { item: { uri: rawTracks[1].uri } },
    playUri: async (u) => played.push(['playUri', u]),
    addEventListener() {},
    removeEventListener() {},
  },
  Platform: {
    History: history,
    // Real shape on Spotify 1.3.5.3058 / Windows (2026-10-20). Version comes from the user agent.
    PlatformData: {
      os_version: '10.0.26300',
      app_platform: 'Win32_x86_64',
      client_variant: 'windows_classic',
      is_developer_mode: true,
      remote_config_client_id: 'desktop-ui',
    },
    version: '1.3.5.3058',
    operatingSystem: 'Windows',
    LocalFilesAPI: {
      getTracks: async () => rawTracks,
      // Verified shape on 1.3.5 (spike S6, 2026-10-20).
      getSources: async () => ({
        defaultSources: [{ enabled: false, id: 'downloads' }, { enabled: false, id: 'windows_music_library' }],
        folders: [{ path: 'C:\Music' }],
      }),
    },
    PlayerAPI: { addToQueue: async (items) => played.push(['queue', items.map((i) => i.uri)]), play: async (ctx, _opts, extra) => played.push(['play', ctx.uri, ctx.pages[0].items.map((i) => i.uri), extra.skipTo.index]),
      getState: async () => ({ context: { uri: 'spotify:internal:local-files' }, item: { uri: rawTracks[1].uri } }),
      getQueue: async () => ({ nextUp: [{ uri: rawTracks[2].uri }] }),
    },
    ClipboardAPI: { copy: async () => {} },
  },
};
globalThis.Spicetify = w.Spicetify;
for (const k of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'performance']) {
  if (!(k in globalThis) || k === 'window' || k === 'document') globalThis[k] = k === 'window' ? w : w[k];
}

const run = (file) => new Function(fs.readFileSync(path.join(dist, file), 'utf8') + '\n;return typeof render==="function"?render:null;')();

(async () => {
  // Extension
  run('extension.js');
  await new Promise((r) => setTimeout(r, 300));
  console.log('extension menu items:', menuItems.map((m) => m.name));
  const item = menuItems[0];
  console.log('  shouldAdd(local):', item.shouldAdd([rawTracks[0].uri]), ' shouldAdd(catalog):', item.shouldAdd(['spotify:track:x']));
  item.onClick([rawTracks[0].uri]);
  console.log('  navigated to:', history.location.pathname);
  history.location = { pathname: '/crate' };

  // App
  const render = run('index.js');
  if (!render) throw new Error('render() not defined by index.js');
  const root = ReactDOMClient.createRoot(w.document.getElementById('root'));
  await act(async () => root.render(React.createElement(render)));
  await act(async () => new Promise((r) => setTimeout(r, 50)));
  const text = () => w.document.getElementById('root').textContent;
  console.log('styles injected:', !!w.document.getElementById('crate-styles'));
  console.log('albums page:', text().slice(0, 160));

  await act(async () => history.push('/crate/album/box'));
  await act(async () => new Promise((r) => setTimeout(r, 50)));
  const rows = [...w.document.querySelectorAll('.crate-track__title')].map((e) => e.textContent);
  const discs = [...w.document.querySelectorAll('.crate-disc')].map((e) => e.textContent);
  console.log('album page title:', w.document.querySelector('.crate-album__title')?.textContent, '| artist line:', w.document.querySelector('.crate-album__line')?.textContent);
  console.log('tracks:', rows, 'discs:', discs);
  console.log('tint:', w.document.querySelector('.crate-album')?.getAttribute('style'));
  console.log('now-playing row:', w.document.querySelector('.crate-track.is-playing .crate-track__title')?.textContent);

  await act(async () => w.document.querySelector('.crate-play').dispatchEvent(new w.MouseEvent('click', { bubbles: true })));
  await act(async () => new Promise((r) => setTimeout(r, 20)));
  console.log('played:', JSON.stringify(played));

  await act(async () => history.push('/crate/diagnostics'));
  const btn = [...w.document.querySelectorAll('button')].find((b) => b.textContent === 'Probe local files');
  await act(async () => btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true })));
  await act(async () => new Promise((r) => setTimeout(r, 50)));
  const pre = [...w.document.querySelectorAll('.crate-pre')].map((p) => p.textContent);
  const s1 = JSON.parse(pre.find((p) => p.includes('rawCount')));
  console.log('diagnostics S1:', { rawCount: s1.rawCount, albumCount: s1.albumCount, fields: Object.keys(s1.fieldInventory).length });

  const assert = require('node:assert/strict');
  assert.deepEqual(menuItems.map((m) => m.name), ['Go to album (Crate)']);
  assert.equal(item.shouldAdd(['spotify:track:x']), false);
  assert.ok(w.document.getElementById('crate-styles'), 'styles injected');
  assert.deepEqual(rows, ['First', 'Second', 'Third'], 'disc/track order + "(Disc N)" merge');
  assert.deepEqual(discs, ['Disc 1', 'Disc 2']);
  // S3 round 1: playUri ignores local URIs on 1.3.5, so albums play as a local-files context.
  assert.equal(played[0][0], 'play');
  assert.equal(played[0][1], 'spotify:internal:local-files');
  assert.deepEqual(played[0][2].length, 3, 'whole album passed as the context page');
  assert.equal(s1.rawCount, rawTracks.length);
  await act(async () => root.unmount());
  console.log('SMOKE OK');
})().catch((e) => {
  console.error('SMOKE FAILED', e);
  process.exit(1);
});
