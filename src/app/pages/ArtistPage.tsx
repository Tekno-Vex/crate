import { useMemo, useRef } from 'react';
import { artistDiscography } from '../../domain/discography';
import { pluralize } from '../../domain/format';
import type { Library } from '../../domain/model';
import { AlbumCard } from '../components/Cards';
import { Cover } from '../components/Cover';
import { PlayActions } from '../components/PlayActions';
import { Empty } from '../components/States';
import { go } from '../routes';
import { useHeaderColor, useScrollToTop } from '../usePageChrome';
import { NEUTRAL_TOP_BAR, useTopBarColor } from '../useTopBarColor';

export function ArtistPage({ library, artistKey }: { library: Library; artistKey: string }) {
  const d = useMemo(() => artistDiscography(library, artistKey), [library, artistKey]);
  const color = useHeaderColor(d?.playOrder[0]?.uri, d?.artist.imageUrl, `artist:${artistKey}`);
  useTopBarColor(color ?? NEUTRAL_TOP_BAR);
  const pageRef = useRef<HTMLElement>(null);
  useScrollToTop(pageRef, artistKey);

  if (!d) {
    return (
      <Empty title="Artist not found">
        <button type="button" className="crate-btn" onClick={go.artists}>
          Back to artists
        </button>
      </Empty>
    );
  }

  const { artist, albums, appearsOn, playOrder } = d;
  return (
    <section ref={pageRef} className="crate-page crate-album" style={color ? { ['--crate-tint' as string]: color } : undefined}>
      <header className="crate-album__header">
        <Cover src={artist.imageUrl} alt={artist.name} className="crate-album__cover crate-artist__image" />
        <div className="crate-album__meta">
          <span className="crate-eyebrow">Artist · Local files</span>
          <h1 className="crate-album__title">{artist.name}</h1>
          <div className="crate-album__line">
            {albums.length > 0 && <span>{pluralize(albums.length, 'album')} · </span>}
            <span>{pluralize(artist.trackCount, 'song')}</span>
          </div>
        </div>
      </header>

      <PlayActions uris={playOrder.map((t) => t.uri)} label={artist.name} />

      {albums.length > 0 && (
        <section className="crate-section">
          <h2 className="crate-h2">Albums</h2>
          <div className="crate-grid">
            {albums.map((a) => (
              <AlbumCard key={a.key} album={a} subtitle={a.year ? String(a.year) : pluralize(a.tracks.length, 'song')} />
            ))}
          </div>
        </section>
      )}
      {appearsOn.length > 0 && (
        <section className="crate-section">
          <h2 className="crate-h2">Appears on</h2>
          <div className="crate-grid">
            {appearsOn.map((a) => (
              <AlbumCard key={a.key} album={a} />
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
