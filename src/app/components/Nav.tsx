import type { Route } from '../routes';
import { go } from '../routes';

export function Nav({ route }: { route: Route }) {
  const tab = (label: string, active: boolean, onClick: () => void) => (
    <button type="button" className={`crate-tab ${active ? 'is-active' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
  return (
    <nav className="crate-nav">
      {tab('Albums', route.name === 'albums' || route.name === 'album', go.albums)}
      {tab('Artists', route.name === 'artists' || route.name === 'artist', go.artists)}
      <div className="crate-spacer" />
      {/* Support tool, not a feature — kept small. Linked from error screens and the README too. */}
      <button
        type="button"
        className={`crate-icon-btn crate-nav__diag ${route.name === 'diagnostics' ? 'is-current' : ''}`}
        aria-label="Diagnostics"
        title="Diagnostics"
        onClick={go.diagnostics}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path
            fill="currentColor"
            d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8.75-3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zM7.25 7h1.5v4.5h-1.5V7z"
          />
        </svg>
      </button>
    </nav>
  );
}
