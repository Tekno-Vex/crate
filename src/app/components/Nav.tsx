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
      {/* TODO(M1): Artists tab */}
      {tab('Diagnostics', route.name === 'diagnostics', go.diagnostics)}
    </nav>
  );
}
