// Spotify local track URIs: spotify:local:<artist>:<album>:<title>:<durationSeconds>
// Components are URL-encoded with "+" for spaces. Exact rules: UNVERIFIED (spike S5).

export interface LocalUriParts {
  artist: string;
  album: string;
  title: string;
  durationSec: number | null;
}

const PREFIX = 'spotify:local:';

export function isLocalUri(uri: string): boolean {
  return uri.startsWith(PREFIX);
}

function decode(part: string): string {
  try {
    return decodeURIComponent(part.replace(/\+/g, ' '));
  } catch {
    return part.replace(/\+/g, ' ');
  }
}

function encode(part: string): string {
  return encodeURIComponent(part).replace(/%20/g, '+');
}

export function parseLocalUri(uri: string): LocalUriParts | null {
  if (!isLocalUri(uri)) return null;
  const parts = uri.slice(PREFIX.length).split(':');
  if (parts.length !== 4) return null;
  const [artist = '', album = '', title = '', dur = ''] = parts;
  const n = Number(dur);
  return {
    artist: decode(artist),
    album: decode(album),
    title: decode(title),
    durationSec: dur !== '' && Number.isFinite(n) ? n : null,
  };
}

export function buildLocalUri(p: LocalUriParts): string {
  return `${PREFIX}${encode(p.artist)}:${encode(p.album)}:${encode(p.title)}:${p.durationSec ?? ''}`;
}
