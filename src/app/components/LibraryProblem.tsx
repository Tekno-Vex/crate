import { useEffect, useState } from 'react';
import { diagnoseLibrary, type LibraryProblem as Problem } from '../../domain/libraryStatus';
import { getLocalFilesStatus, notify, openSpotifySettings, setLocalFilesEnabled, type PlatformError } from '../../platform';
import { go } from '../routes';
import { Loading } from './States';

interface Props {
  trackCount: number;
  scanError?: PlatformError;
  onRescan: () => void;
}

/** Explains an empty or unreadable library and offers the fix that matches the cause. */
export function LibraryProblem({ trackCount, scanError, onRescan }: Props) {
  const [problem, setProblem] = useState<Problem>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void getLocalFilesStatus().then((status) => {
      if (alive) setProblem(diagnoseLibrary({ trackCount, scanError, ...status }));
    });
    return () => {
      alive = false;
    };
  }, [trackCount, scanError]);

  if (!problem) return <Loading label="Checking your local files…" />;

  const turnOn = async () => {
    setBusy(true);
    const res = await setLocalFilesEnabled(true);
    setBusy(false);
    if (res.ok) onRescan();
    else notify(`Couldn't turn on local files: ${res.error.message}. Use Spotify settings instead.`, true);
  };

  const settings = (
    <button type="button" className="crate-btn crate-btn--ghost" onClick={openSpotifySettings}>
      Open Spotify settings
    </button>
  );
  const rescan = (
    <button type="button" className="crate-btn crate-btn--ghost" onClick={onRescan}>
      Rescan
    </button>
  );
  const diagnostics = (
    <button type="button" className="crate-btn crate-btn--ghost" onClick={go.diagnostics}>
      Open Diagnostics
    </button>
  );

  switch (problem.kind) {
    case 'ok':
      return null;
    case 'disabled':
      return (
        <div className="crate-state" data-problem="disabled">
          <h2>Local files are turned off</h2>
          <p className="crate-muted">Crate shows the music files Spotify reads from your computer. Turn local files on to see them here.</p>
          <div className="crate-row">
            <button type="button" className="crate-btn" disabled={busy} onClick={() => void turnOn()}>
              {busy ? 'Turning on…' : 'Turn on local files'}
            </button>
            {settings}
          </div>
        </div>
      );
    case 'no-folders':
      return (
        <div className="crate-state" data-problem="no-folders">
          <h2>No music folders yet</h2>
          <p className="crate-muted">
            In Spotify settings, under <strong>Your Library → Local Files</strong>, click <strong>Add a source</strong> and
            pick the folder with your music. Crate picks it up automatically.
          </p>
          <div className="crate-row">
            {settings}
            {rescan}
          </div>
        </div>
      );
    case 'empty-folders':
      return (
        <div className="crate-state" data-problem="empty-folders">
          <h2>No music found in your folders</h2>
          <p className="crate-muted">Spotify is watching these folders but found no files it can play (MP3, M4A, MP4 or FLAC):</p>
          {problem.folders.length > 0 && (
            <ul className="crate-folder-list">
              {problem.folders.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
          <div className="crate-row">
            {settings}
            {rescan}
          </div>
        </div>
      );
    case 'api-changed':
      return (
        <div className="crate-state crate-state--error" data-problem="api-changed">
          <h2>This Spotify version changed how local files work</h2>
          <p className="crate-muted">
            Crate can't find the part of Spotify it reads local files from. An update to Crate will fix this — opening
            Diagnostics and copying the report into an issue helps it happen sooner.
          </p>
          <p className="crate-muted">{problem.message}</p>
          <div className="crate-row">
            {diagnostics}
            {rescan}
          </div>
        </div>
      );
    case 'scan-failed':
      return (
        <div className="crate-state crate-state--error" data-problem="scan-failed">
          <h2>Couldn't read your local files</h2>
          <p className="crate-muted">{problem.message}</p>
          <div className="crate-row">
            <button type="button" className="crate-btn" onClick={onRescan}>
              Try again
            </button>
            {diagnostics}
          </div>
        </div>
      );
  }
}

/** Thin notice when a rescan failed but the saved library is still shown. */
export function StaleBanner({ error, onRetry }: { error: PlatformError; onRetry: () => void }) {
  return (
    <div className="crate-banner" role="status">
      <span>Showing your saved library — Spotify couldn't be read just now ({error.message}).</span>
      <button type="button" className="crate-link" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
