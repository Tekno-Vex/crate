// Spotify's sticky top bar over the main view. Native pages set its color (album pages use the
// cover color) and it fades in on scroll; custom apps inherit whatever the last page left — the
// "purple bar" after Liked Songs, seen 2026-10-20.
//
// Verified 1.3.5.3058 (Diagnostics → Top bar, 2026-10-20):
//   <header data-testid="topbar">            ← container, pointer-events: none
//     <div style="opacity: 1; --background-base: #5038a0">   ← color layer; opacity fades on scroll
// So the color is the CSS variable `--background-base` set inline on the layer, not background-color.

import { log } from '../lib/log';
import type { Result } from './index';

const BG_VAR = '--background-base';

function mainView(): HTMLElement | null {
  return document.getElementById('main-view') ?? document.querySelector<HTMLElement>('.main-view-container');
}

/**
 * The layer Spotify colors via an inline `--background-base`, inside the topbar header.
 * Spotify only writes that variable once a native page with a color has been shown — after a fresh
 * start it's absent (bar stays black, 2026-10-20). Then fall back to the layer's structure: the
 * full-width, absolutely positioned element inside the header (same element, per 1.3.5 probe).
 */
function colorLayer(): HTMLElement | null {
  const bar = document.querySelector<HTMLElement>('[data-testid="topbar"]');
  if (!bar) return null;
  const all = [...bar.querySelectorAll<HTMLElement>('*')];
  const tagged = all.find((el) => el.style.getPropertyValue(BG_VAR));
  if (tagged) return tagged;
  const width = bar.getBoundingClientRect().width;
  return (
    all.find((el) => getComputedStyle(el).position === 'absolute' && el.getBoundingClientRect().width >= width * 0.8) ??
    null
  );
}

/** The main view's own background — the "no page color" look, and theme-aware. */
export function neutralTopBarColor(): string {
  const main = mainView();
  const bg = main ? getComputedStyle(main).backgroundColor : '';
  return bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : '#121212';
}

/**
 * Paint the top bar `color` ('neutral' = main view background) while our page is shown,
 * re-applying if Spotify rewrites it. Returns a cleanup that stops watching (the next native
 * page sets its own color).
 */
export function setTopBarColor(color: string | 'neutral'): Result<() => void> {
  const el = colorLayer();
  if (!el) return { ok: false, error: { code: 'unavailable', message: 'top bar color layer not found' } };
  const value = color === 'neutral' ? neutralTopBarColor() : color;
  el.style.setProperty(BG_VAR, value);
  const applied = el.style.getPropertyValue(BG_VAR);
  const observer = new MutationObserver(() => {
    if (el.style.getPropertyValue(BG_VAR) !== applied) el.style.setProperty(BG_VAR, value);
  });
  observer.observe(el, { attributes: true, attributeFilter: ['style'] });
  log.debug('top bar color →', value);
  return { ok: true, value: () => observer.disconnect() };
}

/** Diagnostics: the topbar subtree, marking the layer we paint. */
export function describeTopBar(): unknown {
  const bar = document.querySelector<HTMLElement>('[data-testid="topbar"]');
  if (!bar) return { found: false, mainViewBackground: neutralTopBarColor() };
  const layer = colorLayer();
  return {
    found: true,
    mainViewBackground: neutralTopBarColor(),
    elements: [bar, ...bar.querySelectorAll<HTMLElement>('*')].slice(0, 12).map((el) => {
      const cs = getComputedStyle(el);
      return {
        isColorLayer: el === layer,
        tag: el.tagName.toLowerCase(),
        className: typeof el.className === 'string' ? el.className : '',
        background: cs.backgroundColor,
        opacity: cs.opacity,
        inlineStyle: el.getAttribute('style') ?? undefined,
      };
    }),
  };
}
