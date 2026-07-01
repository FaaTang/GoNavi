import { describe, expect, it } from 'vitest';

import type { SavedQuery, TabData } from '../types';

import {
  hasPersistedQueryTabUnsavedChanges,
  hasQueryTabUnsavedChanges,
  isClosableQueryTab,
  resolveQueryTabDirtyKind,
  resolveQueryTabSavedQueryId,
} from './queryTabDirty';

const savedQueries: SavedQuery[] = [
  {
    id: 'saved-1',
    name: 'Users',
    sql: 'select * from users;',
    connectionId: 'conn-1',
    dbName: 'main',
    createdAt: 1,
  },
];

describe('queryTabDirty', () => {
  it('treats read-only and non-query tabs as not closable query tabs', () => {
    expect(isClosableQueryTab({ id: '1', type: 'table', title: 't', connectionId: 'c' } as TabData)).toBe(false);
    expect(isClosableQueryTab({ id: '1', type: 'query', title: 't', connectionId: 'c', readOnly: true } as TabData)).toBe(false);
    expect(isClosableQueryTab({ id: '1', type: 'query', title: 't', connectionId: 'c' } as TabData)).toBe(true);
  });

  it('resolves saved query ids from savedQueryId or legacy tab id', () => {
    expect(resolveQueryTabSavedQueryId({ id: 'tab-1', savedQueryId: 'saved-1' }, savedQueries)).toBe('saved-1');
    expect(resolveQueryTabSavedQueryId({ id: 'saved-1' }, savedQueries)).toBe('saved-1');
    expect(resolveQueryTabSavedQueryId({ id: 'tab-new' }, savedQueries)).toBe('');
  });

  it('detects dirty saved query tabs against saved query sql', () => {
    const tab = { id: 'tab-1', type: 'query', title: 'Users', connectionId: 'conn-1', savedQueryId: 'saved-1' } as TabData;

    expect(hasPersistedQueryTabUnsavedChanges(tab, 'select * from users;', savedQueries)).toBe(false);
    expect(hasPersistedQueryTabUnsavedChanges(tab, 'select * from users where id = 1;', savedQueries)).toBe(true);
    expect(resolveQueryTabDirtyKind(tab, savedQueries)).toBe('saved-query');
  });

  it('treats unsaved new query tabs with content as dirty', () => {
    const tab = { id: 'tab-new', type: 'query', title: 'New Query', connectionId: 'conn-1' } as TabData;

    expect(hasPersistedQueryTabUnsavedChanges(tab, '', savedQueries)).toBe(false);
    expect(hasPersistedQueryTabUnsavedChanges(tab, 'select 1;', savedQueries)).toBe(true);
    expect(resolveQueryTabDirtyKind(tab, savedQueries)).toBe('unsaved-query');
  });

  it('delegates sql file tabs to disk comparison', () => {
    const tab = { id: 'tab-file', type: 'query', title: 'a.sql', connectionId: 'conn-1', filePath: '/tmp/a.sql' } as TabData;

    expect(hasQueryTabUnsavedChanges(tab, 'select 1;', savedQueries, 'select 1;')).toBe(false);
    expect(hasQueryTabUnsavedChanges(tab, 'select 2;', savedQueries, 'select 1;')).toBe(true);
    expect(resolveQueryTabDirtyKind(tab, savedQueries)).toBe('sql-file');
  });
});
