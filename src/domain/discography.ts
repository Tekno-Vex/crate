// What an artist page shows. Pure — derived from the Library.

import type { Album, Artist, Library, Track } from './model';
import { artistKey } from './normalize';

export interface Discography {
  artist: Artist;
  /** Own albums, newest first when years are known, then by title. */
  albums: Album[];
  appearsOn: Album[];
  /** "Play artist": own albums in display order, each in track order. */
  playOrder: Track[];
}

const byNewest = (a: Album, b: Album) => (b.year ?? -Infinity) - (a.year ?? -Infinity) || a.title.localeCompare(b.title);

export function artistDiscography(library: Library, key: string): Discography | undefined {
  const artist = library.artistsByKey.get(key);
  if (!artist) return undefined;
  const get = (keys: string[]) => keys.map((k) => library.albumsByKey.get(k)).filter((a): a is Album => !!a);
  const albums = get(artist.albumKeys).sort(byNewest);
  const appearsOn = get(artist.appearsOnKeys).sort(byNewest);
  // An artist with no own albums plays the tracks they're credited on.
  const playOrder = albums.length
    ? albums.flatMap((a) => a.tracks)
    : appearsOn.flatMap((a) => a.tracks.filter((t) => t.artists.some((n) => artistKey(n) === key)));
  return { artist, albums, appearsOn, playOrder };
}
