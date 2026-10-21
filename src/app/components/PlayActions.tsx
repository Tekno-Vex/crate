import { pickStartIndex } from '../../domain/playback';
import { playList, useShuffle } from '../usePlayer';

/** Big Play button + shuffle toggle, as on Spotify's album and artist pages. */
export function PlayActions({ uris, label }: { uris: string[]; label: string }) {
  const [shuffle, toggleShuffle] = useShuffle();
  return (
    <div className="crate-album__actions">
      <button
        type="button"
        className="crate-play"
        aria-label={`Play ${label}`}
        disabled={!uris.length}
        onClick={() => void playList(uris, pickStartIndex(uris.length, shuffle), shuffle)}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path fill="currentColor" d="M7 4.5v15l13-7.5z" />
        </svg>
      </button>
      <button
        type="button"
        className={`crate-icon-btn ${shuffle ? 'is-active' : ''}`}
        aria-label={shuffle ? 'Disable shuffle' : 'Enable shuffle'}
        aria-pressed={shuffle}
        title={shuffle ? 'Disable shuffle' : 'Enable shuffle'}
        onClick={toggleShuffle}
      >
        <svg viewBox="0 0 16 16" width="24" height="24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M13.151.922a.75.75 0 1 0-1.06 1.06L13.109 3H11.16a3.75 3.75 0 0 0-2.873 1.34l-6.173 7.356A2.25 2.25 0 0 1 .39 12.5H0V14h.391a3.75 3.75 0 0 0 2.873-1.34l6.173-7.356a2.25 2.25 0 0 1 1.724-.804h1.947l-1.017 1.018a.75.75 0 0 0 1.06 1.06L15.98 3.75 13.15.922zM.391 3.5H0V2h.391c1.109 0 2.16.49 2.873 1.34L4.89 5.277l-.979 1.167-1.796-2.14A2.25 2.25 0 0 0 .39 3.5z"
          />
          <path
            fill="currentColor"
            d="m7.5 10.723.98-1.167.957 1.14a2.25 2.25 0 0 0 1.724.804h1.947l-1.017-1.018a.75.75 0 1 1 1.06-1.06l2.829 2.828-2.829 2.828a.75.75 0 1 1-1.06-1.06L13.109 13H11.16a3.75 3.75 0 0 1-2.873-1.34l-.787-.938z"
          />
        </svg>
      </button>
    </div>
  );
}
