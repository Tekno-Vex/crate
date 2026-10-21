import {
  type Album,
  type Artist,
  type Library,
  type Track,
  UNKNOWN_ALBUM,
  UNKNOWN_ARTIST,
  VARIOUS_ARTISTS,
} from './model';
import { albumKey, artistKey, normalizeText, stripDiscSuffix } from './normalize';
import { sortAlbumTracks } from './ordering';

export interface GroupingOptions {
  /** If no artist appears on at least this share of tracks, the album is "Various Artists". */
  variousArtistsThreshold?: number;
}

/** Rank items by frequency, ties broken by first appearance. */
function byFrequency(items: string[]): string[] {
  const counts = new Map<string, { n: number; first: number; value: string }>();
  items.forEach((value, i) => {
    const k = value.toLowerCase();
    const e = counts.get(k);
    if (e) e.n++;
    else counts.set(k, { n: 1, first: i, value });
  });
  return [...counts.values()].sort((a, b) => b.n - a.n || a.first - b.first).map((e) => e.value);
}

function pickAlbumArtist(tracks: Track[], threshold: number): { albumArtist: string; artists: string[] } {
  const tagged = byFrequency(tracks.map((t) => t.albumArtist).filter((x): x is string => !!x));
  const artists = byFrequency(tracks.flatMap((t) => t.artists));
  if (tagged[0]) return { albumArtist: tagged[0], artists };
  if (artists.length === 0) return { albumArtist: UNKNOWN_ARTIST, artists };

  // An artist present on most tracks is the album artist (handles "feat." guests).
  const top = artists[0]!;
  const share = tracks.filter((t) => t.artists.some((a) => a.toLowerCase() === top.toLowerCase())).length;
  if (tracks.length > 1 && share / tracks.length < threshold) {
    return { albumArtist: VARIOUS_ARTISTS, artists };
  }
  return { albumArtist: top, artists };
}

/**
 * Tier 1 grouping. Identity = album title with any "(Disc N)" suffix removed, plus the tagged
 * album artist when the helper provides one. Disc numbers recovered from title suffixes are applied
 * to tracks that lack a disc number.
 *
 * TODO(M2): split same-title albums whose covers differ (perceptual hash), user merge/split overrides.
 */
export function groupAlbums(tracks: readonly Track[], options: GroupingOptions = {}): Album[] {
  const threshold = options.variousArtistsThreshold ?? 0.5;
  const groups = new Map<string, { title: string; tagArtist?: string; tracks: Track[] }>();

  for (const track of tracks) {
    const rawTitle = track.album.trim() || UNKNOWN_ALBUM;
    const { title, disc } = stripDiscSuffix(rawTitle);
    const withDisc = disc !== undefined && track.discNumber === undefined ? { ...track, discNumber: disc } : track;
    const id = `${normalizeText(title)}\u0000${normalizeText(track.albumArtist ?? '')}`;
    const g = groups.get(id);
    if (g) g.tracks.push(withDisc);
    else groups.set(id, { title, tagArtist: track.albumArtist, tracks: [withDisc] });
  }

  const albums: Album[] = [];
  for (const g of groups.values()) {
    const ordered = sortAlbumTracks(g.tracks);
    const { albumArtist, artists } = pickAlbumArtist(ordered, threshold);
    const discs = [...new Set(ordered.map((t) => t.discNumber).filter((d): d is number => d !== undefined))].sort(
      (a, b) => a - b,
    );
    const years = ordered.map((t) => t.year).filter((y): y is number => y !== undefined);
    albums.push({
      key: albumKey(g.title, g.tagArtist),
      title: g.title,
      albumArtist,
      artists,
      tracks: ordered,
      discs,
      year: years.length ? Math.min(...years) : undefined,
      durationMs: ordered.reduce((sum, t) => sum + t.durationMs, 0),
      imageUrl: ordered.find((t) => t.imageUrl)?.imageUrl,
    });
  }

  // Keys must be unique; disambiguate rare collisions deterministically.
  const seen = new Map<string, number>();
  for (const album of albums) {
    const n = seen.get(album.key) ?? 0;
    seen.set(album.key, n + 1);
    if (n > 0) album.key = `${album.key}~${n + 1}`;
  }
  return albums;
}

/**
 * Artists from albums. An album belongs to its album artist; every other credited track artist
 * "appears on" it. Various Artists albums belong to nobody — all their artists appear on them.
 */
export function buildArtists(albums: readonly Album[]): Artist[] {
  const map = new Map<string, Artist>();
  const entry = (name: string): Artist => {
    const key = artistKey(name);
    let a = map.get(key);
    if (!a) map.set(key, (a = { key, name, albumKeys: [], appearsOnKeys: [], trackCount: 0 }));
    return a;
  };
  for (const album of albums) {
    const ownerKey = album.albumArtist === VARIOUS_ARTISTS ? undefined : artistKey(album.albumArtist);
    if (ownerKey) entry(album.albumArtist).albumKeys.push(album.key);
    for (const name of album.artists) {
      const a = entry(name);
      if (a.key !== ownerKey && !a.appearsOnKeys.includes(album.key)) a.appearsOnKeys.push(album.key);
    }
    for (const track of album.tracks) {
      for (const key of new Set(track.artists.map(artistKey))) {
        const a = map.get(key);
        if (a) a.trackCount++;
      }
    }
  }
  const byKey = new Map(albums.map((a) => [a.key, a]));
  for (const a of map.values()) {
    a.imageUrl = [...a.albumKeys, ...a.appearsOnKeys].map((k) => byKey.get(k)?.imageUrl).find(Boolean);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function buildLibrary(tracks: Track[], options?: GroupingOptions): Library {
  const albums = groupAlbums(tracks, options);
  const artists = buildArtists(albums);
  return {
    tracks,
    albums,
    artists,
    albumsByKey: new Map(albums.map((a) => [a.key, a])),
    artistsByKey: new Map(artists.map((a) => [a.key, a])),
  };
}
