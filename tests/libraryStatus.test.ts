import { describe, expect, it } from 'vitest';
import { diagnoseLibrary } from '../src/domain/libraryStatus';

describe('diagnoseLibrary', () => {
  it('is ok with tracks', () => {
    expect(diagnoseLibrary({ trackCount: 615, enabled: true })).toEqual({ kind: 'ok' });
  });
  it('reports local files turned off, even when the scan also failed', () => {
    expect(diagnoseLibrary({ trackCount: 0, enabled: false })).toEqual({ kind: 'disabled' });
    expect(diagnoseLibrary({ trackCount: 0, enabled: false, scanError: { code: 'failed', message: 'x' } })).toEqual({
      kind: 'disabled',
    });
  });
  it('tells apart "no folders" from "folders but no music"', () => {
    expect(diagnoseLibrary({ trackCount: 0, enabled: true, folders: [] })).toEqual({ kind: 'no-folders' });
    expect(diagnoseLibrary({ trackCount: 0, enabled: true, folders: [], enabledDefaultSources: 1 })).toEqual({
      kind: 'empty-folders',
      folders: [],
    });
    expect(diagnoseLibrary({ trackCount: 0, enabled: true, folders: ['C:\\Music'] })).toEqual({
      kind: 'empty-folders',
      folders: ['C:\\Music'],
    });
  });
  it('separates a missing API (Spotify changed) from a failed read', () => {
    expect(diagnoseLibrary({ trackCount: 0, scanError: { code: 'unavailable', message: 'gone' } })).toEqual({
      kind: 'api-changed',
      message: 'gone',
    });
    expect(diagnoseLibrary({ trackCount: 0, enabled: true, scanError: { code: 'failed', message: 'boom' } })).toEqual({
      kind: 'scan-failed',
      message: 'boom',
    });
  });
  it('treats unknown enabled state as "maybe on"', () => {
    expect(diagnoseLibrary({ trackCount: 0 })).toEqual({ kind: 'no-folders' });
  });
});
