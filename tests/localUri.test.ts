import { describe, expect, it } from 'vitest';
import { buildLocalUri, parseLocalUri } from '../src/domain/localUri';
import { REAL_LOCAL_URIS } from './fixtures';

describe('local URI encoding matches Spotify 1.3.5 (spike S1/S5)', () => {
  it.each(REAL_LOCAL_URIS)('round-trips %s', (uri) => {
    const parts = parseLocalUri(uri);
    expect(parts).not.toBeNull();
    expect(buildLocalUri(parts!)).toBe(uri);
  });

  it('decodes the tricky ones', () => {
    expect(parseLocalUri(REAL_LOCAL_URIS[1]!)!.title).toBe("The Muses Thro' Their Bowers");
    expect(parseLocalUri(REAL_LOCAL_URIS[3]!)!.title).toBe('La Forêt de cristal');
    expect(parseLocalUri(REAL_LOCAL_URIS[7]!)!.album).toBe('Dejection / Unclean');
    expect(parseLocalUri(REAL_LOCAL_URIS[10]!)!.album).toBe('Crack Cloud$ Over Arts Kitchen');
  });
});
