// Core library model. Pure types — no Spicetify access in src/domain.

export type TrackSource = 'spotify' | 'spotify+helper';

export interface Track {
  /** spotify:local:… URI — Spotify's identity for this track. */
  uri: string;
  title: string;
  /** Individual artists after splitting Spotify's concatenated string. */
  artists: string[];
  /** Artist string as Spotify shows it. */
  artistDisplay: string;
  album: string;
  /** Only known from real tags (helper) or heuristics; Spotify ignores album-artist tags. */
  albumArtist?: string;
  trackNumber?: number;
  trackTotal?: number;
  discNumber?: number;
  discTotal?: number;
  durationMs: number;
  year?: number;
  genre?: string[];
  imageUrl?: string;
  addedAt?: number;
  filePath?: string;
  source: TrackSource;
  /** Position in the order Spotify returned tracks; used as a stable fallback sort. */
  originalIndex: number;
}

export interface Album {
  /** Stable key used in URLs and persisted UI state. */
  key: string;
  title: string;
  /** Tag album artist, "Various Artists", or the dominant track artist. */
  albumArtist: string;
  /** Distinct individual artists across tracks, most frequent first. */
  artists: string[];
  /** Ordered: disc → track → original order. */
  tracks: Track[];
  /** Distinct disc numbers present (empty if unknown). */
  discs: number[];
  year?: number;
  durationMs: number;
  imageUrl?: string;
}

export interface Artist {
  key: string;
  name: string;
  /** Albums where this artist is the album artist. */
  albumKeys: string[];
  /** Albums they only appear on (features, Various Artists compilations). */
  appearsOnKeys: string[];
  /** Tracks this artist is credited on, across all albums. */
  trackCount: number;
  /** Spotify exposes no artist photos for local files — an album cover stands in. */
  imageUrl?: string;
}

export interface Library {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  albumsByKey: Map<string, Album>;
  artistsByKey: Map<string, Artist>;
}

export const VARIOUS_ARTISTS = 'Various Artists';
export const UNKNOWN_ALBUM = 'Unknown Album';
export const UNKNOWN_ARTIST = 'Unknown Artist';
