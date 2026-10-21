import { describe, expect, it } from 'vitest';
import { compareVersions, menuItemsSafe } from '../src/domain/compat';

describe('compareVersions', () => {
  it('compares numerically, part by part', () => {
    expect(compareVersions('1.3.10', '1.3.9')).toBeGreaterThan(0);
    expect(compareVersions('2.45.3', '2.46.0')).toBeLessThan(0);
    expect(compareVersions('1.3.5.3058', '1.3.5')).toBeGreaterThan(0);
    expect(compareVersions('1.3', '1.3.0')).toBe(0);
  });
});

describe('menuItemsSafe', () => {
  it('is off for an old Spicetify on a newer Spotify (the broken-menus combination)', () => {
    expect(menuItemsSafe('2.45.3', '1.3.5.3058')).toBe(false);
  });
  it('is on once Spicetify supports the Spotify version', () => {
    expect(menuItemsSafe('2.46.2', '1.3.5.3058')).toBe(true);
    expect(menuItemsSafe('2.45.3', '1.3.1.100')).toBe(true);
  });
  it('assumes safe when versions are unknown', () => {
    expect(menuItemsSafe(undefined, '1.3.5')).toBe(true);
  });
});
