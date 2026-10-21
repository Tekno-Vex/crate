import { useEffect } from 'react';
import { ensureStyles } from '../lib/style';
import { Nav } from './components/Nav';
import { LibraryProblem, StaleBanner } from './components/LibraryProblem';
import { Loading } from './components/States';
import { AlbumPage } from './pages/AlbumPage';
import { AlbumsPage } from './pages/AlbumsPage';
import { ArtistPage } from './pages/ArtistPage';
import { ArtistsPage } from './pages/ArtistsPage';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { go, useRoute } from './routes';
import { useLibrary } from './useLibrary';
import { NEUTRAL_TOP_BAR, useTopBarColor } from './useTopBarColor';

// Spicetify calls the global render() (appended by scripts/build.mjs), which mounts this.
export default function App() {
  useEffect(ensureStyles, []);
  const route = useRoute();
  const lib = useLibrary();
  // Album/artist pages paint the bar with their cover color; every other Crate page uses the neutral one.
  useTopBarColor(route.name === 'album' || route.name === 'artist' ? undefined : NEUTRAL_TOP_BAR);

  let body;
  if (route.name === 'diagnostics') {
    // Diagnostics must work even when the library can't load.
    body = <DiagnosticsPage />;
  } else if (lib.status === 'loading') {
    body = <Loading />;
  } else if (lib.status === 'error') {
    body = <LibraryProblem trackCount={0} scanError={lib.error} onRescan={lib.reload} />;
  } else if (lib.library.tracks.length === 0) {
    // One explanation for every page: off, no folders, empty folders.
    body = <LibraryProblem trackCount={0} onRescan={lib.reload} />;
  } else if (route.name === 'album') {
    body = <AlbumPage library={lib.library} albumKey={route.key} />;
  } else if (route.name === 'albums') {
    body = <AlbumsPage library={lib.library} />;
  } else if (route.name === 'artist') {
    body = <ArtistPage library={lib.library} artistKey={route.key} />;
  } else if (route.name === 'artists') {
    body = <ArtistsPage library={lib.library} />;
  } else {
    body = (
      <div className="crate-state">
        <p>Unknown page: {route.path}</p>
        <button type="button" className="crate-btn" onClick={go.albums}>
          Go to albums
        </button>
      </div>
    );
  }

  return (
    <div className="crate-root">
      <Nav route={route} />
      {lib.status === 'ready' && lib.staleError && route.name !== 'diagnostics' && (
        <StaleBanner error={lib.staleError} onRetry={lib.reload} />
      )}
      {body}
    </div>
  );
}
