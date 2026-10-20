import { describe, expect, it } from 'vitest';
import { hslToRgb, pickHeaderColor, rgbToHsl, toHex } from '../src/domain/color';

/** RGBA buffer from [color, pixelCount] pairs. */
function pixels(...parts: [[number, number, number], number][]): Uint8ClampedArray {
  const out: number[] = [];
  for (const [[r, g, b], n] of parts) for (let i = 0; i < n; i++) out.push(r, g, b, 255);
  return new Uint8ClampedArray(out);
}

const hexToRgb = (hex: string) => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});

describe('pickHeaderColor', () => {
  it('returns undefined for no opaque pixels', () => {
    expect(pickHeaderColor(new Uint8ClampedArray([0, 0, 0, 0]))).toBeUndefined();
  });

  it('keeps the hue of a dominant color and darkens it for white text', () => {
    const { h, l } = rgbToHsl(hexToRgb(pickHeaderColor(pixels([[230, 120, 40], 100]))!));
    expect(h).toBeCloseTo(rgbToHsl({ r: 230, g: 120, b: 40 }).h, 1);
    expect(l).toBeLessThanOrEqual(0.41);
  });

  it('prefers a saturated accent over a larger near-black area (sunset-on-trees covers)', () => {
    const { h, s } = rgbToHsl(hexToRgb(pickHeaderColor(pixels([[5, 5, 5], 700], [[200, 90, 30], 300]))!));
    expect(s).toBeGreaterThan(0.3);
    expect(h).toBeCloseTo(rgbToHsl({ r: 200, g: 90, b: 30 }).h, 1);
  });

  it('falls back to the most common color when everything is near-black', () => {
    expect(pickHeaderColor(pixels([[3, 3, 3], 10]))).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('color conversions', () => {
  it('round-trips through HSL', () => {
    const rgb = { r: 12, g: 200, b: 99 };
    const { h, s, l } = rgbToHsl(rgb);
    expect(hslToRgb(h, s, l)).toEqual(rgb);
    expect(toHex(rgb)).toBe('#0cc863');
  });
});
