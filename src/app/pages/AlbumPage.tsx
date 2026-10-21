import { useEffect, useRef, useState } from 'react';
import type { Library, Track } from '../../domain/model';
import { VARIOUS_ARTISTS } from '../../domain/model';
import { formatAlbumDuration, pluralize } from '../../domain/format';
import { artistKey } from '../../domain/normalize';
import { hasReliableNumbering } from '../../domain/ordering';
import { Cover } from '../components/Cover';
import { PlayActions } from '../components/PlayActions';
import { Empty } from '../components/States';
import { TrackRow } from '../components/TrackRow';
import { go } from '../routes';
import { useHeaderColor, useScrollToTop } from '../usePageChrome';
import { playList, useNowPlaying } from '../usePlayer';
import { NEUTRAL_TOP_BAR, useTopBarColor } from '../useTopBarColor';

export function AlbumPage({ library, albumKey }: { library: Library; albumKey: string }) {
  const album = library.albumsByKey.get(albumKey);
  const color = useHeaderColor(album?.tracks[0]?.uri, album?.imageUrl, albumKey);
  useTopBarColor(color ?? NEUTRAL_TOP_BAR);
  const pageRef = useRef<HTMLElement>(null);
  useScrollToTop(pageRef, albumKey);
  const nowPlaying = useNowPlaying();
  const [selected, setSelected] = useState<string>();
  useEffect(() => setSelected(undefined), [albumKey]);

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
  const play = (index: number) => void playList(uris, index);
  // Link the album artist to their artist page (not for "Various Artists").
  const ownerKey = album.albumArtist === VARIOUS_ARTISTS ? undefined : artistKey(album.albumArtist);
  const owner = ownerKey && library.artistsByKey.has(ownerKey) ? ownerKey : undefined;

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
    <section ref={pageRef} className="crate-page crate-album" style={color ? { ['--crate-tint' as string]: color } : undefined}>
      <header className="crate-album__header">
        <Cover src={album.imageUrl} alt={album.title} className="crate-album__cover" />
        <div className="crate-album__meta">
          <span className="crate-eyebrow">Album · Local files</span>
          <h1 className="crate-album__title">{album.title}</h1>
          <div className="crate-album__line">
            {owner ? (
              <button type="button" className="crate-link" onClick={() => go.artist(owner)}>
                {album.albumArtist}
              </button>
            ) : (
              <strong>{album.albumArtist}</strong>
            )}
            {album.year ? <span> · {album.year}</span> : null}
            <span> · {pluralize(album.tracks.length, 'song')}</span>
            <span className="crate-muted">, {formatAlbumDuration(album.durationMs)}</span>
          </div>
        </div>
      </header>

      <PlayActions uris={uris} label={album.title} />

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
            <TrackRow
              key={row.track.uri}
              track={row.track}
              number={numbered ? (row.track.trackNumber ?? '–') : row.index + 1}
              playing={row.track.uri === nowPlaying}
              selected={row.track.uri === selected}
              onSelect={() => setSelected(row.track.uri)}
              onPlay={() => play(row.index)}
            />
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
