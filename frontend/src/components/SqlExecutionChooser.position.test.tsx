import { describe, expect, it } from 'vitest';

import { positionSqlExecutionChooserHost } from './SqlExecutionChooser';

const createBox = (width: number, height: number, rect: {
  top: number;
  left: number;
  width: number;
  height: number;
}) => {
  const node = {
    style: {} as Record<string, string>,
    offsetWidth: width,
    offsetHeight: height,
    scrollWidth: width,
    scrollHeight: height,
    getBoundingClientRect: () => ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }),
  };
  return node;
};

describe('positionSqlExecutionChooserHost', () => {
  it('anchors to the right side near the cursor line', () => {
    const hostNode = createBox(400, 200, { top: 0, left: 0, width: 400, height: 200 });
    const overlayRoot = createBox(1000, 800, { top: 0, left: 0, width: 1000, height: 800 });
    const editorDom = createBox(800, 600, { top: 100, left: 100, width: 800, height: 600 });

    const editor = {
      getPosition: () => ({ lineNumber: 3, column: 10 }),
      getDomNode: () => editorDom,
      getScrolledVisiblePosition: () => ({ top: 40, left: 120, height: 20 }),
      getOption: () => 20,
    };

    expect(positionSqlExecutionChooserHost(editor, hostNode as any, overlayRoot as any, {
      editor: { EditorOption: { lineHeight: 1 } },
    })).toBe(true);

    expect(hostNode.style.top).toBe('166px');
    expect(hostNode.style.left).toBe('592px');
  });

  it('clamps inside the overlay when there is not enough space below or above', () => {
    const hostNode = createBox(300, 250, { top: 0, left: 0, width: 300, height: 250 });
    const overlayRoot = createBox(600, 300, { top: 0, left: 0, width: 600, height: 300 });
    const editorDom = createBox(600, 300, { top: 0, left: 0, width: 600, height: 300 });

    const editor = {
      getPosition: () => ({ lineNumber: 10, column: 1 }),
      getDomNode: () => editorDom,
      getScrolledVisiblePosition: () => ({ top: 220, left: 300, height: 20 }),
      getOption: () => 20,
    };

    expect(positionSqlExecutionChooserHost(editor, hostNode as any, overlayRoot as any)).toBe(true);
    expect(hostNode.style.top).toBe('42px');
    expect(hostNode.style.left).toBe('292px');
  });
});
