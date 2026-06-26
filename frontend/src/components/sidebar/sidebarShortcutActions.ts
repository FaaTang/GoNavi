import type { TabData } from '../../types';
import type { SavedConnection } from '../../types';
import { DBShowCreateTable } from '../../../wailsjs/go/app/App';
import { buildRpcConnectionConfig } from '../../utils/connectionRpcConfig';
import { formatDdlForDisplay } from '../../utils/ddlFormat';
import { buildTableSelectQuery } from '../../utils/objectQueryTemplates';
import { getMetadataDialect } from './sidebarMetadataLoaders';
import type { SidebarNodeLike } from './sidebarHelpers';

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export const buildNewQueryTabFromSidebarNode = (
  node: SidebarNodeLike | null | undefined,
  translate: TranslateFn,
): TabData | null => {
  if (!node?.dataRef?.id) {
    return null;
  }
  const connectionId = String(node.dataRef.id);
  if (node.type === 'database') {
    const dbName = String(node.dataRef.dbName || node.title || '').trim();
    if (!dbName) {
      return null;
    }
    return {
      id: `query-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: translate('sidebar.tab.new_query_database', { database: dbName }),
      type: 'query',
      connectionId,
      dbName,
      query: '',
    };
  }
  if (node.type === 'table') {
    const tableName = String(node.dataRef.tableName || '').trim();
    const dbName = String(node.dataRef.dbName || '').trim();
    if (!tableName || !dbName) {
      return null;
    }
    const queryTemplate = buildTableSelectQuery(
      getMetadataDialect(node.dataRef as SavedConnection),
      tableName,
    );
    return {
      id: `query-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: translate('query.new'),
      type: 'query',
      connectionId,
      dbName,
      query: queryTemplate,
    };
  }
  return null;
};

export const fetchTableDdlFromSidebarNode = async (
  node: SidebarNodeLike | null | undefined,
): Promise<{ tableName: string; ddlText: string } | { error: 'missing_context' | 'load_failed'; message?: string }> => {
  const conn = node?.dataRef;
  const tableName = String(conn?.tableName || '').trim();
  const dbName = String(conn?.dbName || '').trim();
  if (!conn?.config || !tableName || !dbName) {
    return { error: 'missing_context' };
  }
  try {
    const res = await DBShowCreateTable(
      buildRpcConnectionConfig(conn.config) as any,
      dbName,
      tableName,
    );
    if (res.success) {
      const dbType = String(conn.config?.type || '');
      return {
        tableName,
        ddlText: formatDdlForDisplay(res.data, dbType),
      };
    }
    return {
      error: 'load_failed',
      message: String(res.message || '').trim() || undefined,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? '').trim();
    return {
      error: 'load_failed',
      message: message || undefined,
    };
  }
};
