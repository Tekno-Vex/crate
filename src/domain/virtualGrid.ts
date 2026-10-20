// Geometry for the virtualized album grid. Pure, so it is unit-tested; the component only measures
// the DOM and feeds numbers in.

export interface GridOptions {
  minColumnWidth: number;
  gap: number;
  /** Height a card adds on top of its column width (padding + title + subtitle lines). */
  extraHeight: number;
}

export interface GridMetrics {
  columns: number;
  columnWidth: number;
  rowHeight: number;
  /** Distance from one row's top to the next row's top. */
  stride: number;
}

export function gridMetrics(width: number, o: GridOptions): GridMetrics {
  const columns = Math.max(1, Math.floor((width + o.gap) / (o.minColumnWidth + o.gap)));
  const columnWidth = Math.max(0, (width - o.gap * (columns - 1)) / columns);
  const rowHeight = Math.round(columnWidth + o.extraHeight);
  return { columns, columnWidth, rowHeight, stride: rowHeight + o.gap };
}

export interface RowWindow {
  rowCount: number;
  /** First row to render (inclusive). */
  start: number;
  /** Last row to render (exclusive). */
  end: number;
  totalHeight: number;
}

export function visibleRows(p: {
  itemCount: number;
  metrics: GridMetrics;
  gap: number;
  /** Scroll container's scrollTop. */
  scrollTop: number;
  /** Scroll container's visible height. */
  viewportHeight: number;
  /** Offset of the grid's top within the scroll container's content. */
  gridTop: number;
  overscan?: number;
}): RowWindow {
  const { metrics, overscan = 2 } = p;
  const rowCount = Math.ceil(p.itemCount / metrics.columns);
  const totalHeight = rowCount ? rowCount * metrics.stride - p.gap : 0;
  const top = p.scrollTop - p.gridTop;
  const start = Math.max(0, Math.floor(top / metrics.stride) - overscan);
  const end = Math.min(rowCount, Math.ceil((top + p.viewportHeight) / metrics.stride) + overscan);
  return { rowCount, start: Math.min(start, end), end, totalHeight };
}
