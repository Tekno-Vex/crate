import { describe, expect, it } from 'vitest';
import { artistDiscography } from '../src/domain/discography';
import { buildLibrary } from '../src/domain/grouping';
import { VARIOUS_ARTISTS } from '../src/domain/model';
import { track } from './fixtures';

const lib = () =>
  buildLibrary([
    track({ title: 'a1', album: 'First', artists: ['Black Kray'], trackNumber: 1, year: 2014, imageUrl: 'img:first' }),
    track({ title: 'a2', album: 'First', artists: ['Black Kray', 'Luckaleannn'], trackNumber: 2, year: 2014 }),
    track({ title: 'b1', album: 'Second', artists: ['Black Kray'], trackNumber: 1, year: 2016, imageUrl: 'img:second' }),
    // A compilation: no artist on most tracks → Various Artists.
    track({ title: 'c1', album: 'Comp', artists: ['Black Kray'], trackNumber: 1, imageUrl: 'img:comp' }),
    track({ title: 'c2', album: 'Comp', artists: ['Someone'], trackNumber: 2 }),
    track({ title: 'c3', album: 'Comp', artists: ['Other'], trackNumber: 3 }),
  ]);

describe('buildArtists', () => {
  it('separates own albums from appearances', () => {
    const l = lib();
    expect(l.albumsByKey.get('comp')!.albumArtist).toBe(VARIOUS_ARTISTS);
    const bk = l.artistsByKey.get('black-kray')!;
    expect(bk.albumKeys.sort()).toEqual(['first', 'second']);
    expect(bk.appearsOnKeys).toEqual(['comp']);
    expect(bk.trackCount).toBe(4);
    const guest = l.artistsByKey.get('luckaleannn')!;
    expect(guest).toMatchObject({ albumKeys: [], appearsOnKeys: ['first'], trackCount: 1 });
  });
  it('never creates a "Various Artists" artist', () => {
    expect(lib().artistsByKey.has('various-artists')).toBe(false);
  });
  it('uses an own album cover as the artist image, else an appearance', () => {
    const l = lib();
    expect(l.artistsByKey.get('black-kray')!.imageUrl).toMatch(/^img:(first|second)$/);
    expect(l.artistsByKey.get('someone')!.imageUrl).toBe('img:comp');
  });
});

describe('artistDiscography', () => {
  it('orders own albums newest first and plays them in order', () => {
    const d = artistDiscography(lib(), 'black-kray')!;
    expect(d.albums.map((a) => a.title)).toEqual(['Second', 'First']);
    expect(d.appearsOn.map((a) => a.title)).toEqual(['Comp']);
    expect(d.playOrder.map((t) => t.title)).toEqual(['b1', 'a1', 'a2']);
  });
  it('plays only their own tracks for an artist who just appears on albums', () => {
    expect(artistDiscography(lib(), 'someone')!.playOrder.map((t) => t.title)).toEqual(['c2']);
  });
  it('returns undefined for unknown artists', () => {
    expect(artistDiscography(lib(), 'nobody')).toBeUndefined();
  });
});
