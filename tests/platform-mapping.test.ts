import { describe, expect, it } from 'vitest';
import { buildLocalUri, isLocalUri, parseLocalUri } from '../src/domain/localUri';
import { fieldInventory, filePathFromImageUri, mapLocalTrack, toImageUrl } from '../src/platform/mapLocalTrack';
import { realLocalTrack } from './fixtures';

describe('local URIs (spike S5 will add real-world cases)', () => {
  it('parses spotify:local URIs', () => {
    expect(parseLocalUri('spotify:local:Daft+Punk:Discovery:One+More+Time:320')).toEqual({
      artist: 'Daft Punk',
      album: 'Discovery',
      title: 'One More Time',
      durationSec: 320,
    });
  });
  it('decodes percent-encoding and tolerates empty parts', () => {
    expect(parseLocalUri('spotify:local::%E3%83%9A%E3%83%AB:Title%3A+Part+2:')).toEqual({
      artist: '',
      album: 'ペル',
      title: 'Title: Part 2',
      durationSec: null,
    });
  });
  it('round-trips', () => {
    const parts = { artist: 'A & B', album: 'X: Y', title: '100% Pure', durationSec: 12 };
    expect(parseLocalUri(buildLocalUri(parts))).toEqual(parts);
  });
  it('rejects non-local URIs', () => {
    expect(isLocalUri('spotify:track:abc')).toBe(false);
    expect(parseLocalUri('spotify:track:abc')).toBeNull();
  });
});

describe('mapLocalTrack', () => {
  it('maps a plausible raw local track', () => {
    const t = mapLocalTrack(
      {
        uri: 'spotify:local:A%2C+B:Album:Song:200',
        name: 'Song',
        album: { name: 'Album', images: [{ url: 'spotify:image:abc123', width: 64 }, { url: 'spotify:image:def456', width: 640 }] },
        artists: [{ name: 'A' }, { name: 'B' }],
        duration: { milliseconds: 200_123 },
        trackNumber: 3,
      },
      7,
    );
    expect(t).toMatchObject({
      title: 'Song',
      album: 'Album',
      artists: ['A', 'B'],
      artistDisplay: 'A, B',
      durationMs: 200_123,
      trackNumber: 3,
      imageUrl: 'https://i.scdn.co/image/def456',
      originalIndex: 7,
    });
  });
  it('maps the real 1.3.5 shape (spike S1)', () => {
    const t = mapLocalTrack(realLocalTrack(), 0);
    expect(t).toMatchObject({
      title: 'City Light (In Still Dark Forenoon Silence)',
      album: 'Burning For The Ancient',
      artists: ['Addaura'],
      trackNumber: 1,
      durationMs: 624_000,
      addedAt: Date.parse('2026-09-03T16:54:24.000Z'),
      filePath:
        'C:\\Users\\kathi\\Music\\iTunes\\iTunes Media\\Music\\Addaura\\Burning For The Ancient\\01 City Light (In Still Dark Forenoo.mp3',
    });
    expect(t!.discNumber).toBeUndefined(); // 0 = untagged
    expect(t!.imageUrl).toMatch(/^spotify:localfileimage:/);
  });
  it('treats trackNumber 0 as missing', () => {
    expect(mapLocalTrack({ ...realLocalTrack(), trackNumber: 0 }, 0)!.trackNumber).toBeUndefined();
  });
  it('extracts file paths only from localfileimage URIs', () => {
    expect(filePathFromImageUri('spotify:localfileimage:%2Fmusic%2Fa%20b.flac')).toBe('/music/a b.flac');
    expect(filePathFromImageUri('spotify:image:abc')).toBeUndefined();
    expect(filePathFromImageUri(undefined)).toBeUndefined();
  });
  it('falls back to the URI when fields are missing', () => {
    const t = mapLocalTrack({ uri: 'spotify:local:Artist:Album:Title:180' }, 0);
    expect(t).toMatchObject({ title: 'Title', album: 'Album', artists: ['Artist'], durationMs: 180_000 });
  });
  it('returns null without a URI', () => {
    expect(mapLocalTrack({ name: 'x' }, 0)).toBeNull();
  });
  it('passes local image URIs through', () => {
    expect(toImageUrl('spotify:localfileimage:%2Fmusic%2Fa.mp3')).toBe('spotify:localfileimage:%2Fmusic%2Fa.mp3');
  });
  it('inventories fields', () => {
    const inv = fieldInventory([{ a: 1, b: { c: 'x' } }, { a: 2, d: [] }]);
    expect(inv.a).toEqual({ count: 2, types: ['number'] });
    expect(inv['b.c']).toEqual({ count: 1, types: ['string'] });
    expect(inv.d).toEqual({ count: 1, types: ['array'] });
  });
});
