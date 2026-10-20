import { describe, expect, it } from 'vitest';
import { pickStartIndex } from '../src/domain/playback';

describe('pickStartIndex', () => {
  it('starts at track 1 when shuffle is off', () => {
    expect(pickStartIndex(10, false, () => 0.99)).toBe(0);
  });
  it('starts at a random track inside the album when shuffle is on', () => {
    expect(pickStartIndex(10, true, () => 0)).toBe(0);
    expect(pickStartIndex(10, true, () => 0.55)).toBe(5);
    expect(pickStartIndex(10, true, () => 0.999999)).toBe(9);
    expect(pickStartIndex(10, true, () => 1)).toBe(9); // defensive: rand() should be < 1
  });
  it('handles empty albums', () => {
    expect(pickStartIndex(0, true)).toBe(0);
  });
});
