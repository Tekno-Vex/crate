import { useEffect, useState } from 'react';
import type { Album, Library, Track } from '../../domain/model';
import { formatAlbumDuration, formatTrackDuration, pluralize } from '../../domain/format';
import { hasReliableNumbering } from '../../domain/ordering';
import { getCurrentTrackUri, headerColor, notify, onSongChange, playTracks } from '../../platform';
import { Cover } from '../components/Cover';
import { libraryStore } from '../libraryStore';
import { NEUTRAL_TOP_BAR, useTopBarColor } from '../useTopBarColor';
import { Empty } from '../components/States';
import { go } from '../routes';

function useHeaderColor(album: Album | undefined): string | undefined {
  const [color, setColor] = useState<string>();
  useEffect(() => {
    const uri = album?.tracks[0]?.uri;
    const cacheKey = album?.imageUrl ?? album?.key;
    const cached = cacheKey ? libraryStore().getTint(cacheKey) : undefined;
    setColor(cached);
    if (!uri || !cacheKey || cached) return;
    let alive = true;
    headerColor(uri, album?.imageUrl).then((res) => {
      if (!res.ok) return;
      libraryStore().setTint(cacheKey, res.value.color);
      if (alive) setColor(res.value.color);
    });
    return () => {
      alive = false;
    };
  }, [album?.key]);
  return color;
}

function useNowPlaying(): string | undefined {
  const [uri, setUri] = useState(getCurrentTrackUri);
  useEffect(() => onSongChange(setUri), []);
  return uri;
}

export function AlbumPage({ library, albumKey }: { library: Library; albumKey: string }) {
  const album = library.albumsByKey.get(albumKey);
  const color = useHeaderColor(album);
  useTopBarColor(color ?? NEUTRAL_TOP_BAR);
  const nowPlaying = useNowPlaying();

  if (!album) {
    return (
      <Empty title="Album not found">
        <button type="button" className="crate-btn" onClick={go.albums}>
          Back to albums
        </button>
      </Empty>
    );
  }

  const uris = album.tracks.map((t) => t.uri);
  const play = async (index: number) => {
    const res = await playTracks(uris, index);
    if (!res.ok) notify(`Couldn't play: ${res.error.message}`, true);
  };

  const numbered = hasReliableNumbering(album.tracks);
  const multiDisc = album.discs.length > 1;
  const rows: ({ kind: 'disc'; disc: number } | { kind: 'track'; track: Track; index: number })[] = [];
  album.tracks.forEach((track, index) => {
    const prev = album.tracks[index - 1];
    if (multiDisc && (index === 0 || prev?.discNumber !== track.discNumber)) {
      rows.push({ kind: 'disc', disc: track.discNumber ?? 1 });
    }
    rows.push({ kind: 'track', track, index });
  });

  return (
    <section className="crate-page crate-album" style={color ? { ['--crate-tint' as string]: color } : undefined}>
      <header className="crate-album__header">
        <Cover src={album.imageUrl} alt={album.title} className="crate-album__cover" />
        <div className="crate-album__meta">
          <span className="crate-eyebrow">Album · Local files</span>
          <h1 className="crate-album__title">{album.title}</h1>
          <div className="crate-album__line">
            <strong>{album.albumArtist}</strong>
            {album.year ? <span> · {album.year}</span> : null}
            <span> · {pluralize(album.tracks.length, 'song')}</span>
            <span className="crate-muted">, {formatAlbumDuration(album.durationMs)}</span>
          </div>
        </div>
      </header>

      <div className="crate-album__actions">
        <button type="button" className="crate-play" aria-label="Play" onClick={() => play(0)}>
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path fill="currentColor" d="M7 4.5v15l13-7.5z" />
          </svg>
        </button>
      </div>

      <ol className="crate-tracklist" role="list">
        <li className="crate-tracklist__head" aria-hidden="true">
          <span>#</span>
          <span>Title</span>
          <span className="crate-right">Time</span>
        </li>
        {rows.map((row) =>
          row.kind === 'disc' ? (
            <li key={`disc-${row.disc}`} className="crate-disc">
              Disc {row.disc}
            </li>
          ) : (
            <li
              key={row.track.uri}
              className={`crate-track ${row.track.uri === nowPlaying ? 'is-playing' : ''}`}
              onDoubleClick={() => play(row.index)}
            >
              <span className="crate-track__num">
                <span className="crate-track__n">{numbered ? (row.track.trackNumber ?? '–') : row.index + 1}</span>
                <button
                  type="button"
                  className="crate-track__play"
                  aria-label={`Play ${row.track.title}`}
                  onClick={() => play(row.index)}
                >
                  ▶
                </button>
              </span>
              <span className="crate-track__main">
                <span className="crate-track__title">{row.track.title}</span>
                <span className="crate-track__artists">{row.track.artistDisplay}</span>
              </span>
              <span className="crate-right crate-muted">{formatTrackDuration(row.track.durationMs)}</span>
            </li>
          ),
        )}
      </ol>
      {!numbered && (
        <p className="crate-muted crate-note">
          Track numbers aren't available from Spotify for this album, so tracks are in library order.
          The Crate Helper (coming soon) reads the real tags.
        </p>
      )}
    </section>
  );
}
