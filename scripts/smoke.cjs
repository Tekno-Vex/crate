// Smoke test (npm run smoke): loads the BUILT dist/crate/index.js + extension.js into jsdom with a
// mocked Spicetify global (real React stands in for Spicetify.React), renders the app, navigates,
// and asserts the main flows. Mocks reflect UNVERIFIED shapes — update them as spikes land.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const React = require('react');
const { act } = require('react');
// react-dom is required only after jsdom's window/document are global (below): it decides at load
// time whether the DOM supports the `input` event, and without a DOM it silently ignores typing.
let ReactDOMClient;

const dist = process.argv[2] ?? path.join(__dirname, '..', 'dist', 'crate');
// Top bar shape verified on 1.3.5 (2026-10-20): the color is an inline --background-base on a layer
// inside header[data-testid=topbar]. It starts WITHOUT the variable (fresh Spotify start, no native
// page visited yet); the purple Liked Songs case is set up after the albums page renders.
const dom = new JSDOM('<!doctype html><html><head></head><body><div id="main-view" style="background-color: rgb(18, 18, 18)"><header data-testid="topbar"><div class="layer" style="position: absolute; opacity: 1"></div></header><div id="root"></div></div></body></html>', {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const w = dom.window;
w.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.window = w;
globalThis.document = w.document;
ReactDOMClient = require('react-dom/client');

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
let localFilesOn = true;
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
  // S7: these exist on 1.3.5. RightClickMenu calls a function child with (isOpen, handleContextMenu,
  // ref) per spicetify's ContextMenuProps; TrackMenu's real props are UNVERIFIED (`uri` assumed).
  ReactComponent: {
    RightClickMenu: ({ menu, children }) => {
      const [open, setOpen] = React.useState(false);
      const onContextMenu = (e) => {
        e.preventDefault();
        setOpen(true);
      };
      return React.createElement(React.Fragment, null, children(open, onContextMenu, () => {}), open ? menu : null);
    },
    TrackMenu: ({ uri }) => React.createElement('div', { className: 'mock-track-menu', 'data-uri': uri }, 'Add to playlist'),
  },
  // Vivek's setup since 2026-10-20 (2.46.2 added Spotify 1.3.5 support; 2.45.x broke its menus).
  Config: { version: '2.46.2' },
  showNotification: (m, e) => console.log('  notify:', m, e ? '(error)' : ''),
  // Verified 1.3.5 (spike S7): resolves null for spotify:local: URIs.
  colorExtractor: async () => null,
  ContextMenu: {
    Item: class {
      constructor(name, onClick, shouldAdd) {
        Object.assign(this, { name, onClick, shouldAdd });
      }
      register() { menuItems.push(this); }
      deregister() { menuItems.splice(menuItems.indexOf(this), 1); }
    },
  },
  Player: {
    data: { item: { uri: rawTracks[1].uri }, shuffle: false },
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
      // UNVERIFIED (1.3.5): getIsEnabled/setIsEnabled shapes; assumed boolean, and getTracks → []
      // while local files are off.
      getTracks: async () => (localFilesOn ? rawTracks : []),
      getIsEnabled: () => localFilesOn,
      setIsEnabled: async (on) => {
        localFilesOn = on;
      },
      // Verified shape on 1.3.5 (spike S6, 2026-10-20).
      getSources: async () => ({
        defaultSources: [{ enabled: false, id: 'downloads' }, { enabled: false, id: 'windows_music_library' }],
        folders: [{ path: 'C:\Music' }],
      }),
    },
    PlayerAPI: {
      // UNVERIFIED (S3): assumes setShuffle(bool) is reflected in Player.data.shuffle.
      setShuffle: async (on) => {
        w.Spicetify.Player.data.shuffle = on;
        played.push(['shuffle', on]);
      },
      addToQueue: async (items) => played.push(['queue', items.map((i) => i.uri)]), play: async (ctx, _opts, extra) => played.push(['play', ctx.uri, ctx.pages[0].items.map((i) => i.uri), extra.skipTo.index]),
      getState: async () => ({ context: { uri: 'spotify:app:crate' }, item: { uri: rawTracks[1].uri } }),
      getQueue: async () => ({ nextUp: [{ uri: rawTracks[2].uri }] }),
    },
    ClipboardAPI: { copy: async () => {} },
  },
};
globalThis.Spicetify = w.Spicetify;
// jsdom can't decode images or draw on canvas. Fake both so the S7 canvas fallback runs:
// every cover "loads" and reads as solid orange (230,120,40).
w.Image = class {
  set src(v) {
    this._src = v;
    setTimeout(() => this.onload && this.onload(), 0);
  }
  get src() {
    return this._src;
  }
};
w.HTMLCanvasElement.prototype.getContext = () => ({
  drawImage() {},
  getImageData: (_x, _y, wd, ht) => ({
    data: Uint8ClampedArray.from({ length: wd * ht * 4 }, (_, i) => [230, 120, 40, 255][i % 4]),
  }),
});
for (const k of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'performance', 'Image', 'getComputedStyle', 'MutationObserver']) {
  if (!(k in globalThis) || k === 'window' || k === 'document') globalThis[k] = k === 'window' ? w : w[k];
}

