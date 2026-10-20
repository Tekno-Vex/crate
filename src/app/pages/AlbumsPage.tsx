import { useMemo, useState } from 'react';
import type { Album, Library } from '../../domain/model';
import { normalizeText } from '../../domain/normalize';
import { pluralize } from '../../domain/format';
import { Cover } from '../components/Cover';
import { Empty } from '../components/States';
import { go } from '../routes';

type SortKey = 'title' | 'artist' | 'tracks' | 'recent';

const SORTS: Record<SortKey, { label: string; cmp: (a: Album, b: Album) => number }> = {
  title: { label: 'Album', cmp: (a, b) => a.title.localeCompare(b.title) },
  artist: {
    label: 'Artist',
    cmp: (a, b) => a.albumArtist.localeCompare(b.albumArtist) || a.title.localeCompare(b.title),
  },
  tracks: { label: 'Track count', cmp: (a, b) => b.tracks.length - a.tracks.length },
  recent: {
    label: 'Recently added',
    cmp: (a, b) =>
      Math.max(...b.tracks.map((t) => t.addedAt ?? 0)) - Math.max(...a.tracks.map((t) => t.addedAt ?? 0)),
  },
};

// TODO(M1): virtualize the grid and persist search/sort/scroll per view (IndexedDB uiState).
export function AlbumsPage({ library }: { library: Library }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('artist');

  const albums = useMemo(() => {
    const q = normalizeText(query);
    const filtered = q
      ? library.albums.filter((a) =>
          normalizeText(`${a.title} ${a.albumArtist} ${a.artists.join(' ')}`).includes(q),
        )
      : library.albums;
    return [...filtered].sort(SORTS[sort].cmp);
  }, [library, query, sort]);

  if (library.tracks.length === 0) {
    return (
      <Empty title="No local files found">
        <p className="crate-muted">
          Turn on "Show Local Files" in Spotify settings and add a folder, then reload this page.
        </p>
      </Empty>
    );
  }

  return (
    <section className="crate-page">
      <header className="crate-toolbar">
        <h1 className="crate-h1">Albums</h1>
        <span className="crate-muted">
          {pluralize(library.albums.length, 'album')} · {pluralize(library.tracks.length, 'track')}
        </span>
        <div className="crate-spacer" />
        <input
          className="crate-input"
          type="search"
          placeholder="Search albums and artists"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
        <select className="crate-select" value={sort} onChange={(e) => setSort(e.currentTarget.value as SortKey)}>
          {Object.entries(SORTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </header>

      <div className="crate-grid">
        {albums.map((album) => (
          <button key={album.key} type="button" className="crate-card" onClick={() => go.album(album.key)}>
            <Cover src={album.imageUrl} alt={album.title} />
            <div className="crate-card__title" title={album.title}>
              {album.title}
            </div>
            <div className="crate-card__sub" title={album.albumArtist}>
              {album.albumArtist}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
