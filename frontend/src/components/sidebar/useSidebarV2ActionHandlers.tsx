import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { message } from 'antd';
import type { FormInstance } from 'antd/es/form';

import Modal from '../common/ResizableDraggableModal';
import { t } from '../../i18n';
import type { SavedConnection } from '../../types';
import { buildRpcConnectionConfig } from '../../utils/connectionRpcConfig';
import { resolveConnectionAccentColor, resolveConnectionIconType } from '../../utils/connectionVisual';
import { buildNewQueryTabFromSidebarNode } from './sidebarShortcutActions';
import { DBReleaseConnection } from '../../../wailsjs/go/app/App';
import { closeTabsWithSavePrompt } from '../../utils/queryTabClosePrompt';
import { useStore } from '../../store';
import { getDbIcon } from '../DatabaseIcons';
import {
  type V2DatabaseContextMenuActionKey,
  type V2ConnectionGroupContextMenuActionKey,
  type V2ConnectionContextMenuActionKey,
  type V2TableContextMenuActionKey,
  type V2TableGroupContextMenuActionKey,
} from '../V2TableContextMenu';
import {
  isSidebarTablePinned,
  type SidebarConnectionState,
  type SidebarTreeNode as TreeNode,
  type V2RailConnectionGroup,
} from '../sidebarV2Utils';

type UseSidebarV2ActionHandlersArgs = {
  connections: SavedConnection[];
  connectionTags: Array<{ id: string; name: string; connectionIds: string[] }>;
  pinnedSidebarTables: any[];
  loadingNodesRef: MutableRefObject<Set<string>>;
  treeDataRef: MutableRefObject<TreeNode[]>;
  selectedNodesRef: MutableRefObject<any[]>;
  findTreeNodeByKeyRef: MutableRefObject<(nodes: TreeNode[], targetKey: React.Key) => TreeNode | null>;
  refreshV2TableContextMenuStatsRef: MutableRefObject<(node: any) => void>;
  setConnectionStates: Dispatch<SetStateAction<Record<string, SidebarConnectionState>>>;
  setExpandedKeys: Dispatch<SetStateAction<React.Key[]>>;
  setLoadedKeys: Dispatch<SetStateAction<React.Key[]>>;
  setTargetConnection: Dispatch<SetStateAction<any>>;
  setIsCreateDbModalOpen: Dispatch<SetStateAction<boolean>>;
  setRenameDbTarget: Dispatch<SetStateAction<any>>;
  setIsRenameDbModalOpen: Dispatch<SetStateAction<boolean>>;
  setRenameTableTarget: Dispatch<SetStateAction<any>>;
  setIsRenameTableModalOpen: Dispatch<SetStateAction<boolean>>;
  setRenameViewTarget: Dispatch<SetStateAction<any>>;
  setIsCreateTagModalOpen: Dispatch<SetStateAction<boolean>>;
  renameDbForm: FormInstance;
  renameTableForm: FormInstance;
  createTagForm: FormInstance;
  addTab: (tab: any) => void;
  closeTabsByDatabase: (connectionId: string, dbName: string) => void;
  closeTabsByConnection: (connectionId: string) => void;
  removeConnection: (connectionId: string) => void;
  removeConnectionTag: (tagId: string) => void;
  moveConnectionToTag: (connectionId: string, tagId: string | null) => void;
  setSidebarTablePinned: (connectionId: string, dbName: string, tableName: string, schemaName: string, pinned: boolean) => void;
  setTableSortPreference: (connectionId: string, dbName: string, sortBy: 'name' | 'frequency') => void;
  replaceTreeNodeChildren: (key: React.Key, children: TreeNode[] | undefined) => void;
  loadDatabases: (node: any) => Promise<void>;
  loadTables: (node: any) => Promise<void>;
  getDatabaseNodeRef: (connRef: any, dbName: string) => any;
  extractObjectName: (fullName: string) => string;
  openDesign: (node: any, initialTab: string, readOnly?: boolean) => void;
  openNewTableDesign: (node: any) => void;
  onDoubleClick: (event: any, node: any) => void;
  openMessagePublishModal: (node: any) => void;
  openTableDdlInDesigner: (node: any) => void;
  openTableInERView: (node: any) => void;
  handleCopyTableName: (node: any) => Promise<void>;
  handleCopyStructure: (node: any) => Promise<void>;
  handleCopyTableAsInsert: (node: any) => Promise<void>;
  openCreateStarRocksRollup: (node: any) => void;
  handleExport: (node: any, options: { format: string; xlsxMaxRowsPerSheet?: number }) => Promise<void>;
  openExportDialog: (node: any) => Promise<void>;
  injectTablePromptToAI: (node: any, promptKind: 'explain' | 'query') => Promise<void>;
  handleTableDataDangerAction: (node: any, action: 'truncate' | 'clear') => Promise<void>;
  handleDeleteTable: (node: any) => void;
  openCreateSchemaModal: (node: any) => void;
  openCreateStarRocksMaterializedView: (node: any) => void;
  openCreateStarRocksExternalCatalog: (node: any) => void;
  handleExportDatabaseSQL: (node: any, includeData: boolean) => Promise<void>;
  handleRunSQLFile: (node: any) => void;
  handleDeleteDatabase: (node: any) => void;
  onEditConnection?: (conn: SavedConnection) => void;
  handleDuplicateConnection: (conn: SavedConnection) => Promise<void>;
  buildConnectionRootQueryTabTitle: () => string;
  buildConnectionRootRedisCommandTabTitle: (redisDbLabel?: string) => string;
  buildConnectionRootRedisMonitorTabTitle: (redisDbLabel?: string) => string;
};

