import React from 'react';
import { Button, Input, message } from 'antd';

import Modal from '../components/common/ResizableDraggableModal';
import { useStore } from '../store';
import type { SavedQuery, TabData } from '../types';
import { t } from '../i18n';
import { ReadSQLFile, WriteSQLFile } from '../../wailsjs/go/app/App';
import {
  getSQLFileTabPath,
  isSQLFileMissingErrorMessage,
  isSQLFileMissingReadResult,
  normalizeSQLFileReadContent,
} from './sqlFileTabDirty';
import { clearQueryTabDraft, flushQueryTabDrafts, getQueryTabDraft } from './sqlFileTabDrafts';
import { isLocalizedUntitledQueryTitle } from './queryTabTitle';
import {
  getQueryTabCloseLabel,
  hasQueryTabUnsavedChanges,
  isClosableQueryTab,
  resolveQueryTabSavedQueryId,
} from './queryTabDirty';

export type DirtyQueryTabEntry = {
  tab: TabData;
  draft: string;
};

export type QueryTabCloseChoice = 'yes' | 'no' | 'yes-all' | 'no-all' | 'cancel';

export type QueryTabClosePromptResult = 'completed' | 'cancelled' | 'failed';

const promptQuerySaveName = (suggestedName: string): Promise<string | null> => (
  new Promise((resolve) => {
    let nextName = suggestedName;
    Modal.confirm({
      title: t('tab_manager.query_close.name_required_title'),
      content: (
        <Input
          autoFocus
          defaultValue={suggestedName}
          placeholder={t('query_editor.save_modal.name')}
          onChange={(event) => {
            nextName = event.target.value;
          }}
        />
      ),
      okText: t('common.save'),
      cancelText: t('common.cancel'),
      onOk: () => {
        const trimmed = String(nextName || '').trim();
        if (!trimmed) {
          void message.warning(t('tab_manager.query_close.name_empty'));
          return Promise.reject(new Error('empty-query-name'));
        }
        resolve(trimmed);
        return Promise.resolve();
      },
      onCancel: () => resolve(null),
    });
  })
);

export const saveDirtyQueryTab = async (
  entry: DirtyQueryTabEntry,
  savedQueries: SavedQuery[],
  saveQueryFn: (query: SavedQuery) => Promise<SavedQuery>,
): Promise<void> => {
  const { tab, draft } = entry;
  const filePath = getSQLFileTabPath(tab);
  if (filePath) {
    const res = await WriteSQLFile(filePath, draft);
    if (!res.success) {
      throw new Error(t('tab_manager.query_close.save_failed', {
        title: getQueryTabCloseLabel(tab, savedQueries),
        detail: res.message || t('tab_manager.sql_file_close.unknown_error'),
      }));
    }
    return;
  }

  const savedQueryId = resolveQueryTabSavedQueryId(tab, savedQueries);
  const existing = savedQueryId
    ? savedQueries.find((item) => item.id === savedQueryId) || null
    : null;
  if (existing) {
    await saveQueryFn({
      ...existing,
      sql: draft,
      connectionId: tab.connectionId || existing.connectionId,
      dbName: tab.dbName || existing.dbName || '',
    });
    return;
  }

  let name = isLocalizedUntitledQueryTitle(tab.title) ? '' : String(tab.title || '').trim();
  if (!name) {
    const promptedName = await promptQuerySaveName('');
    if (!promptedName) {
      throw new Error('cancelled-query-save');
    }
    name = promptedName;
  }

  await saveQueryFn({
    id: String(tab.id || '').trim() || `query-${Date.now()}`,
    name,
    sql: draft,
    connectionId: tab.connectionId,
    dbName: tab.dbName || '',
    createdAt: Date.now(),
  });
};

const promptDirtyQueryTabChoice = (
  label: string,
  remainingCount: number,
): Promise<QueryTabCloseChoice> => (
  new Promise((resolve) => {
    let settled = false;
    let destroyModal: (() => void) | null = null;

    const finish = (choice: QueryTabCloseChoice) => {
      if (settled) return;
      settled = true;
      destroyModal?.();
      resolve(choice);
    };

    const content = remainingCount > 1
      ? React.createElement(
        React.Fragment,
        null,
        React.createElement('div', null, t('tab_manager.query_close.save_confirm_content', { label })),
        React.createElement(
          'div',
          { style: { marginTop: 8, color: 'var(--gn-text-secondary, rgba(0, 0, 0, 0.45))' } },
          t('tab_manager.query_close.remaining_hint', { count: remainingCount - 1 }),
        ),
      )
      : t('tab_manager.query_close.save_confirm_content', { label });

    const modal = Modal.confirm({
      title: t('tab_manager.query_close.save_confirm_title'),
      content,
      closable: true,
      maskClosable: true,
      footer: () => (
        <>
          <Button onClick={() => finish('yes')}>
            {t('tab_manager.query_close.action.yes')}
          </Button>
          <Button onClick={() => finish('no')}>
            {t('tab_manager.query_close.action.no')}
          </Button>
          <Button onClick={() => finish('yes-all')}>
            {t('tab_manager.query_close.action.yes_to_all')}
          </Button>
          <Button onClick={() => finish('no-all')}>
            {t('tab_manager.query_close.action.no_to_all')}
          </Button>
        </>
      ),
      onCancel: () => finish('cancel'),
    });
    destroyModal = modal.destroy;
  })
);

