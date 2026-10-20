// Spotify's main view owns the page scrollbar (1.3.5: `.main-view-container__scroll-node`, seen in
// Diagnostics 2026-10-20). Custom-app pages never scroll themselves, so anything scroll-aware
// (virtualization, scroll restore) has to find that container. Found structurally — no class names.

/**
 * Nearest ancestor set up to scroll vertically. Deliberately ignores whether it currently overflows:
 * on first mount our virtual grid hasn't given it any height yet.
 */
export function findScrollParent(el: Element | null): HTMLElement | null {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    if (/(auto|scroll|overlay)/.test(getComputedStyle(node).overflowY)) return node;
  }
  return null;
}

/** Diagnostics: which element the virtual grid will measure against. */
export function describeScrollParent(el: Element | null): unknown {
  const s = findScrollParent(el);
  if (!s) return { found: false };
  return {
    found: true,
    tag: s.tagName.toLowerCase(),
    className: typeof s.className === 'string' ? s.className : '',
    overflowY: getComputedStyle(s).overflowY,
    clientHeight: s.clientHeight,
    scrollHeight: s.scrollHeight,
  };
}
