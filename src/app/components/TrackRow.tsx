import type { Ref } from 'react';
import { formatTrackDuration } from '../../domain/format';
import type { Track } from '../../domain/model';
import { NativeTrackMenu } from '../../platform';

interface TrackRowProps {
  track: Track;
  /** What the # column shows (tag track number, or position when untagged). */
  number: string | number;
  playing: boolean;
  selected: boolean;
  onSelect: () => void;
  onPlay: () => void;
}

/**
 * One tracklist row, behaving like Spotify's: click selects, double-click / Enter plays, hover shows a
 * play button in the # column, right-click opens Spotify's own track menu.
 */
export function TrackRow({ track, number, playing, selected, onSelect, onPlay }: TrackRowProps) {
  return (
    <NativeTrackMenu uri={track.uri}>
      {({ isOpen, onContextMenu, ref }) => (
        <li
          ref={ref as Ref<HTMLLIElement> | undefined}
          className={`crate-track${playing ? ' is-playing' : ''}${selected || isOpen ? ' is-selected' : ''}`}
          tabIndex={0}
          aria-selected={selected}
          onClick={onSelect}
          onDoubleClick={onPlay}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onPlay();
          }}
          onContextMenu={(e) => {
            onSelect();
            onContextMenu?.(e);
          }}
        >
          <span className="crate-track__num">
            <span className="crate-track__n">{number}</span>
            <button
              type="button"
              className="crate-track__play"
              aria-label={`Play ${track.title}`}
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onPlay();
              }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path fill="currentColor" d="M7 4.5v15l13-7.5z" />
              </svg>
            </button>
          </span>
          <span className="crate-track__main">
            <span className="crate-track__title">{track.title}</span>
            <span className="crate-track__artists">{track.artistDisplay}</span>
          </span>
          <span className="crate-right crate-muted">{formatTrackDuration(track.durationMs)}</span>
        </li>
      )}
    </NativeTrackMenu>
  );
}
