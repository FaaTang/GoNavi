import type { SavedQuery, TabData } from '../types';

import {
  getSQLFileTabPath,
  hasSQLFileTabUnsavedChanges,
  isSQLFileQueryTab,
} from './sqlFileTabDirty';

export type QueryTabDirtyKind = 'sql-file' | 'saved-query' | 'unsaved-query';

export const isClosableQueryTab = (tab: TabData | null | undefined): tab is TabData =>
  Boolean(tab && tab.type === 'query' && !tab.readOnly);

export const resolveQueryTabSavedQueryId = (
  tab: Pick<TabData, 'id' | 'savedQueryId'>,
  savedQueries: SavedQuery[],
): string => {
  const savedQueryId = String(tab.savedQueryId || '').trim();
  if (savedQueryId) {
    return savedQueryId;
  }
  const tabId = String(tab.id || '').trim();
  if (tabId && savedQueries.some((item) => item.id === tabId)) {
    return tabId;
  }
  return '';
};

export const resolveQueryTabSavedBaseline = (
  tab: Pick<TabData, 'id' | 'savedQueryId' | 'type' | 'filePath' | 'readOnly'>,
  savedQueries: SavedQuery[],
): string | null => {
  if (!isClosableQueryTab(tab as TabData)) {
    return null;
  }
  if (isSQLFileQueryTab(tab)) {
    return null;
  }
  const savedQueryId = resolveQueryTabSavedQueryId(tab, savedQueries);
  if (savedQueryId) {
    return savedQueries.find((item) => item.id === savedQueryId)?.sql ?? '';
  }
  return null;
};

export const resolveQueryTabDirtyKind = (
  tab: TabData,
  savedQueries: SavedQuery[],
): QueryTabDirtyKind | null => {
  if (!isClosableQueryTab(tab)) {
    return null;
  }
  if (isSQLFileQueryTab(tab)) {
    return 'sql-file';
  }
  if (resolveQueryTabSavedQueryId(tab, savedQueries)) {
    return 'saved-query';
  }
  return 'unsaved-query';
};

export const hasPersistedQueryTabUnsavedChanges = (
  tab: TabData,
  draft: string,
  savedQueries: SavedQuery[],
): boolean => {
  if (!isClosableQueryTab(tab)) {
    return false;
  }
  if (isSQLFileQueryTab(tab)) {
    return false;
  }
  const baseline = resolveQueryTabSavedBaseline(tab, savedQueries);
  if (baseline !== null) {
    return String(draft ?? '') !== baseline;
  }
  return String(draft ?? '').trim().length > 0;
};

export const hasQueryTabUnsavedChanges = (
  tab: TabData,
  draft: string,
  savedQueries: SavedQuery[],
  diskContent?: string,
): boolean => {
  if (!isClosableQueryTab(tab)) {
    return false;
  }
  if (isSQLFileQueryTab(tab)) {
    if (typeof diskContent !== 'string') {
      return false;
    }
    return hasSQLFileTabUnsavedChanges({ ...tab, query: draft }, diskContent);
  }
  return hasPersistedQueryTabUnsavedChanges(tab, draft, savedQueries);
};

export const getQueryTabCloseLabel = (
  tab: TabData,
  savedQueries: SavedQuery[],
): string => {
  const filePath = getSQLFileTabPath(tab);
  if (filePath) {
    return tab.title || filePath;
  }
  const savedQueryId = resolveQueryTabSavedQueryId(tab, savedQueries);
  if (savedQueryId) {
    const savedQuery = savedQueries.find((item) => item.id === savedQueryId);
    return tab.title || savedQuery?.name || savedQueryId;
  }
  return tab.title || tab.id;
};
