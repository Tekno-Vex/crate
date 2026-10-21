import { useMemo } from 'react';
import type { Album, Library } from '../../domain/model';
import { normalizeText } from '../../domain/normalize';
import { pluralize } from '../../domain/format';
import { AlbumCard } from '../components/Cards';
import { VirtualGrid } from '../components/VirtualGrid';
import { useUiState } from '../useUiState';

type SortKey = 'title' | 'artist' | 'tracks' | 'recent';

/** Latest addedAt per album, computed once per library rather than inside every comparison. */
const lastAdded = (a: Album) => a.tracks.reduce((max, t) => Math.max(max, t.addedAt ?? 0), 0);

const SORTS: Record<SortKey, { label: string; cmp: (a: Album, b: Album, added: Map<Album, number>) => number }> = {
  title: { label: 'Album', cmp: (a, b) => a.title.localeCompare(b.title) },
  artist: {
    label: 'Artist',
    cmp: (a, b) => a.albumArtist.localeCompare(b.albumArtist) || a.title.localeCompare(b.title),
  },
  tracks: { label: 'Track count', cmp: (a, b) => b.tracks.length - a.tracks.length },
  recent: { label: 'Recently added', cmp: (a, b, added) => added.get(b)! - added.get(a)! || a.title.localeCompare(b.title) },
};

const isSortKey = (v: unknown): v is SortKey => typeof v === 'string' && v in SORTS;

export function AlbumsPage({ library }: { library: Library }) {
  // Search + scroll survive navigation; sort also survives a Spotify restart.
  const [query, setQuery] = useUiState('albums.query', '');
  const [storedSort, setSort] = useUiState<string>('albums.sort', 'artist', true);
  const sort: SortKey = isSortKey(storedSort) ? storedSort : 'artist';

  const searchIndex = useMemo(
    () => new Map(library.albums.map((a) => [a, normalizeText(`${a.title} ${a.albumArtist} ${a.artists.join(' ')}`)])),
    [library],
  );
  const added = useMemo(() => new Map(library.albums.map((a) => [a, lastAdded(a)])), [library]);

  const albums = useMemo(() => {
    const q = normalizeText(query);
    const filtered = q ? library.albums.filter((a) => searchIndex.get(a)!.includes(q)) : library.albums;
    return [...filtered].sort((a, b) => SORTS[sort].cmp(a, b, added));
  }, [library, searchIndex, added, query, sort]);

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

      {albums.length === 0 ? (
        <p className="crate-muted">No albums match "{query}".</p>
      ) : (
        <VirtualGrid
          items={albums}
          getKey={(a) => a.key}
          scrollKey="albums"
          resetScrollOn={`${sort}:${query}`}
          renderItem={(album) => <AlbumCard album={album} />}
        />
      )}
    </section>
  );
}