export const useSidebarV2ActionHandlers = ({
  connections,
  connectionTags,
  pinnedSidebarTables,
  loadingNodesRef,
  treeDataRef,
  selectedNodesRef,
  findTreeNodeByKeyRef,
  refreshV2TableContextMenuStatsRef,
  setConnectionStates,
  setExpandedKeys,
  setLoadedKeys,
  setTargetConnection,
  setIsCreateDbModalOpen,
  setRenameDbTarget,
  setIsRenameDbModalOpen,
  setRenameTableTarget,
  setIsRenameTableModalOpen,
  setRenameViewTarget,
  setIsCreateTagModalOpen,
  renameDbForm,
  renameTableForm,
  createTagForm,
  addTab,
  closeTabsByDatabase,
  closeTabsByConnection,
  removeConnection,
  removeConnectionTag,
  moveConnectionToTag,
  setSidebarTablePinned,
  setTableSortPreference,
  replaceTreeNodeChildren,
  loadDatabases,
  loadTables,
  getDatabaseNodeRef,
  extractObjectName,
  openDesign,
  openNewTableDesign,
  onDoubleClick,
  openMessagePublishModal,
  openTableDdlInDesigner,
  openTableInERView,
  handleCopyTableName,
  handleCopyStructure,
  handleCopyTableAsInsert,
  openCreateStarRocksRollup,
  handleExport,
  openExportDialog,
  injectTablePromptToAI,
  handleTableDataDangerAction,
  handleDeleteTable,
  openCreateSchemaModal,
  openCreateStarRocksMaterializedView,
  openCreateStarRocksExternalCatalog,
  handleExportDatabaseSQL,
  handleRunSQLFile,
  handleDeleteDatabase,
  onEditConnection,
  handleDuplicateConnection,
  buildConnectionRootQueryTabTitle,
  buildConnectionRootRedisCommandTabTitle,
  buildConnectionRootRedisMonitorTabTitle,
}: UseSidebarV2ActionHandlersArgs) => {
  const handleV2TableContextMenuAction = (node: any, action: V2TableContextMenuActionKey) => {
    switch (action) {
      case 'pin-table':
      case 'unpin-table': {
        toggleSidebarTablePinned(node, action === 'pin-table');
        return;
      }
      case 'open-data':
      case 'open-new-tab':
        onDoubleClick(null, node);
        return;
      case 'design-table':
        openDesign(node, 'columns', false);
        return;
      case 'new-query': {
        const tab = buildNewQueryTabFromSidebarNode(node, t);
        if (tab) {
          addTab(tab);
        }
        return;
      }
      case 'publish-message':
        openMessagePublishModal(node);
        return;
      case 'view-ddl':
        openTableDdlInDesigner(node);
        return;
      case 'view-er':
        openTableInERView(node);
        return;
      case 'copy-table-name':
        void handleCopyTableName(node);
        return;
      case 'copy-structure':
        void handleCopyStructure(node);
        return;
      case 'copy-insert':
        void handleCopyTableAsInsert(node);
        return;
      case 'rename-table':
        setRenameTableTarget(node);
        renameTableForm.setFieldsValue({ newName: extractObjectName(node.dataRef?.tableName || node.title) });
        setIsRenameTableModalOpen(true);
        return;
      case 'new-rollup':
        openCreateStarRocksRollup(node);
        return;
      case 'backup-table':
        void handleExport(node, { format: 'sql' });
        return;
      case 'refresh-stats':
        refreshV2TableContextMenuStatsRef.current(node);
        return;
      case 'export-data':
        void openExportDialog(node);
        return;
      case 'ai-explain':
        void injectTablePromptToAI(node, 'explain');
        return;
      case 'ai-generate-query':
        void injectTablePromptToAI(node, 'query');
        return;
      case 'truncate-table':
        void handleTableDataDangerAction(node, 'truncate');
        return;
      case 'drop-table':
        handleDeleteTable(node);
        return;
      default:
        return;
    }
  };

  const toggleSidebarTablePinned = (node: any, pinned?: boolean) => {
    const conn = node?.dataRef || {};
    const tableName = String(conn.tableName || node?.title || '').trim();
    const dbName = String(conn.dbName || '').trim();
    if (!conn.id || !dbName || !tableName) return;
    const currentlyPinned = isSidebarTablePinned(
      pinnedSidebarTables,
      String(conn.id || ''),
      dbName,
      tableName,
      String(conn.schemaName || ''),
    );
    const shouldPin = pinned ?? !currentlyPinned;
    setSidebarTablePinned(conn.id, dbName, tableName, conn.schemaName || '', shouldPin);
    void loadTables(getDatabaseNodeRef(conn, dbName));
    message.success(shouldPin ? t('sidebar.message.table_pinned') : t('sidebar.message.table_unpinned'));
  };

  const handleTableGroupSortAction = (node: any, sortBy: 'name' | 'frequency') => {
    const groupData = node.dataRef;
    setTableSortPreference(groupData.id, groupData.dbName, sortBy);
    const dbNode = {
      key: `${groupData.id}-${groupData.dbName}`,
      dataRef: groupData,
    };
    loadTables(dbNode);
  };

  const handleV2TableGroupContextMenuAction = (node: any, action: V2TableGroupContextMenuActionKey) => {
    switch (action) {
      case 'new-table':
        openNewTableDesign(node);
        return;
      case 'sort-by-name':
        handleTableGroupSortAction(node, 'name');
        return;
      case 'sort-by-frequency':
        handleTableGroupSortAction(node, 'frequency');
        return;
      default:
        return;
    }
  };

  const closeDatabaseNode = async (node: any) => {
    const dbConnId = String(node.dataRef?.id || '');
    const dbName = String(node.dataRef?.dbName || node.title || '').trim();
    if (dbConnId && dbName) {
      const tabsToClose = useStore.getState().tabs.filter((tab) => (
        String(tab.connectionId || '').trim() === dbConnId
        && String(tab.dbName || '').trim() === dbName
      ));
      const proceed = await closeTabsWithSavePrompt(tabsToClose, () => closeTabsByDatabase(dbConnId, dbName));
      if (!proceed) {
        return;
      }
    }
    loadingNodesRef.current.delete(`tables-${dbConnId}-${dbName}`);
    setConnectionStates(prev => {
      const next = { ...prev };
      delete next[node.key];
      return next;
    });
    setExpandedKeys(prev => prev.filter(k => k !== node.key && !k.toString().startsWith(`${node.key}-`)));
    setLoadedKeys(prev => prev.filter(k => k !== node.key && !k.toString().startsWith(`${node.key}-`)));
    replaceTreeNodeChildren(node.key, undefined);
    message.success(t('sidebar.message.database_closed'));
  };

  const openDatabaseQuery = (node: any) => {
    const tab = buildNewQueryTabFromSidebarNode(node, t);
    if (tab) {
      addTab(tab);
    }
  };

  const handleV2DatabaseContextMenuAction = (node: any, action: V2DatabaseContextMenuActionKey) => {
    switch (action) {
      case 'new-table':
        openNewTableDesign(node);
        return;
      case 'new-schema':
        openCreateSchemaModal(node);
        return;
      case 'new-materialized-view':
        openCreateStarRocksMaterializedView(node);
        return;
      case 'new-external-catalog':
        openCreateStarRocksExternalCatalog(node);
        return;
      case 'rename-db':
        setRenameDbTarget(node);
        renameDbForm.setFieldsValue({ newName: node.dataRef?.dbName || '' });
        setIsRenameDbModalOpen(true);
        return;
      case 'refresh':
        loadTables(node);
        return;
      case 'export-db-schema':
        void handleExportDatabaseSQL(node, false);
        return;
      case 'backup-db-sql':
        void handleExportDatabaseSQL(node, true);
        return;
      case 'disconnect-db':
        void closeDatabaseNode(node);
        return;
      case 'new-query':
        openDatabaseQuery(node);
        return;
      case 'run-sql':
        handleRunSQLFile(node);
        return;
      case 'drop-db':
        handleDeleteDatabase(node);
        return;
      default:
        return;
    }
  };

  const refreshConnectionNode = (node: any) => {
    const connKey = String(node?.key || node?.dataRef?.id || '');
    if (!connKey) return;
    setExpandedKeys(prev => prev.filter(k => k !== connKey && !k.toString().startsWith(`${connKey}-`)));
    setLoadedKeys(prev => prev.filter(k => k !== connKey && !k.toString().startsWith(`${connKey}-`)));
    Array.from(loadingNodesRef.current).forEach((loadingKey) => {
      if (loadingKey === `dbs-${connKey}` || loadingKey.startsWith(`tables-${connKey}-`)) {
        loadingNodesRef.current.delete(loadingKey);
      }
    });
    loadDatabases(node);
  };

  const releaseConnectionResources = async (conn: SavedConnection | undefined) => {
    if (!conn?.config) return;
    const res = await DBReleaseConnection(buildRpcConnectionConfig(conn.config, { id: conn.id }) as any);
    if (res && res.success === false) {
      throw new Error(String(res.message || '').trim());
    }
  };

  const disconnectConnectionNodeInternal = async (
    node: any,
    options?: { skipTabClosePrompt?: boolean; skipSuccessToast?: boolean },
  ): Promise<boolean> => {
    const connKey = String(node?.key || node?.dataRef?.id || '').trim();
    if (!connKey) return false;
    const tabsToClose = useStore.getState().tabs.filter(
      (tab) => String(tab.connectionId || '').trim() === connKey,
    );
    if (!options?.skipTabClosePrompt) {
      const proceed = await closeTabsWithSavePrompt(tabsToClose, () => closeTabsByConnection(connKey));
      if (!proceed) {
        return false;
      }
    } else {
      closeTabsByConnection(connKey);
    }
    const conn = (connections.find((item) => item.id === connKey) || node?.dataRef) as SavedConnection | undefined;
    Array.from(loadingNodesRef.current).forEach((loadingKey) => {
      if (loadingKey === `dbs-${connKey}` || loadingKey.startsWith(`tables-${connKey}-`)) {
        loadingNodesRef.current.delete(loadingKey);
      }
    });
    setConnectionStates(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        if (k === connKey || k.startsWith(`${connKey}-`)) {
          delete next[k];
        }
      });
      return next;
    });
    setExpandedKeys(prev => prev.filter(k => k !== connKey && !k.toString().startsWith(`${connKey}-`)));
    setLoadedKeys(prev => prev.filter(k => k !== connKey && !k.toString().startsWith(`${connKey}-`)));
    replaceTreeNodeChildren(connKey, undefined);
    try {
      await releaseConnectionResources(conn);
    } catch (error: any) {
      message.warning(String(error?.message || '').trim() || t('sidebar.message.connection_release_failed_from_sidebar'));
    }
    if (!options?.skipSuccessToast) {
      message.success(t('connection.sidebar.disconnect.success'));
    }
    return true;
  };

  const disconnectConnectionNode = async (node: any) => {
    const batchNodes = resolveConnectionBatchNodes(node);
    if (batchNodes.length <= 1) {
      void disconnectConnectionNodeInternal(node);
      return;
    }
    const connectionIds = batchNodes
      .map((item) => String(item?.key || item?.dataRef?.id || '').trim())
      .filter(Boolean);
    const connectionIdSet = new Set(connectionIds);
    const tabsToClose = useStore.getState().tabs.filter(
      (tab) => connectionIdSet.has(String(tab.connectionId || '').trim()),
    );
    const proceed = await closeTabsWithSavePrompt(tabsToClose, () => {
      connectionIds.forEach((connId) => closeTabsByConnection(connId));
    });
    if (!proceed) {
      return;
    }
    for (const item of batchNodes) {
      await disconnectConnectionNodeInternal(item, { skipTabClosePrompt: true, skipSuccessToast: true });
    }
    message.success(t('connection.sidebar.disconnect.success'));
  };

  const deleteConnectionNode = (node: any) => {
    const batchNodes = resolveConnectionBatchNodes(node);
    if (batchNodes.length > 1) {
      Modal.confirm({
        title: t('connection.sidebar.delete.confirmTitle'),
        content: t('connection.sidebar.delete.batchConfirmContent', { count: batchNodes.length }),
        onOk: async () => {
          const backendApp = (window as any).go?.app?.App;
          if (typeof backendApp?.DeleteConnection !== 'function') {
            message.error(t('connection.sidebar.delete.backendUnavailable'));
            throw new Error('DeleteConnection unavailable');
          }
          try {
            for (const item of batchNodes) {
              const connId = String(item?.key || item?.dataRef?.id || '').trim();
              if (!connId) continue;
              await backendApp.DeleteConnection(connId);
              closeTabsByConnection(connId);
              removeConnection(connId);
            }
            message.success(t('connection.sidebar.delete.batchSuccess', { count: batchNodes.length }));
          } catch (error: any) {
            message.error(error?.message || t('connection.sidebar.delete.failureFallback'));
            throw error;
          }
        },
      });
      return;
    }
    Modal.confirm({
      title: t('connection.sidebar.delete.confirmTitle'),
      content: t('connection.sidebar.delete.confirmContent', { name: node.title }),
      onOk: async () => {
        const connId = String(node.key);
        const backendApp = (window as any).go?.app?.App;
        if (typeof backendApp?.DeleteConnection !== 'function') {
          message.error(t('connection.sidebar.delete.backendUnavailable'));
          throw new Error('DeleteConnection unavailable');
        }
        try {
          await backendApp.DeleteConnection(connId);
          closeTabsByConnection(connId);
          removeConnection(connId);
          message.success(t('connection.sidebar.delete.success'));
        } catch (error: any) {
          message.error(error?.message || t('connection.sidebar.delete.failureFallback'));
          throw error;
        }
      },
    });
  };

  const createConnectionTreeNode = (conn: SavedConnection): TreeNode => ({
    title: conn.name,
    key: conn.id,
    icon: getDbIcon(resolveConnectionIconType(conn), resolveConnectionAccentColor(conn), 22),
    type: 'connection',
    dataRef: conn,
    isLeaf: false,
  });

  const getConnectionNodeForAction = (conn: SavedConnection): TreeNode => {
    return findTreeNodeByKeyRef.current(treeDataRef.current, conn.id) || createConnectionTreeNode(conn);
  };

  const resolveConnectionBatchNodes = (node: any): TreeNode[] => {
    const currentConnId = String(node?.key || node?.dataRef?.id || '').trim();
    if (!currentConnId) return [];
    const selected = Array.isArray(selectedNodesRef.current) ? selectedNodesRef.current : [];
    const selectedConnectionNodes = selected.filter((item) => String(item?.type || '') === 'connection');
    if (selectedConnectionNodes.length <= 1) {
      return [node];
    }
    const selectedConnIds = new Set(
      selectedConnectionNodes
        .map((item) => String(item?.key || item?.dataRef?.id || '').trim())
        .filter(Boolean),
    );
    if (!selectedConnIds.has(currentConnId)) {
      return [node];
    }
    const resolved: TreeNode[] = [];
    const seen = new Set<string>();
    selectedConnectionNodes.forEach((item) => {
      const connId = String(item?.key || item?.dataRef?.id || '').trim();
      if (!connId || seen.has(connId)) return;
      seen.add(connId);
      const resolvedNode = findTreeNodeByKeyRef.current(treeDataRef.current, connId) || item;
      resolved.push(resolvedNode as TreeNode);
    });
    return resolved.length > 0 ? resolved : [node];
  };

  const handleV2ConnectionContextMenuAction = (node: any, action: V2ConnectionContextMenuActionKey) => {
    const connId = String(node?.key || node?.dataRef?.id || '');
    if (!connId) return;
    switch (action) {
      case 'new-db':
        setTargetConnection(node);
        setIsCreateDbModalOpen(true);
        return;
      case 'refresh':
        resolveConnectionBatchNodes(node).forEach((item) => refreshConnectionNode(item));
        return;
      case 'new-query':
        addTab({
          id: `query-${Date.now()}`,
          title: buildConnectionRootQueryTabTitle(),
          type: 'query',
          connectionId: connId,
          dbName: undefined,
          query: '',
        });
        return;
      case 'open-sql-file':
        handleRunSQLFile(node);
        return;
      case 'new-command':
        addTab({
          id: `redis-cmd-${connId}-${Date.now()}`,
          title: buildConnectionRootRedisCommandTabTitle(),
          type: 'redis-command',
          connectionId: connId,
          redisDB: 0,
        });
        return;
      case 'open-monitor':
        addTab({
          id: `redis-monitor-${connId}-${Date.now()}`,
          title: buildConnectionRootRedisMonitorTabTitle(),
          type: 'redis-monitor',
          connectionId: connId,
          redisDB: 0,
        });
        return;
      case 'edit':
        if (onEditConnection) onEditConnection(node.dataRef);
        return;
      case 'copy-connection':
        void handleDuplicateConnection(node.dataRef as SavedConnection);
        return;
      case 'disconnect':
        void disconnectConnectionNode(node);
        return;
      case 'delete':
        deleteConnectionNode(node);
        return;
      case 'move-to-ungrouped':
        moveConnectionToTag(connId, null);
        return;
      default:
        if (action.startsWith('move-to-tag:')) {
          moveConnectionToTag(connId, action.slice('move-to-tag:'.length));
        }
    }
  };

  const handleV2ConnectionGroupContextMenuAction = (group: V2RailConnectionGroup, action: V2ConnectionGroupContextMenuActionKey) => {
    const tag = connectionTags.find((item) => item.id === group.id);
    if (!tag) return;
    if (action === 'edit-group') {
      createTagForm.setFieldsValue({ name: tag.name, connectionIds: tag.connectionIds });
      setRenameViewTarget({
        title: tag.name,
        key: `tag-${tag.id}`,
        type: 'tag',
        dataRef: tag,
      });
      setIsCreateTagModalOpen(true);
      return;
    }
    if (action === 'delete-group') {
      Modal.confirm({
        title: t('connection.sidebar.group.deleteConfirmTitle'),
        content: t('connection.sidebar.group.deleteConfirmContent', { name: tag.name }),
        onOk: () => {
          removeConnectionTag(tag.id);
        },
      });
    }
  };

  return {
    getConnectionNodeForAction,
    toggleSidebarTablePinned,
    handleV2TableContextMenuAction,
    handleTableGroupSortAction,
    handleV2TableGroupContextMenuAction,
    handleV2DatabaseContextMenuAction,
    disconnectConnectionNode,
    deleteConnectionNode,
    handleV2ConnectionContextMenuAction,
    handleV2ConnectionGroupContextMenuAction,
  };
};
