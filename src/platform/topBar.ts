// Spotify's sticky top bar over the main view. Native pages set its color (album pages use the
// cover color) and it fades in on scroll; custom apps inherit whatever the last page left — the
// "purple bar" seen 2026-10-20 on 1.3.5. We find it structurally rather than by hashed class name.
// UNVERIFIED (1.3.5): which element it is — Diagnostics → "Top bar" lists the candidates.

import { log } from '../lib/log';
import type { Result } from './index';

export interface TopBarCandidate {
  el: HTMLElement;
  score: number;
}

function mainView(): HTMLElement | null {
  return document.getElementById('main-view') ?? document.querySelector<HTMLElement>('.main-view-container');
}

/** Full-width, absolutely positioned elements pinned to the top of the main view, best first. */
export function findTopBarCandidates(): TopBarCandidate[] {
  const main = mainView();
  if (!main) return [];
  const mr = main.getBoundingClientRect();
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_ELEMENT, {
    // Skip our own page — it can be thousands of nodes and is never the top bar.
    acceptNode: (n) => ((n as Element).classList.contains('crate-root') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const out: TopBarCandidate[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n as HTMLElement;
    const cs = getComputedStyle(el);
    if (!['absolute', 'fixed', 'sticky'].includes(cs.position)) continue;
    const r = el.getBoundingClientRect();
    if (Math.abs(r.top - mr.top) > 4 || r.width < mr.width * 0.8 || r.height < 24 || r.height > 200) continue;
    const cls = typeof el.className === 'string' ? el.className : '';
    let score = 0;
    if (/top-?bar/i.test(cls)) score += 3;
    if (/background/i.test(cls)) score += 2;
    if (el.style.backgroundColor) score += 2;
    if (cs.pointerEvents === 'none') score += 1;
    if (el.childElementCount === 0) score += 1; // a pure background layer, not the bar's buttons
    out.push({ el, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

export function describeTopBar(): unknown {
  return findTopBarCandidates().map(({ el, score }) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      score,
      tag: el.tagName.toLowerCase(),
      className: typeof el.className === 'string' ? el.className : '',
      testId: el.getAttribute('data-testid') ?? undefined,
      rect: { top: Math.round(r.top), height: Math.round(r.height), width: Math.round(r.width) },
      background: cs.backgroundColor,
      opacity: cs.opacity,
      pointerEvents: cs.pointerEvents,
      children: el.childElementCount,
      inlineStyle: el.getAttribute('style') ?? undefined,
    };
  });
}

/**
 * Paint the top bar `color` while our page is shown, re-applying if Spotify rewrites it.
 * Returns a cleanup that stops watching (the next native page sets its own color).
 */
export function setTopBarColor(color: string): Result<() => void> {
  const best = findTopBarCandidates()[0];
  if (!best) return { ok: false, error: { code: 'unavailable', message: 'top bar element not found' } };
  const { el } = best;
  el.style.backgroundColor = color;
  const applied = el.style.backgroundColor;
  const observer = new MutationObserver(() => {
    if (el.style.backgroundColor !== applied) el.style.backgroundColor = color;
  });
  observer.observe(el, { attributes: true, attributeFilter: ['style'] });
  log.debug('top bar color →', color, el.className);
  return { ok: true, value: () => observer.disconnect() };
}
