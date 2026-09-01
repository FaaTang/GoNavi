import { describe, expect, it } from 'vitest';
import {
  isSidebarTreeDoubleClickGesture,
  resolveSidebarTreeRangeKeys,
  resolveSidebarTreeSelectState,
  shouldToggleSidebarTreeNodeOnDoubleClick,
} from './sidebarHelpers';

describe('sidebar tree select state', () => {
  it('keeps selection when clicking the same selected node again', () => {
    const node = { key: 'conn-1', type: 'connection', title: 'dev' };
    expect(resolveSidebarTreeSelectState({
      keys: [],
      node,
      selectedNodes: [],
      previousKeys: ['conn-1'],
      anchorKey: 'conn-1',
    })).toEqual({
      keys: ['conn-1'],
      nodes: [node],
      nextAnchorKey: 'conn-1',
    });
  });

  it('keeps single selection on plain click', () => {
    const node = { key: 'conn-2', type: 'connection', title: 'test' };
    expect(resolveSidebarTreeSelectState({
      keys: ['conn-1', 'conn-2'],
      node,
      selectedNodes: [node],
      previousKeys: ['conn-1'],
      anchorKey: 'conn-1',
    })).toEqual({
      keys: ['conn-2'],
      nodes: [node],
      nextAnchorKey: 'conn-2',
    });
  });

  it('uses antd keys for ctrl/meta multi-select and updates the anchor', () => {
    const node = { key: 'db-2', type: 'database', title: 'b' };
    expect(resolveSidebarTreeSelectState({
      keys: ['db-1', 'db-2'],
      node,
      selectedNodes: [
        { key: 'db-1', type: 'database', title: 'a' },
        node,
      ],
      nativeEvent: { ctrlKey: true, metaKey: false, shiftKey: false },
      previousKeys: ['db-1'],
      anchorKey: 'db-1',
    })).toEqual({
      keys: ['db-1', 'db-2'],
      nodes: [
        { key: 'db-1', type: 'database', title: 'a' },
        node,
      ],
      nextAnchorKey: 'db-2',
    });
  });

  it('selects a contiguous range with shift click', () => {
    const node = { key: 'c', type: 'table', title: 'c' };
    const orderedKeys = ['a', 'b', 'c', 'd'];
    const result = resolveSidebarTreeSelectState({
      keys: ['c'],
      node,
      selectedNodes: [node],
      nativeEvent: { ctrlKey: false, metaKey: false, shiftKey: true },
      previousKeys: ['a'],
      orderedKeys,
      anchorKey: 'a',
      resolveNodeByKey: (key) => ({ key: String(key), type: 'table', title: String(key) }),
    });
    expect(result.keys).toEqual(['a', 'b', 'c']);
    expect(result.nodes.map((item) => String(item.key))).toEqual(['a', 'b', 'c']);
    expect(result.nextAnchorKey).toBe('a');
  });

  it('resolves range keys inclusive of both ends', () => {
    expect(resolveSidebarTreeRangeKeys(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['b', 'c', 'd']);
    expect(resolveSidebarTreeRangeKeys(['a', 'b', 'c'], 'x', 'c')).toEqual(['c']);
  });

  it('detects double-click by consecutive clicks on the same tree key', () => {
    expect(isSidebarTreeDoubleClickGesture({
      previousKey: 'conn-1',
      previousAt: 1000,
      currentKey: 'conn-1',
      currentAt: 1250,
    })).toBe(true);
    expect(isSidebarTreeDoubleClickGesture({
      previousKey: 'conn-1',
      previousAt: 1000,
      currentKey: 'conn-2',
      currentAt: 1100,
    })).toBe(false);
    expect(isSidebarTreeDoubleClickGesture({
      previousKey: 'conn-1',
      previousAt: 1000,
      currentKey: 'conn-1',
      currentAt: 1600,
    })).toBe(false);
  });

  it('only toggles expand on double-click for folder-like sidebar nodes', () => {
    expect(shouldToggleSidebarTreeNodeOnDoubleClick({ type: 'connection', isLeaf: false })).toBe(true);
    expect(shouldToggleSidebarTreeNodeOnDoubleClick({ type: 'database', isLeaf: false })).toBe(true);
    expect(shouldToggleSidebarTreeNodeOnDoubleClick({ type: 'object-group', isLeaf: false })).toBe(true);
    expect(shouldToggleSidebarTreeNodeOnDoubleClick({ type: 'table', isLeaf: false })).toBe(false);
    expect(shouldToggleSidebarTreeNodeOnDoubleClick({ type: 'connection', isLeaf: true })).toBe(false);
  });
});