const run = (file) => new Function(fs.readFileSync(path.join(dist, file), 'utf8') + '\n;return typeof render==="function"?render:null;')();

(async () => {
  // Extension
  run('extension.js');
  await new Promise((r) => setTimeout(r, 300));
  const startupMenuItems = menuItems.length;
  console.log('extension menu items at startup:', menuItems.map((m) => m.name));
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
  const cards = () => [...w.document.querySelectorAll('.crate-card__title')].map((e) => e.textContent);
  const search = () => w.document.querySelector('.crate-input');
  const allCards = cards();
  // Type into the controlled search input the way React expects.
  const setInput = (el, value) => {
    Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new w.Event('input', { bubbles: true }));
  };
  await act(async () => setInput(search(), 'solo'));
  const filteredCards = cards();
  await act(async () => history.push('/crate/album/other'));
  await act(async () => history.push('/crate'));
  const searchAfterNav = search()?.value;
  const cardsAfterNav = cards();
  console.log('cards:', allCards, '→ search "solo":', filteredCards, '→ after album and back:', searchAfterNav, cardsAfterNav);
  await act(async () => setInput(search(), ''));

  const layer = w.document.querySelector('[data-testid="topbar"] .layer');
  const freshStartTopBar = layer.style.getPropertyValue('--background-base');
  // Now simulate having visited Liked Songs before opening an album.
  layer.style.setProperty('--background-base', '#5038a0');
  await act(async () => history.push('/crate/album/box'));
  await act(async () => new Promise((r) => setTimeout(r, 50)));
  const rows = [...w.document.querySelectorAll('.crate-track__title')].map((e) => e.textContent);
  const discs = [...w.document.querySelectorAll('.crate-disc')].map((e) => e.textContent);
  console.log('album page title:', w.document.querySelector('.crate-album__title')?.textContent, '| artist line:', w.document.querySelector('.crate-album__line')?.textContent);
  console.log('tracks:', rows, 'discs:', discs);
  const tint = w.document.querySelector('.crate-album')?.getAttribute('style');
  const topBar = () => w.document.querySelector('[data-testid="topbar"] .layer').style.getPropertyValue('--background-base');
  const albumTopBar = topBar();
  console.log('top bar on album page:', albumTopBar);
  console.log('tint:', tint);
  console.log('now-playing row:', w.document.querySelector('.crate-track.is-playing .crate-track__title')?.textContent);

  await act(async () => w.document.querySelector('.crate-play').dispatchEvent(new w.MouseEvent('click', { bubbles: true })));
  await act(async () => new Promise((r) => setTimeout(r, 20)));
  console.log('played:', JSON.stringify(played));
  const secondRow = () => w.document.querySelectorAll('.crate-track')[1];
  await act(async () => secondRow().dispatchEvent(new w.MouseEvent('click', { bubbles: true })));
  const selectedRow = w.document.querySelector('.crate-track.is-selected .crate-track__title')?.textContent;
  await act(async () => secondRow().dispatchEvent(new w.MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
  const menuUri = w.document.querySelector('.mock-track-menu')?.getAttribute('data-uri');
  const playsBefore = played.length;
  await act(async () => secondRow().dispatchEvent(new w.MouseEvent('dblclick', { bubbles: true })));
  await act(async () => new Promise((r) => setTimeout(r, 20)));
  const dblPlay = played.slice(playsBefore).find((p) => p[0] === 'play');
  console.log('row click selects:', selectedRow, '| right-click menu for:', menuUri, '| double-click plays index:', dblPlay?.[3]);
  const shuffleBtn = () => w.document.querySelector('.crate-icon-btn');
  const click = (el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await act(async () => click(shuffleBtn()));
  const shuffleOn = { pressed: shuffleBtn().getAttribute('aria-pressed'), label: shuffleBtn().getAttribute('aria-label') };
  await act(async () => click(w.document.querySelector('.crate-play')));
  await act(async () => new Promise((r) => setTimeout(r, 20)));
  const shufflePlay = played.filter((p) => p[0] === 'play').at(-1);
  const reassertedShuffle = JSON.stringify(played.at(-1)) === JSON.stringify(['shuffle', true]);
  await act(async () => click(shuffleBtn()));
  const shuffleOff = shuffleBtn().getAttribute('aria-pressed');
  console.log('shuffle on:', shuffleOn, '→ play:', JSON.stringify(shufflePlay), '→ off:', shuffleOff);

  // Album artist links to the artist page; artist page lists albums and plays them all.
  const artistLink = w.document.querySelector('.crate-album__line .crate-link');
  await act(async () => click(artistLink));
  const artistRoute = history.location.pathname;
  const artistAlbums = [...w.document.querySelectorAll('.crate-card__title')].map((e) => e.textContent);
  const artistTitle = w.document.querySelector('.crate-album__title')?.textContent;
  await act(async () => click(w.document.querySelector('.crate-play')));
  await act(async () => new Promise((r) => setTimeout(r, 20)));
  const artistPlay = played.at(-1);
  await act(async () => history.push('/crate/artists'));
  const artistCards = cards();
  console.log('artist link →', artistRoute, artistTitle, artistAlbums, '| artists:', artistCards);

  await act(async () => history.push('/crate'));
  const albumsTopBar = topBar();
  console.log('top bar on albums page:', albumsTopBar);
  await act(async () => history.push('/crate/diagnostics'));
  const btn = [...w.document.querySelectorAll('button')].find((b) => b.textContent === 'Probe local files');
  await act(async () => btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true })));
  await act(async () => new Promise((r) => setTimeout(r, 50)));
  const pre = [...w.document.querySelectorAll('.crate-pre')].map((p) => p.textContent);
  const s1 = JSON.parse(pre.find((p) => p.includes('rawCount')));
  // Local files switched off → every page explains it and offers the fix.
  localFilesOn = false;
  await act(async () => history.push('/crate'));
  await act(async () => w.dispatchEvent(new w.Event('focus')));
  await act(async () => new Promise((r) => setTimeout(r, 700))); // store debounce + rescan
  const problem = w.document.querySelector('[data-problem]')?.getAttribute('data-problem');
  const turnOn = [...w.document.querySelectorAll('button')].find((b) => b.textContent === 'Turn on local files');
  await act(async () => click(turnOn));
  await act(async () => new Promise((r) => setTimeout(r, 100)));
  const cardsAfterTurnOn = cards();
  console.log('local files off →', problem, '→ turn on →', cardsAfterTurnOn);

  console.log('diagnostics S1:', { rawCount: s1.rawCount, albumCount: s1.albumCount, fields: Object.keys(s1.fieldInventory).length });

  const assert = require('node:assert/strict');
  // On by default with a Spicetify that supports this Spotify; the Diagnostics switch toggles it live.
  assert.equal(startupMenuItems, 1, 'menu item registered by default on Spicetify 2.46.2 + Spotify 1.3.5');
  w.dispatchEvent(new w.CustomEvent('crate:track-menu-item', { detail: false }));
  assert.equal(menuItems.length, 0, 'switch off removes it');
  w.dispatchEvent(new w.CustomEvent('crate:track-menu-item', { detail: true }));
  assert.deepEqual(menuItems.map((m) => m.name), ['Go to album (Crate)'], 'switch on registers it again');
  assert.equal(item.shouldAdd(['spotify:track:x']), false);
  assert.ok(w.document.getElementById('crate-styles'), 'styles injected');
  assert.deepEqual(rows, ['First', 'Second', 'Third'], 'disc/track order + "(Disc N)" merge');
  assert.deepEqual(discs, ['Disc 1', 'Disc 2']);
  assert.deepEqual(allCards, ['Box', 'Other'], 'albums grid renders every album (static mode without layout)');
  assert.deepEqual(filteredCards, ['Other'], 'search filters by artist');
  assert.equal(searchAfterNav, 'solo', 'search survives navigating to an album and back');
  assert.deepEqual(cardsAfterNav, ['Other']);
  assert.match(tint ?? '', /--crate-tint: #[0-9a-f]{6}/, 'header tint from canvas fallback (S7)');
  assert.equal(freshStartTopBar, 'rgb(18, 18, 18)', 'fresh start: layer found structurally and painted');
  assert.equal(albumTopBar, /--crate-tint: (#[0-9a-f]{6})/.exec(tint)[1], 'album page paints the top bar with its tint');
  assert.equal(albumsTopBar, 'rgb(18, 18, 18)', 'other pages paint the top bar with the main-view background');
  // playUri ignores local URIs on 1.3.5, so albums play as a context of our own (S3 + follow-up).
  assert.equal(selectedRow, 'Second', 'single click selects the row');
  assert.equal(menuUri, rawTracks[2].uri, 'right-click opens the native track menu for that row');
  assert.equal(dblPlay?.[3], 1, 'double-click plays that row inside the album context');
  assert.equal(artistRoute, '/crate/artist/artist-a', 'album artist name links to the artist page');
  assert.equal(artistTitle, 'Artist A');
  assert.deepEqual(artistAlbums, ['Box']);
  assert.equal(artistPlay[0], 'play');
  assert.equal(artistPlay[2].length, 3, 'artist Play queues all of their album tracks');
  assert.deepEqual(artistCards, ['Artist A', 'Solo'], 'only artists with their own albums are listed');
  assert.equal(problem, 'disabled', 'empty library with local files off explains why');
  assert.equal(localFilesOn, true, '"Turn on local files" switches the setting on');
  assert.deepEqual(cardsAfterTurnOn, ['Box', 'Other'], 'library comes back after turning local files on');
  assert.deepEqual(shuffleOn, { pressed: 'true', label: 'Disable shuffle' });
  assert.equal(shufflePlay[0], 'play');
  assert.ok(shufflePlay[3] >= 0 && shufflePlay[3] < shufflePlay[2].length, 'shuffled start is inside the album');
  assert.equal(shuffleOff, 'false');
  assert.ok(reassertedShuffle, 'shuffle is re-asserted right after starting a shuffled context');
  assert.deepEqual(played.filter((p) => p[0] === 'shuffle'), [['shuffle', true], ['shuffle', true], ['shuffle', false]]);
  assert.equal(played[0][0], 'play');
  assert.equal(played[0][1], 'spotify:app:crate', 'albums play as our own app context (S3 follow-up)');
  assert.deepEqual(played[0][2].length, 3, 'whole album passed as the context page');
  assert.equal(s1.rawCount, rawTracks.length);
  await act(async () => root.unmount());
  console.log('SMOKE OK');
})().catch((e) => {
  console.error('SMOKE FAILED', e);
  process.exit(1);
});
