import { describe, expect, it } from 'vitest';
import { splitArtists } from '../src/domain/artists';
import { formatAlbumDuration, formatTrackDuration } from '../src/domain/format';
import { buildLibrary, groupAlbums } from '../src/domain/grouping';
import { VARIOUS_ARTISTS } from '../src/domain/model';
import { albumKey, normalizeText, slug, stripDiscSuffix } from '../src/domain/normalize';
import { hasReliableNumbering, sortAlbumTracks } from '../src/domain/ordering';
import { syntheticLibrary, track } from './fixtures';

describe('normalize', () => {
  it('strips accents, case, and extra whitespace', () => {
    expect(normalizeText('  Beyoncé   LIVE ')).toBe('beyonce live');
  });
  it('keeps non-Latin scripts in slugs', () => {
    expect(slug('ペルソナ3 オリジナル・サウンドトラック')).toBe('ペルソナ3-オリジナル-サウンドトラック');
    expect(slug('バス')).not.toBe(slug('ハス'));
    expect(slug('!!!')).toBe('_');
  });
  it('builds stable album keys', () => {
    expect(albumKey('The Dark Side of the Moon')).toBe('the-dark-side-of-the-moon');
    expect(albumKey('Discovery', 'Daft Punk')).toBe('discovery~daft-punk');
  });
  it('strips disc suffixes', () => {
    expect(stripDiscSuffix('Mellon Collie (Disc 2)')).toEqual({ title: 'Mellon Collie', disc: 2 });
    expect(stripDiscSuffix('Album [CD1]')).toEqual({ title: 'Album', disc: 1 });
    expect(stripDiscSuffix('Album - Disc 3')).toEqual({ title: 'Album', disc: 3 });
    expect(stripDiscSuffix('Album (Disc 1 of 2)')).toEqual({ title: 'Album', disc: 1 });
    expect(stripDiscSuffix('Discovery')).toEqual({ title: 'Discovery' });
    expect(stripDiscSuffix('CD2')).toEqual({ title: 'CD2' });
  });
});

describe('splitArtists', () => {
  it('splits Spotify-joined strings', () => {
    expect(splitArtists('A, B')).toEqual(['A', 'B']);
    expect(splitArtists('A; B;C')).toEqual(['A', 'B', 'C']);
    expect(splitArtists('A feat. B')).toEqual(['A', 'B']);
    expect(splitArtists('A ft. B, C')).toEqual(['A', 'B', 'C']);
  });
  it('keeps names that contain separators', () => {
    expect(splitArtists('Tyler, The Creator, Kali Uchis')).toEqual(['Tyler, The Creator', 'Kali Uchis']);
    expect(splitArtists('Earth, Wind & Fire')).toEqual(['Earth, Wind & Fire']);
    expect(splitArtists('Simon & Garfunkel')).toEqual(['Simon & Garfunkel']);
  });
  it('dedupes and ignores empties', () => {
    expect(splitArtists('A, a, , B')).toEqual(['A', 'B']);
    expect(splitArtists('')).toEqual([]);
  });
});

describe('ordering', () => {
  it('orders by disc, then track, then original order', () => {
    const t = [
      track({ title: 'd2t1', discNumber: 2, trackNumber: 1, originalIndex: 0 }),
      track({ title: 'unnumbered', originalIndex: 1 }),
      track({ title: 'd1t2', discNumber: 1, trackNumber: 2, originalIndex: 2 }),
      track({ title: 'd1t1', discNumber: 1, trackNumber: 1, originalIndex: 3 }),
    ];
    expect(sortAlbumTracks(t).map((x) => x.title)).toEqual(['d1t1', 'd1t2', 'unnumbered', 'd2t1']);
  });
  it('detects reliable numbering', () => {
    expect(hasReliableNumbering([track({ title: 'a', trackNumber: 1 }), track({ title: 'b' })])).toBe(false);
    expect(hasReliableNumbering([track({ title: 'a', trackNumber: 1 })])).toBe(true);
  });
});

describe('grouping', () => {
  it('merges an album split by featured artists (Spotify keys by artist+album)', () => {
    const albums = groupAlbums([
      track({ title: '1', album: 'Igor', artists: ['Tyler, The Creator'] }),
      track({ title: '2', album: 'Igor', artists: ['Tyler, The Creator', 'Playboi Carti'] }),
      track({ title: '3', album: 'Igor', artists: ['Tyler, The Creator'] }),
    ]);
    expect(albums).toHaveLength(1);
    expect(albums[0]!.albumArtist).toBe('Tyler, The Creator');
  });

  it('labels compilations as Various Artists', () => {
    const [album] = groupAlbums([
      track({ title: '1', album: 'Now 99', artists: ['A'] }),
      track({ title: '2', album: 'Now 99', artists: ['B'] }),
      track({ title: '3', album: 'Now 99', artists: ['C'] }),
    ]);
    expect(album!.albumArtist).toBe(VARIOUS_ARTISTS);
  });

  it('joins "(Disc N)" albums into one album with disc numbers', () => {
    const [album, ...rest] = groupAlbums([
      track({ title: 'b1', album: 'Box (Disc 2)', trackNumber: 1 }),
      track({ title: 'a1', album: 'Box (Disc 1)', trackNumber: 1 }),
      track({ title: 'a2', album: 'Box (Disc 1)', trackNumber: 2 }),
    ]);
    expect(rest).toHaveLength(0);
    expect(album!.title).toBe('Box');
    expect(album!.discs).toEqual([1, 2]);
    expect(album!.tracks.map((t) => t.title)).toEqual(['a1', 'a2', 'b1']);
  });

  it('keeps albums apart when the tagged album artist differs', () => {
    const albums = groupAlbums([
      track({ title: '1', album: 'Greatest Hits', albumArtist: 'Queen' }),
      track({ title: '2', album: 'Greatest Hits', albumArtist: 'ABBA' }),
    ]);
    expect(albums.map((a) => a.key).sort()).toEqual(['greatest-hits~abba', 'greatest-hits~queen']);
  });

  it('builds a 20k-track library quickly', () => {
    const tracks = syntheticLibrary(2000, 10);
    const start = performance.now();
    const lib = buildLibrary(tracks);
    const ms = performance.now() - start;
    expect(lib.albums).toHaveLength(2000);
    expect(lib.albumsByKey.size).toBe(2000);
    expect(ms).toBeLessThan(1500);
  });
});

describe('format', () => {
  it('formats durations like Spotify', () => {
    expect(formatTrackDuration(187_000)).toBe('3:07');
    expect(formatTrackDuration(3_729_000)).toBe('1:02:09');
    expect(formatAlbumDuration(2_832_000)).toBe('47 min 12 sec');
    expect(formatAlbumDuration(3_780_000)).toBe('1 hr 3 min');
  });
});
