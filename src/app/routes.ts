import { useEffect, useState } from 'react';
import { currentLocation, navigate, onLocationChange } from '../platform';

export type Route =
  | { name: 'albums' }
  | { name: 'album'; key: string }
  | { name: 'diagnostics' }
  | { name: 'not-found'; path: string };

const BASE = `/${__APP_ID__}`;

export const paths = {
  albums: () => BASE,
  album: (key: string) => `${BASE}/album/${encodeURIComponent(key)}`,
  diagnostics: () => `${BASE}/diagnostics`,
};

export function parseRoute(pathname: string): Route {
  if (pathname === BASE || pathname === `${BASE}/`) return { name: 'albums' };
  const rest = pathname.startsWith(`${BASE}/`) ? pathname.slice(BASE.length + 1) : null;
  if (rest === null) return { name: 'not-found', path: pathname };
  const [head, ...tail] = rest.split('/');
  if (head === 'album' && tail[0]) return { name: 'album', key: decodeURIComponent(tail[0]) };
  if (head === 'diagnostics') return { name: 'diagnostics' };
  return { name: 'not-found', path: pathname };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(currentLocation().pathname));
  useEffect(() => onLocationChange((loc) => setRoute(parseRoute(loc.pathname))), []);
  return route;
}

export const go = {
  albums: () => navigate(paths.albums()),
  album: (key: string) => navigate(paths.album(key)),
  diagnostics: () => navigate(paths.diagnostics()),
};
