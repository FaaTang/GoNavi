import { describe, expect, it } from 'vitest';

import {
  FIRST_OPEN_HEIGHT_RATIO,
  FIRST_OPEN_MIN_HEIGHT,
  FIRST_OPEN_MIN_WIDTH,
  FIRST_OPEN_WIDTH_RATIO,
  isCreatePlaceholderWindowBounds,
  resolveFirstOpenWindowBounds,
  resolveStartupNormalWindowBounds,
} from './windowInitialSize';

describe('resolveFirstOpenWindowBounds', () => {
  it('sizes to about 85% of a 1920x1080 work area and centers', () => {
    expect(resolveFirstOpenWindowBounds({
      availWidth: 1920,
      availHeight: 1040,
      availLeft: 0,
      availTop: 0,
    })).toEqual({
      width: Math.trunc(1920 * FIRST_OPEN_WIDTH_RATIO),
      height: Math.trunc(1040 * FIRST_OPEN_HEIGHT_RATIO),
      x: Math.trunc((1920 - Math.trunc(1920 * FIRST_OPEN_WIDTH_RATIO)) / 2),
      y: Math.trunc((1040 - Math.trunc(1040 * FIRST_OPEN_HEIGHT_RATIO)) / 2),
    });
  });

  it('clamps to minimums on small screens', () => {
    expect(resolveFirstOpenWindowBounds({
      availWidth: 1000,
      availHeight: 600,
      availLeft: 0,
      availTop: 0,
    })).toEqual({
      width: FIRST_OPEN_MIN_WIDTH,
      height: FIRST_OPEN_MIN_HEIGHT,
      x: Math.trunc((1000 - FIRST_OPEN_MIN_WIDTH) / 2),
      y: Math.trunc((600 - FIRST_OPEN_MIN_HEIGHT) / 2),
    });
  });

  it('never exceeds the work area', () => {
    expect(resolveFirstOpenWindowBounds({
      availWidth: 800,
      availHeight: 500,
      availLeft: 10,
      availTop: 20,
    })).toEqual({
      width: 800,
      height: 500,
      x: 10,
      y: 20,
    });
  });
});

describe('resolveStartupNormalWindowBounds', () => {
  const viewport = {
    availWidth: 1920,
    availHeight: 1040,
    availLeft: 0,
    availTop: 0,
  };

  it('treats StartHidden create size as placeholder and upgrades to first-open', () => {
    expect(isCreatePlaceholderWindowBounds(
      { width: FIRST_OPEN_MIN_WIDTH, height: FIRST_OPEN_MIN_HEIGHT },
      viewport,
    )).toBe(true);
    expect(resolveStartupNormalWindowBounds(
      { width: 900, height: 560, x: 10, y: 10 },
      viewport,
    )).toEqual(resolveFirstOpenWindowBounds(viewport));
  });

  it('keeps a real user-resized window', () => {
    const saved = { width: 1400, height: 860, x: 120, y: 80 };
    expect(isCreatePlaceholderWindowBounds(saved, viewport)).toBe(false);
    expect(resolveStartupNormalWindowBounds(saved, viewport)).toEqual(saved);
  });
});
