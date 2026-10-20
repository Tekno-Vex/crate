// Header tint from cover-art pixels. Pure (no DOM): the platform layer samples pixels, this picks
// the color. Used when Spicetify.colorExtractor can't handle local covers (spike S7).

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h / 6, s, l };
}

export function hslToRgb(h: number, s: number, l: number): Rgb {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue(p, q, h + 1 / 3) * 255),
    g: Math.round(hue(p, q, h) * 255),
    b: Math.round(hue(p, q, h - 1 / 3) * 255),
  };
}

export const toHex = ({ r, g, b }: Rgb): string =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

/**
 * Pick a header tint from RGBA pixels: bucket colors, favour common *and* saturated buckets,
 * ignore near-black/near-white, then darken into the range Spotify uses behind white text.
 */
export function pickHeaderColor(rgba: ArrayLike<number>): string | undefined {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number; s: number }>();
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3]! < 128) continue;
    const r = rgba[i]!;
    const g = rgba[i + 1]!;
    const b = rgba[i + 2]!;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0, s: 0 };
    e.n++;
    e.r += r;
    e.g += g;
    e.b += b;
    buckets.set(key, e);
  }
  if (buckets.size === 0) return undefined;

  let best: { score: number; rgb: Rgb } | undefined;
  let fallback: { n: number; rgb: Rgb } | undefined;
  for (const e of buckets.values()) {
    const rgb = { r: Math.round(e.r / e.n), g: Math.round(e.g / e.n), b: Math.round(e.b / e.n) };
    if (!fallback || e.n > fallback.n) fallback = { n: e.n, rgb };
    const { s, l } = rgbToHsl(rgb);
    if (l < 0.08 || l > 0.92) continue;
    const score = e.n * (0.15 + s);
    if (!best || score > best.score) best = { score, rgb };
  }

  const { h, s, l } = rgbToHsl((best ?? fallback)!.rgb);
  return toHex(hslToRgb(h, Math.min(s, 0.7), Math.min(Math.max(l, 0.22), 0.4)));
}
