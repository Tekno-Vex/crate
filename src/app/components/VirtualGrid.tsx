import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { gridMetrics, visibleRows, type GridOptions } from '../../domain/virtualGrid';
import { readUi, writeUi } from '../../lib/uiState';
import { findScrollParent } from '../../platform';

// Card geometry — must match .crate-card in app.css (padding 12×2 + gaps 6×2 + title 24 + sub 20).
export const CARD_GRID: GridOptions = { minColumnWidth: 180, gap: 24, extraHeight: 56 };

interface Layout {
  width: number;
  scrollTop: number;
  viewportHeight: number;
  gridTop: number;
}

interface VirtualGridProps<T> {
  items: readonly T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  /** UI-state key; scroll position is restored when the grid remounts with the same key. */
  scrollKey: string;
  /** When this value changes after mount (e.g. new search), scroll back to the top. */
  resetScrollOn?: unknown;
  options?: GridOptions;
}

/**
 * Grid that renders only rows near the viewport. Spotify's main view owns the scrollbar, so we
 * measure against that container. Without layout (no scroll parent / zero width, e.g. jsdom) it
 * renders every item, unvirtualized.
 */
export function VirtualGrid<T>({ items, getKey, renderItem, scrollKey, resetScrollOn, options = CARD_GRID }: VirtualGridProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const [mode, setMode] = useState<'pending' | 'static' | 'virtual'>('pending');
  const [layout, setLayout] = useState<Layout>({ width: 0, scrollTop: 0, viewportHeight: 0, gridTop: 0 });
  const savedScroll = useRef(readUi<number>(`${scrollKey}.scroll`, 0));
  const restored = useRef(false);

  // Measure + subscribe to scroll/resize. Runs before paint, so 'pending' never shows.
  useLayoutEffect(() => {
    const el = ref.current;
    const scroller = findScrollParent(el);
    scrollerRef.current = scroller;
    if (!el || !scroller || !el.clientWidth) {
      setMode('static');
      return;
    }
    let frame = 0;
    const measure = () => {
      frame = 0;
      const gridTop = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      const next = { width: el.clientWidth, scrollTop: scroller.scrollTop, viewportHeight: scroller.clientHeight, gridTop };
      setLayout((prev) =>
        prev.width === next.width &&
        prev.scrollTop === next.scrollTop &&
        prev.viewportHeight === next.viewportHeight &&
        prev.gridTop === next.gridTop
          ? prev
          : next,
      );
      if (restored.current) savedScroll.current = scroller.scrollTop;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    setMode('virtual');
    scroller.addEventListener('scroll', schedule, { passive: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    ro.observe(scroller);
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', schedule);
      ro.disconnect();
      writeUi(`${scrollKey}.scroll`, savedScroll.current);
    };
  }, [scrollKey]);

  // Restore scroll once the virtual grid has its full height.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (mode !== 'virtual' || restored.current || !scroller) return;
    restored.current = true;
    if (savedScroll.current) scroller.scrollTop = savedScroll.current;
  }, [mode]);

  // New search/sort → back to the top of the grid.
  const firstReset = useRef(true);
  useEffect(() => {
    if (firstReset.current) {
      firstReset.current = false;
      return;
    }
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollTop = 0;
    savedScroll.current = 0;
  }, [resetScrollOn]);

  if (mode !== 'virtual') {
    return (
      <div ref={ref} className="crate-grid">
        {mode === 'static' && items.map((item) => <div key={getKey(item)}>{renderItem(item)}</div>)}
      </div>
    );
  }

  const metrics = gridMetrics(layout.width, options);
  const win = visibleRows({ itemCount: items.length, metrics, gap: options.gap, ...layout });
  const rows: ReactNode[] = [];
  for (let r = win.start; r < win.end; r++) {
    const slice = items.slice(r * metrics.columns, (r + 1) * metrics.columns);
    rows.push(
      <div
        key={r}
        className="crate-vgrid__row"
        style={{
          top: r * metrics.stride,
          height: metrics.rowHeight,
          gridTemplateColumns: `repeat(${metrics.columns}, minmax(0, 1fr))`,
          gap: options.gap,
        }}
      >
        {slice.map((item) => (
          <div key={getKey(item)}>{renderItem(item)}</div>
        ))}
      </div>,
    );
  }
  return (
    <div ref={ref} className="crate-vgrid" style={{ height: win.totalHeight }}>
      {rows}
    </div>
  );
}
