import type { ReactNode } from 'react';
import type { PlatformError } from '../../platform';
import { go } from '../routes';

export function Loading({ label = 'Loading your local files…' }: { label?: string }) {
  return <div className="crate-state">{label}</div>;
}

export function ErrorState({ error, onRetry }: { error: PlatformError; onRetry?: () => void }) {
  return (
    <div className="crate-state crate-state--error">
      <h2>Couldn't read your local files</h2>
      <p>{error.message}</p>
      <p className="crate-muted">
        Check that "Show Local Files" is on in Spotify settings. If it is, Spotify may have changed an
        internal API — open Diagnostics and copy the report into an issue.
      </p>
      <div className="crate-row">
        {onRetry && (
          <button type="button" className="crate-btn" onClick={onRetry}>
            Try again
          </button>
        )}
        <button type="button" className="crate-btn crate-btn--ghost" onClick={go.diagnostics}>
          Open Diagnostics
        </button>
      </div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="crate-state">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
