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
const rawTracks = [
  { uri: 'spotify:local:Artist+A:Box+%28Disc+2%29:Third:200', name: 'Third', album: { name: 'Box (Disc 2)' }, artists: [{ name: 'Artist A' }], duration: { milliseconds: 200000 } },
  { uri: 'spotify:local:Artist+A:Box+%28Disc+1%29:First:100', name: 'First', album: { name: 'Box (Disc 1)' }, artists: [{ name: 'Artist A' }], duration: { milliseconds: 100000 } },
  { uri: 'spotify:local:Artist+A%2C+Guest:Box+%28Disc+1%29:Second:150', name: 'Second', album: { name: 'Box (Disc 1)' }, artists: [{ name: 'Artist A' }, { name: 'Guest' }], duration: { milliseconds: 150000 } },
  { uri: 'spotify:local:Solo:Other:Song:180', name: 'Song', album: { name: 'Other' }, artists: [{ name: 'Solo' }], duration: { milliseconds: 180000 } },
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
    PlatformData: { client_version_triple: '1.3.1', os_name: 'windows' },
    LocalFilesAPI: { getTracks: async () => rawTracks },
    PlayerAPI: { addToQueue: async (items) => played.push(['queue', items.map((i) => i.uri)]), play: async () => {} },
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
  assert.equal(played[0][0], 'playUri');
  assert.equal(s1.rawCount, rawTracks.length);
  await act(async () => root.unmount());
  console.log('SMOKE OK');
})().catch((e) => {
  console.error('SMOKE FAILED', e);
  process.exit(1);
});
