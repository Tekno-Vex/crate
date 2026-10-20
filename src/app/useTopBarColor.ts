import { useEffect } from 'react';
import { setTopBarColor } from '../platform';

/** Matches Spotify's page background so the top bar doesn't show another page's color. */
export const NEUTRAL_TOP_BAR = 'var(--background-base, #121212)';

/** Paint Spotify's top bar while this component is mounted. `undefined` = leave it alone. */
export function useTopBarColor(color: string | undefined): void {
  useEffect(() => {
    if (!color) return;
    let cleanup: (() => void) | undefined;
    const apply = () => {
      const res = setTopBarColor(color);
      if (res.ok) cleanup = res.value;
      return res.ok;
    };
    // The bar can mount after our page on first navigation — retry once.
    const retry = apply() ? undefined : setTimeout(apply, 300);
    return () => {
      clearTimeout(retry);
      cleanup?.();
    };
  }, [color]);
}
