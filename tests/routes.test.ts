import { describe, expect, it } from 'vitest';
import { parseRoute, paths } from '../src/app/routes';

describe('routes', () => {
  it('parses every page', () => {
    expect(parseRoute('/crate')).toEqual({ name: 'albums' });
    expect(parseRoute('/crate/artists')).toEqual({ name: 'artists' });
    expect(parseRoute('/crate/diagnostics')).toEqual({ name: 'diagnostics' });
    expect(parseRoute('/crate/nope')).toEqual({ name: 'not-found', path: '/crate/nope' });
  });
  it('round-trips album and artist keys, including encoded characters', () => {
    for (const key of ['black-kray', 'ペル~sega', 'dejection-unclean']) {
      expect(parseRoute(paths.artist(key))).toEqual({ name: 'artist', key });
      expect(parseRoute(paths.album(key))).toEqual({ name: 'album', key });
    }
  });
});
