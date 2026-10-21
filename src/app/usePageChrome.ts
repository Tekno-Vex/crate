import { useEffect, useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';
import { findScrollParent, headerColor } from '../platform';
import { libraryStore } from './libraryStore';

/**
 * Header tint from a cover image, cached per cover in the library store. `trackUri` lets Spotify's
 * own extractor handle catalog tracks; local covers go through the canvas fallback (S7).
 */
export function useHeaderColor(trackUri: string | undefined, imageUrl: string | undefined, key: string): string | undefined {
  const [color, setColor] = useState<string>();
  useEffect(() => {
    const cacheKey = imageUrl ?? key;
    const cached = libraryStore().getTint(cacheKey);
    setColor(cached);
    if (!trackUri || cached) return;
    let alive = true;
    headerColor(trackUri, imageUrl).then((res) => {
      if (!res.ok) return;
      libraryStore().setTint(cacheKey, res.value.color);
      if (alive) setColor(res.value.color);
    });
    return () => {
      alive = false;
    };
  }, [trackUri, imageUrl, key]);
  return color;
}

/** Spotify's scroll container is shared by every page — open each detail page at the top. */
export function useScrollToTop(ref: RefObject<Element | null>, key: string): void {
  useLayoutEffect(() => {
    const scroller = findScrollParent(ref.current);
    if (scroller) scroller.scrollTop = 0;
  }, [key]);
}
