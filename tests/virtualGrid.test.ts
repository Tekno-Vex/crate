import { describe, expect, it } from 'vitest';
import { gridMetrics, visibleRows } from '../src/domain/virtualGrid';

const opts = { minColumnWidth: 180, gap: 24, extraHeight: 56 };

describe('gridMetrics', () => {
  it('fits as many min-width columns as the width allows', () => {
    // 5 × 180 + 4 × 24 = 996 fits in 1000; 6 columns need 1200.
    const m = gridMetrics(1000, opts);
    expect(m.columns).toBe(5);
    expect(m.columnWidth).toBeCloseTo((1000 - 4 * 24) / 5);
    expect(m.rowHeight).toBe(Math.round(m.columnWidth + 56));
    expect(m.stride).toBe(m.rowHeight + 24);
  });
  it('never drops below one column', () => {
    expect(gridMetrics(100, opts).columns).toBe(1);
    expect(gridMetrics(0, opts).columns).toBe(1);
  });
});

describe('visibleRows', () => {
  const metrics = gridMetrics(1000, opts); // 5 columns
  const base = { metrics, gap: 24, viewportHeight: 800, gridTop: 200, overscan: 0 };

  it('renders only the rows inside the viewport', () => {
    const w = visibleRows({ ...base, itemCount: 20_000 / 4, scrollTop: 0 });
    expect(w.rowCount).toBe(1000);
    expect(w.start).toBe(0);
    // Viewport covers 600px of grid (800 - 200 above it).
    expect(w.end).toBe(Math.ceil(600 / metrics.stride));
    expect(w.totalHeight).toBe(1000 * metrics.stride - 24);
  });

  it('follows the scroll position, with overscan', () => {
    const scrollTop = 200 + 50 * metrics.stride; // row 50 at the top of the viewport
    const w = visibleRows({ ...base, overscan: 2, itemCount: 5000, scrollTop });
    expect(w.start).toBe(48);
    expect(w.end).toBe(Math.ceil((50 * metrics.stride + 800) / metrics.stride) + 2);
    expect(w.end - w.start).toBeLessThan(15);
  });

  it('clamps at the end of the list and handles empty lists', () => {
    const w = visibleRows({ ...base, itemCount: 12, scrollTop: 1e6 });
    expect(w.end).toBe(3);
    expect(w.start).toBeLessThanOrEqual(w.end);
    expect(visibleRows({ ...base, itemCount: 0, scrollTop: 0 })).toMatchObject({ rowCount: 0, start: 0, end: 0, totalHeight: 0 });
  });
});