const resolveDirtyTabsBeforeClose = async (
  dirtyTabs: DirtyQueryTabEntry[],
  savedQueries: SavedQuery[],
  saveQueryFn: (query: SavedQuery) => Promise<SavedQuery>,
): Promise<'resolved' | 'cancelled'> => {
  let index = 0;
  let savedCount = 0;
  while (index < dirtyTabs.length) {
    const entry = dirtyTabs[index];
    const remainingCount = dirtyTabs.length - index;
    const label = t('tab_manager.query_close.dirty_single_label', {
      title: getQueryTabCloseLabel(entry.tab, savedQueries),
    });
    const choice = await promptDirtyQueryTabChoice(label, remainingCount);
    if (choice === 'cancel') {
      return 'cancelled';
    }
    if (choice === 'yes') {
      try {
        await saveDirtyQueryTab(entry, savedQueries, saveQueryFn);
        savedCount += 1;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage === 'cancelled-query-save') {
          return 'cancelled';
        }
        message.error(errorMessage);
        return 'cancelled';
      }
      index += 1;
      continue;
    }
    if (choice === 'no') {
      index += 1;
      continue;
    }
    if (choice === 'yes-all') {
      for (let current = index; current < dirtyTabs.length; current += 1) {
        try {
          await saveDirtyQueryTab(dirtyTabs[current], savedQueries, saveQueryFn);
          savedCount += 1;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage === 'cancelled-query-save') {
            return 'cancelled';
          }
          message.error(errorMessage);
          return 'cancelled';
        }
      }
      if (savedCount > 0) {
        message.success(t('tab_manager.query_close.saved'));
      }
      return 'resolved';
    }
    return 'resolved';
  }
  if (savedCount > 0) {
    message.success(t('tab_manager.query_close.saved'));
  }
  return 'resolved';
};

export async function requestCloseQueryTabs(
  targetTabs: TabData[],
  closeConfirmedTabs: () => void,
): Promise<QueryTabClosePromptResult> {
  flushQueryTabDrafts(targetTabs.map((tab) => tab.id));

  const candidateTabs = targetTabs.filter(isClosableQueryTab);
  const savedQueriesSnapshot = useStore.getState().savedQueries;
  const saveQueryFn = useStore.getState().saveQuery;

  const closeConfirmedTabsAndClearDrafts = () => {
    closeConfirmedTabs();
    candidateTabs.forEach((tab) => clearQueryTabDraft(tab.id));
  };

  if (candidateTabs.length === 0) {
    closeConfirmedTabs();
    return 'completed';
  }

  const dirtyTabs: DirtyQueryTabEntry[] = [];
  const missingFileTabs: Array<{ tab: TabData; filePath: string }> = [];
  for (const tab of candidateTabs) {
    const draft = getQueryTabDraft(tab.id, String(tab.query ?? ''));
    const filePath = getSQLFileTabPath(tab);
    if (filePath) {
      try {
        const res = await ReadSQLFile(filePath);
        if (!res.success) {
          if (isSQLFileMissingReadResult(res)) {
            missingFileTabs.push({ tab, filePath });
            continue;
          }
          message.error(t('tab_manager.sql_file_close.read_failed_cancel_close', { detail: res.message || filePath }));
          return 'failed';
        }
        if (hasQueryTabUnsavedChanges(tab, draft, savedQueriesSnapshot, normalizeSQLFileReadContent(res.data))) {
          dirtyTabs.push({ tab, draft });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (isSQLFileMissingErrorMessage(errorMessage)) {
          missingFileTabs.push({ tab, filePath });
          continue;
        }
        message.error(t('tab_manager.sql_file_close.read_failed_cancel_close', { detail: errorMessage }));
        return 'failed';
      }
      continue;
    }

    if (hasQueryTabUnsavedChanges(tab, draft, savedQueriesSnapshot)) {
      dirtyTabs.push({ tab, draft });
    }
  }

  const confirmDirtyTabsOrClose = async (): Promise<QueryTabClosePromptResult> => {
    if (dirtyTabs.length === 0) {
      closeConfirmedTabsAndClearDrafts();
      return 'completed';
    }

    const resolution = await resolveDirtyTabsBeforeClose(dirtyTabs, savedQueriesSnapshot, saveQueryFn);
    if (resolution === 'cancelled') {
      return 'cancelled';
    }
    closeConfirmedTabsAndClearDrafts();
    return 'completed';
  };

  if (missingFileTabs.length > 0) {
    const firstMissing = missingFileTabs[0];
    const missingLabel = missingFileTabs.length === 1
      ? t('tab_manager.sql_file_close.missing_single_label', { title: firstMissing.tab.title || firstMissing.filePath })
      : t('tab_manager.sql_file_close.missing_multiple_label', { count: missingFileTabs.length });
    return new Promise((resolve) => {
      Modal.confirm({
        title: t('tab_manager.sql_file_close.missing_confirm_title'),
        content: t('tab_manager.sql_file_close.missing_confirm_content', { label: missingLabel }),
        okText: dirtyTabs.length > 0 ? t('tab_manager.sql_file_close.continue_close') : t('tab_manager.sql_file_close.close_tabs'),
        cancelText: t('common.cancel'),
        closable: true,
        maskClosable: true,
        okButtonProps: { danger: true },
        onOk: async () => {
          resolve(await confirmDirtyTabsOrClose());
        },
        onCancel: () => resolve('cancelled'),
      });
    });
  }

  return confirmDirtyTabsOrClose();
}

export async function closeTabsWithSavePrompt(
  targetTabs: TabData[],
  closeConfirmedTabs: () => void,
): Promise<boolean> {
  const result = await requestCloseQueryTabs(targetTabs, closeConfirmedTabs);
  return result === 'completed';
}
