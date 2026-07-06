import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearQueryTabDraft,
  clearSQLFileTabDraft,
  FLUSH_QUERY_TAB_DRAFTS_EVENT,
  flushQueryTabDrafts,
  getQueryTabDraft,
  getSQLFileTabDraft,
  hasQueryTabDraft,
  hasSQLFileTabDraft,
  setQueryTabDraft,
  setSQLFileTabDraft,
} from './sqlFileTabDrafts';

describe('sqlFileTabDrafts', () => {
  beforeEach(() => {
    const listeners = new Map<string, Array<(event: Event) => void>>();
    vi.stubGlobal('window', {
      addEventListener: (type: string, handler: (event: Event) => void) => {
        const bucket = listeners.get(type) || [];
        bucket.push(handler);
        listeners.set(type, bucket);
      },
      removeEventListener: (type: string, handler: (event: Event) => void) => {
        const bucket = listeners.get(type) || [];
        listeners.set(type, bucket.filter((item) => item !== handler));
      },
      dispatchEvent: (event: Event) => {
        for (const handler of listeners.get(event.type) || []) {
          handler(event);
        }
        return true;
      },
    });
  });

  it('stores query editor drafts outside the persisted tab state', () => {
    clearQueryTabDraft('query-tab-1');

    expect(hasQueryTabDraft('query-tab-1')).toBe(false);
    expect(getQueryTabDraft('query-tab-1', 'fallback')).toBe('fallback');

    setQueryTabDraft('query-tab-1', 'select * from large_table;');

    expect(hasQueryTabDraft('query-tab-1')).toBe(true);
    expect(getQueryTabDraft('query-tab-1', 'fallback')).toBe('select * from large_table;');

    clearQueryTabDraft('query-tab-1');

    expect(hasQueryTabDraft('query-tab-1')).toBe(false);
  });

  it('stores external SQL file editor drafts outside the persisted tab state', () => {
    clearSQLFileTabDraft('tab-1');

    expect(hasSQLFileTabDraft('tab-1')).toBe(false);
    expect(getSQLFileTabDraft('tab-1', 'fallback')).toBe('fallback');

    setSQLFileTabDraft('tab-1', 'select 1;');

    expect(hasSQLFileTabDraft('tab-1')).toBe(true);
    expect(getSQLFileTabDraft('tab-1', 'fallback')).toBe('select 1;');

    clearSQLFileTabDraft('tab-1');

    expect(hasSQLFileTabDraft('tab-1')).toBe(false);
  });

  it('dispatches a flush event for the requested tab ids', () => {
    const seen: string[][] = [];
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ tabIds?: string[] }>).detail;
      seen.push(detail?.tabIds || []);
    };

    window.addEventListener(FLUSH_QUERY_TAB_DRAFTS_EVENT, handler);
    try {
      flushQueryTabDrafts([' tab-a ', 'tab-b', 'tab-a', '']);
      expect(seen).toEqual([['tab-a', 'tab-b']]);
    } finally {
      window.removeEventListener(FLUSH_QUERY_TAB_DRAFTS_EVENT, handler);
    }
  });
});
