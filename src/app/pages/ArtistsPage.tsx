import { useMemo } from 'react';
import type { Artist, Library } from '../../domain/model';
import { normalizeText } from '../../domain/normalize';
import { pluralize } from '../../domain/format';
import { ArtistCard } from '../components/Cards';
import { Empty } from '../components/States';
import { VirtualGrid } from '../components/VirtualGrid';
import { useUiState } from '../useUiState';

type SortKey = 'name' | 'albums' | 'tracks' | 'recent';

const SORTS: Record<SortKey, { label: string; cmp: (a: Artist, b: Artist, added: Map<Artist, number>) => number }> = {
  name: { label: 'Name', cmp: (a, b) => a.name.localeCompare(b.name) },
  albums: { label: 'Album count', cmp: (a, b) => b.albumKeys.length - a.albumKeys.length || a.name.localeCompare(b.name) },
  tracks: { label: 'Track count', cmp: (a, b) => b.trackCount - a.trackCount || a.name.localeCompare(b.name) },
  recent: { label: 'Recently added', cmp: (a, b, added) => added.get(b)! - added.get(a)! || a.name.localeCompare(b.name) },
};
const isSortKey = (v: unknown): v is SortKey => typeof v === 'string' && v in SORTS;

export function ArtistsPage({ library }: { library: Library }) {
  const [query, setQuery] = useUiState('artists.query', '');
  const [storedSort, setSort] = useUiState<string>('artists.sort', 'name', true);
  const sort: SortKey = isSortKey(storedSort) ? storedSort : 'name';

  const added = useMemo(() => {
    const m = new Map<Artist, number>();
    for (const a of library.artists) {
      let max = 0;
      for (const key of a.albumKeys.length ? a.albumKeys : a.appearsOnKeys) {
        for (const t of library.albumsByKey.get(key)?.tracks ?? []) max = Math.max(max, t.addedAt ?? 0);
      }
      m.set(a, max);
    }
    return m;
  }, [library]);

  const artists = useMemo(() => {
    const q = normalizeText(query);
    // Only artists with an album of their own; featured artists show up on those albums' artist pages.
    const list = library.artists.filter((a) => a.albumKeys.length > 0 && (!q || normalizeText(a.name).includes(q)));
    return list.sort((a, b) => SORTS[sort].cmp(a, b, added));
  }, [library, added, query, sort]);

  if (library.tracks.length === 0) return <Empty title="No local files found" />;

  return (
    <section className="crate-page">
      <header className="crate-toolbar">
        <h1 className="crate-h1">Artists</h1>
        <span className="crate-muted">{pluralize(artists.length, 'artist')}</span>
        <div className="crate-spacer" />
        <input
          className="crate-input"
          type="search"
          placeholder="Search artists"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
        <select className="crate-select" value={sort} onChange={(e) => setSort(e.currentTarget.value)}>
          {Object.entries(SORTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </header>

      {artists.length === 0 ? (
        <p className="crate-muted">No artists match "{query}".</p>
      ) : (
        <VirtualGrid
          items={artists}
          getKey={(a) => a.key}
          scrollKey="artists"
          resetScrollOn={`${sort}:${query}`}
          renderItem={(artist) => <ArtistCard artist={artist} />}
        />
      )}
    </section>
  );
}
