import type { Album, Artist } from '../../domain/model';
import { pluralize } from '../../domain/format';
import { go } from '../routes';
import { Cover } from './Cover';

/** Grid card for an album. `subtitle` defaults to the album artist. */
export function AlbumCard({ album, subtitle }: { album: Album; subtitle?: string }) {
  const sub = subtitle ?? album.albumArtist;
  return (
    <button type="button" className="crate-card" onClick={() => go.album(album.key)}>
      <Cover src={album.imageUrl} alt={album.title} />
      <div className="crate-card__title" title={album.title}>
        {album.title}
      </div>
      <div className="crate-card__sub" title={sub}>
        {sub}
      </div>
    </button>
  );
}

/** Grid card for an artist — round image like Spotify's. */
export function ArtistCard({ artist }: { artist: Artist }) {
  const sub = artist.albumKeys.length
    ? pluralize(artist.albumKeys.length, 'album')
    : `Appears on ${pluralize(artist.appearsOnKeys.length, 'album')}`;
  return (
    <button type="button" className="crate-card crate-card--artist" onClick={() => go.artist(artist.key)}>
      <Cover src={artist.imageUrl} alt={artist.name} />
      <div className="crate-card__title" title={artist.name}>
        {artist.name}
      </div>
      <div className="crate-card__sub">{sub}</div>
    </button>
  );
}
