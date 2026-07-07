import { describe, expect, it } from 'vitest';

import { resolveSidebarResizeDelta, SIDEBAR_RESIZE_DRAG_SCALE } from './useAppSidebarResize';

describe('useAppSidebarResize', () => {
  it('doubles sidebar drag distance', () => {
    expect(SIDEBAR_RESIZE_DRAG_SCALE).toBe(2);
    expect(resolveSidebarResizeDelta(150, 100)).toBe(100);
    expect(resolveSidebarResizeDelta(80, 100)).toBe(-40);
  });
});
