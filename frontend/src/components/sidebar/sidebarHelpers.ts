// Sidebar 工具函数集合（第一期：纯函数 + 共享常量/类型）。
//
// 本文件是 Sidebar.tsx 拆分的第一步，只搬迁完全独立、无内部类型依赖的工具函数。
// 后续 PR 会继续搬迁更多工具函数和子组件。
//
// 设计原则：
//   - 只放纯函数（无副作用、无 React state）
//   - 不依赖 Sidebar.tsx 内部的 TreeNode 类型（用结构化类型参数代替）
//   - 共享常量和类型集中管理，便于跨文件复用

import { t } from '../../i18n';
import { splitQualifiedNameSegments } from '../../utils/qualifiedName';

// === 共享常量 ===

/** V2 Rail 中"未分组连接"组的固定 ID */
export const V2_RAIL_UNGROUPED_CONNECTION_GROUP_ID = '__gonavi-v2-ungrouped-connections__';

// === 共享类型 ===

/** V2 资源管理器过滤维度 */
export type V2ExplorerFilter = 'all' | 'tables' | 'views' | 'sequences' | 'routines' | 'packages' | 'events';

// === 纯函数 ===

/**
 * formatSidebarRowCount 把估算行数格式化为人类可读的简短形式。
 * - 前缀 ≈，标明来自系统统计的近似值（可能与真实行数不符，含 ≈0）
 * - >= 1M 显示为 "≈1.2M"
 * - >= 1K 显示为 "≈1.2K"
 * - 否则显示 "≈" + 原数字
 * - 非法值（NaN/负数）返回空字符串
 */
export const formatSidebarRowCount = (count: number): string => {
  if (!Number.isFinite(count) || count < 0) return '';
  if (count >= 1_000_000) return `≈${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `≈${(count / 1_000).toFixed(1)}K`;
  return `≈${Math.round(count)}`;
};

/**
 * hasSidebarLazyChildren 判断树节点的 children 是否已加载（用于按需展开）。
 */
export const hasSidebarLazyChildren = (children: unknown): boolean => {
  return Array.isArray(children) && children.length > 0;
};

/**
 * shouldClearSidebarActiveContextOnEmptySelect 判断在空选择时是否清空激活上下文。
 * 仅 legacy UI 需要清空；V2 UI 保留上下文。
 */
export const shouldClearSidebarActiveContextOnEmptySelect = (): boolean => false;

/**
 * getV2RailConnectionGroupBadgeText 从组名生成 1-2 字符的徽章文本。
 * 中文取首字；英文取前两个 token 的首字母大写；其他取前 2 字符。
 */
export const getV2RailConnectionGroupBadgeText = (
  name: unknown,
  fallback = t('connection.sidebar.group.badge'),
): string => {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return fallback;
  const cjkParts = trimmed.match(/[一-龥]/g);
  if (cjkParts && cjkParts.length > 0) {
    return cjkParts.slice(0, 1).join('');
  }
  const latinTokens = trimmed.match(/[a-z0-9]+/gi) || [];
  if (latinTokens.length >= 2) {
    const firstToken = latinTokens[0] || '';
    const secondToken = latinTokens[1] || '';
    return `${firstToken[0] || ''}${secondToken[0] || ''}`.toUpperCase();
  }
  if (latinTokens.length === 1) {
    const token = latinTokens[0] || '';
    const alphaPrefix = token.match(/^[a-z]+/i)?.[0] || '';
    if (alphaPrefix) {
      return alphaPrefix.slice(0, 2).toUpperCase();
    }
    const trailingDigits = token.match(/(\d{2,})$/)?.[1];
    if (trailingDigits) {
      return trailingDigits.slice(-2).toUpperCase();
    }
    return token.slice(0, 2).toUpperCase();
  }
  return trimmed.slice(0, 2);
};

/**
 * isV2SidebarObjectNode 判断节点是否是 SQL 对象类型（表/视图/触发器/事件/存储过程）。
 * 接收结构化类型而非 TreeNode，避免对 Sidebar 内部类型的硬依赖。
 */
export const isV2SidebarObjectNode = (
  node: { type?: string } | null | undefined,
): boolean => {
  return node?.type === 'table'
      || node?.type === 'view'
      || node?.type === 'materialized-view'
      || node?.type === 'sequence'
      || node?.type === 'db-trigger'
      || node?.type === 'db-event'
      || node?.type === 'routine'
      || node?.type === 'package';
};

// === 第二期：依赖 i18n 但不依赖 TreeNode 内部类型的工具函数 ===

/**
 * SidebarNodeLike 是 TreeNode 的结构化子集，用于工具函数签名。
 * 让 sidebarHelpers 不依赖 Sidebar.tsx 内部的 TreeNode 定义，避免循环依赖。
 */
export interface SidebarNodeLike {
  key?: string;
  type?: string;
  dataRef?: any;
  title?: string;
  children?: SidebarNodeLike[];
  isLeaf?: boolean;
}

/**
 * resolveV2ObjectGroupTitle 解析 V2 资源管理器中"对象分组"节点的本地化标题。
 * 仅对 type === 'object-group' 的节点有效，其他返回 null。
 */
export const resolveV2ObjectGroupTitle = (
  node: Pick<SidebarNodeLike, 'type' | 'dataRef'> | null | undefined,
): string | null => {
  if (node?.type !== 'object-group') return null;
  const groupKey = String(node?.dataRef?.groupKey || '');
  if (groupKey === 'tables') return t('sidebar.v2_table_group_menu.title');
  if (groupKey === 'views') return t('sidebar.object_group.views');
  if (groupKey === 'sequences') return t('sidebar.object_group.sequences');
  if (groupKey === 'routines') return t('sidebar.object_group.routines');
  if (groupKey === 'packages') return t('sidebar.object_group.packages');
  if (groupKey === 'triggers') return t('sidebar.object_group.triggers');
  if (groupKey === 'events') return t('sidebar.object_group.events');
  if (groupKey === 'materializedViews') return t('sidebar.object_group.materialized_views');
  return null;
};

/**
 * resolveSidebarTableNameForCopy 从节点提取用于复制的对象名。
 * 优先级：dataRef.tableName > dataRef.viewName > dataRef.eventName > title。
 * 未限定时优先补 schemaName，其次补 dbName，便于粘贴为可用的库/模式.对象名。
 */
export const resolveSidebarTableNameForCopy = (
  node: Pick<SidebarNodeLike, 'title' | 'dataRef'> | null | undefined,
): string => {
  const objectName = String(
    node?.dataRef?.tableName
      || node?.dataRef?.viewName
      || node?.dataRef?.sequenceName
      || node?.dataRef?.packageName
      || node?.dataRef?.eventName
      || node?.title
      || '',
  ).trim();
  if (!objectName) return '';
  if (splitQualifiedNameSegments(objectName).filter(Boolean).length >= 2) {
    return objectName;
  }
  const schemaName = String(node?.dataRef?.schemaName || '').trim();
  if (schemaName) return `${schemaName}.${objectName}`;
  const dbName = String(node?.dataRef?.dbName || '').trim();
  if (dbName) return `${dbName}.${objectName}`;
  return objectName;
};

const SIDEBAR_OBJECT_CONTEXT_TYPES = new Set([
  'table',
  'view',
  'materialized-view',
  'sequence',
  'package',
  'db-trigger',
  'db-event',
  'routine',
]);

/**
 * resolveSidebarObjectNameForContext 提取三级面包屑第 3 级对象名（表/视图/例程等）。
 */
export const resolveSidebarObjectNameForContext = (
  node: Pick<SidebarNodeLike, 'type' | 'title' | 'dataRef'> | null | undefined,
): string => {
  if (!node || !SIDEBAR_OBJECT_CONTEXT_TYPES.has(String(node.type || ''))) {
    return '';
  }
  const dataRef = node.dataRef || {};
  return String(
    dataRef.tableName
      || dataRef.viewName
      || dataRef.sequenceName
      || dataRef.packageName
      || dataRef.triggerName
      || dataRef.eventName
      || dataRef.routineName
      || dataRef.name
      || (typeof node.title === 'string' || typeof node.title === 'number' ? node.title : '')
      || '',
  ).trim();
};

// === 命令搜索相关类型与解析（V2 Command Search）===

/** 命令搜索模式：default（默认）/ object（@前缀，对象搜索）/ ai（?或？前缀，AI 提问） */
export type V2CommandSearchMode = 'default' | 'object' | 'ai';

/** 命令搜索查询解析结果 */
export interface V2CommandSearchQuery {
  mode: V2CommandSearchMode;
  rawValue: string;
  keyword: string;
  normalizedKeyword: string;
  aiPrompt: string;
}

/**
 * parseV2CommandSearchQuery 解析命令搜索框的输入。
 * - "@" 或 "＠" 前缀：对象搜索模式
 * - "?" 或 "？" 前缀：AI 提问模式
 * - 无前缀：默认模式
 */
export const parseV2CommandSearchQuery = (value: unknown): V2CommandSearchQuery => {
  const rawValue = String(value ?? '');
  const trimmedValue = rawValue.trim();
  const firstChar = trimmedValue.charAt(0);

  if (firstChar === '@' || firstChar === '＠') {
    const keyword = trimmedValue.slice(1).trim();
    return {
      mode: 'object',
      rawValue,
      keyword,
      normalizedKeyword: keyword.toLowerCase(),
      aiPrompt: '',
    };
  }

  if (firstChar === '?' || firstChar === '？') {
    const aiPrompt = trimmedValue.slice(1).trim();
    return {
      mode: 'ai',
      rawValue,
      keyword: aiPrompt,
      normalizedKeyword: aiPrompt.toLowerCase(),
      aiPrompt,
    };
  }

  return {
    mode: 'default',
    rawValue,
    keyword: trimmedValue,
    normalizedKeyword: trimmedValue.toLowerCase(),
    aiPrompt: '',
  };
};

/**
 * shouldLoadSidebarNodeOnExpand 判断节点展开时是否需要懒加载子节点。
 * 仅 connection/database/external-sql-root/table/jvm-mode/jvm-resource 类型且无已加载 children 时返回 true。
 */
export const shouldLoadSidebarNodeOnExpand = (
  node: Pick<SidebarNodeLike, 'type' | 'children' | 'isLeaf'> | null | undefined,
): boolean => {
  if (!node || node.isLeaf === true || hasSidebarLazyChildren(node.children)) return false;
  return node.type === 'connection'
      || node.type === 'database'
      || node.type === 'external-sql-root'
      || node.type === 'table'
      || node.type === 'jvm-mode'
      || node.type === 'jvm-resource';
};

/** 侧栏树双击手势识别窗口（毫秒）。略宽于浏览器默认，兼容首击重渲染后的第二次单击。 */
export const SIDEBAR_TREE_DOUBLE_CLICK_INTERVAL_MS = 400;

/**
 * isSidebarTreeDoubleClickGesture 根据连续两次点击的 key/时间判断是否为双击。
 * 不依赖原生 dblclick：虚拟树重渲染、mousedown 抢焦点时 dblclick 常丢失，但两次 onSelect 仍会触发。
 */
export const isSidebarTreeDoubleClickGesture = (input: {
  previousKey?: string | null;
  previousAt?: number | null;
  currentKey: unknown;
  currentAt: number;
  intervalMs?: number;
}): boolean => {
  const currentKey = String(input.currentKey ?? '').trim();
  if (!currentKey) return false;
  const previousKey = String(input.previousKey ?? '').trim();
  if (!previousKey || previousKey !== currentKey) return false;
  const previousAt = Number(input.previousAt);
  if (!Number.isFinite(previousAt) || previousAt <= 0) return false;
  const intervalMs = Number.isFinite(input.intervalMs)
      ? Number(input.intervalMs)
      : SIDEBAR_TREE_DOUBLE_CLICK_INTERVAL_MS;
  const delta = input.currentAt - previousAt;
  return delta >= 0 && delta <= intervalMs;
};

/**
 * shouldToggleSidebarTreeNodeOnDoubleClick 判断双击应切换展开/折叠，而非打开对象页签。
 * 与 Sidebar onDoubleClick 中「打开 tab 后 return」的节点类型保持互斥。
 */
export const shouldToggleSidebarTreeNodeOnDoubleClick = (
  node: Pick<SidebarNodeLike, 'type' | 'isLeaf'> | null | undefined,
): boolean => {
  if (!node || node.isLeaf === true) return false;
  const type = String(node.type || '');
  if (
    type === 'table'
    || type === 'view'
    || type === 'materialized-view'
    || type === 'saved-query'
    || type === 'external-sql-file'
    || type === 'redis-db'
    || type === 'db-trigger'
    || type === 'db-event'
    || type === 'routine'
    || type === 'sequence'
    || type === 'package'
    || type === 'jvm-mode'
    || type === 'jvm-resource'
    || type === 'jvm-monitoring'
    || type === 'jvm-diagnostic'
    || type === 'v2-table-section'
    || type === 'folder-columns'
    || type === 'folder-indexes'
    || type === 'folder-fks'
    || type === 'folder-triggers'
  ) {
    return false;
  }
  return true;
};

/**
 * resolveSidebarNodeDisplayLabel 提取树节点当前显示文案（用于 Ctrl/Cmd+C 复制）。
 */
export const resolveSidebarNodeDisplayLabel = (
  node: Pick<SidebarNodeLike, 'type' | 'title' | 'dataRef'> | null | undefined,
): string => {
  const objectGroupTitle = resolveV2ObjectGroupTitle(node);
  if (objectGroupTitle) {
    return objectGroupTitle.trim();
  }
  const directTitle = node?.title;
  if (typeof directTitle === 'string' || typeof directTitle === 'number') {
    return String(directTitle).trim();
  }
  const dataRef = node?.dataRef || {};
  const fallback = dataRef.tableName
      || dataRef.viewName
      || dataRef.sequenceName
      || dataRef.packageName
      || dataRef.eventName
      || dataRef.routineName
      || dataRef.triggerName
      || dataRef.dbName
      || dataRef.name
      || dataRef.path;
  return String(fallback || '').trim();
};

export const buildSidebarSelectedDisplayLabels = (
  nodes: Array<Pick<SidebarNodeLike, 'title' | 'dataRef'> | null | undefined>,
): string[] => (
  nodes
    .map((node) => resolveSidebarNodeDisplayLabel(node))
    .filter((label) => !!label)
);

export type SidebarTreeSelectKey = string | number | bigint;

export const isSidebarTreeMultiSelectMouseEvent = (
  event: Pick<MouseEvent, 'ctrlKey' | 'metaKey'> | null | undefined,
): boolean => !!(event?.ctrlKey || event?.metaKey);

export const isSidebarTreeRangeSelectMouseEvent = (
  event: Pick<MouseEvent, 'ctrlKey' | 'metaKey' | 'shiftKey'> | null | undefined,
): boolean => !!(event?.shiftKey && !event?.ctrlKey && !event?.metaKey);

/**
 * resolveSidebarTreeRangeKeys 按可见树顺序，计算 Shift 连续选中区间。
 */
export const resolveSidebarTreeRangeKeys = (
  orderedKeys: SidebarTreeSelectKey[],
  anchorKey: SidebarTreeSelectKey | null | undefined,
  targetKey: SidebarTreeSelectKey | null | undefined,
): SidebarTreeSelectKey[] => {
  if (anchorKey === undefined || anchorKey === null || targetKey === undefined || targetKey === null) {
    return targetKey === undefined || targetKey === null ? [] : [targetKey];
  }
  const anchorIndex = orderedKeys.findIndex((key) => String(key) === String(anchorKey));
  const targetIndex = orderedKeys.findIndex((key) => String(key) === String(targetKey));
  if (anchorIndex < 0 && targetIndex < 0) {
    return [anchorKey, targetKey].filter((key, index, list) => (
      list.findIndex((item) => String(item) === String(key)) === index
    ));
  }
  if (anchorIndex < 0) {
    return [targetKey];
  }
  if (targetIndex < 0) {
    return [anchorKey];
  }
  const start = Math.min(anchorIndex, targetIndex);
  const end = Math.max(anchorIndex, targetIndex);
  return orderedKeys.slice(start, end + 1);
};

/**
 * resolveSidebarTreeSelectState 规范化树节点选择：
 * - 普通单击：仅保留当前节点；再次点击已选节点时保持选中（取消选中用 Esc / Ctrl）
 * - Shift + 单击：按可见树顺序连续选中
 * - Ctrl/Cmd + 单击：沿用 antd 多选结果（允许取消选中）
 */
export const resolveSidebarTreeSelectState = (input: {
  keys: SidebarTreeSelectKey[];
  node: SidebarNodeLike | null | undefined;
  selectedNodes: SidebarNodeLike[];
  nativeEvent?: Pick<MouseEvent, 'ctrlKey' | 'metaKey' | 'shiftKey'> | null;
  previousKeys?: SidebarTreeSelectKey[];
  orderedKeys?: SidebarTreeSelectKey[];
  anchorKey?: SidebarTreeSelectKey | null;
  resolveNodeByKey?: (key: SidebarTreeSelectKey) => SidebarNodeLike | null;
}): { keys: SidebarTreeSelectKey[]; nodes: SidebarNodeLike[]; nextAnchorKey: SidebarTreeSelectKey | null } => {
  const nodeKey = input.node?.key;
  if (isSidebarTreeMultiSelectMouseEvent(input.nativeEvent)) {
    const nextAnchor = nodeKey !== undefined && nodeKey !== null ? nodeKey : (input.anchorKey ?? null);
    return { keys: input.keys, nodes: input.selectedNodes, nextAnchorKey: nextAnchor };
  }
  if (
    isSidebarTreeRangeSelectMouseEvent(input.nativeEvent)
    && nodeKey !== undefined
    && nodeKey !== null
  ) {
    const anchorKey = input.anchorKey
      ?? (input.previousKeys && input.previousKeys.length > 0 ? input.previousKeys[0] : null)
      ?? nodeKey;
    const rangeKeys = resolveSidebarTreeRangeKeys(input.orderedKeys || [], anchorKey, nodeKey);
    const resolveNodeByKey = input.resolveNodeByKey;
    const rangeNodes = rangeKeys
      .map((key) => {
        if (resolveNodeByKey) {
          return resolveNodeByKey(key);
        }
        if (input.node && String(input.node.key) === String(key)) {
          return input.node;
        }
        return input.selectedNodes.find((node) => String(node?.key) === String(key)) || null;
      })
      .filter(Boolean) as SidebarNodeLike[];
    return {
      keys: rangeKeys,
      nodes: rangeNodes.length > 0 ? rangeNodes : (input.node ? [input.node] : []),
      nextAnchorKey: anchorKey,
    };
  }
  // antd Tree 再次点击已选节点会传空 keys；普通单击时保持该节点选中。
  if (input.keys.length === 0) {
    if (nodeKey !== undefined && nodeKey !== null && input.node) {
      return { keys: [nodeKey], nodes: [input.node], nextAnchorKey: nodeKey };
    }
    return { keys: [], nodes: [], nextAnchorKey: null };
  }
  if (nodeKey === undefined || nodeKey === null) {
    return {
      keys: input.keys,
      nodes: input.selectedNodes,
      nextAnchorKey: input.anchorKey ?? null,
    };
  }
  return {
    keys: [nodeKey],
    nodes: input.node ? [input.node] : [],
    nextAnchorKey: nodeKey,
  };
};

export const isSidebarTreeCopyShortcutKeyboardEvent = (
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>,
): boolean => {
  const key = String(event.key || '').toLowerCase();
  return key === 'c' && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
};

export const isSidebarTreeClearSelectionKeyboardEvent = (
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>,
): boolean => (
  String(event.key || '') === 'Escape'
  && !event.ctrlKey
  && !event.metaKey
  && !event.altKey
  && !event.shiftKey
);

export const isSidebarShortcutOverlayTarget = (target: EventTarget | null | undefined): boolean => {
  if (!target || typeof target !== 'object') return false;
  const element = target as HTMLElement;
  return !!element.closest?.('.ant-modal-wrap, .ant-dropdown, .ant-select-dropdown, .ant-picker-dropdown, .ant-popover');
};

export const isEditableShortcutTarget = (target: EventTarget | null | undefined): boolean => {
  if (!target || typeof target !== 'object') return false;
  const element = target as HTMLElement;
  return !!element.closest?.('input, textarea, [contenteditable="true"]');
};

export const isQueryEditorShortcutTarget = (target: Element | EventTarget | null | undefined): boolean => {
  if (!target || typeof target !== 'object') return false;
  const element = target as HTMLElement;
  return !!element.closest?.('.monaco-editor, .gn-v2-query-editor, .gn-v2-query-editor-pane');
};

export const isSidebarTreeDdlShortcutNode = (
  node: Pick<SidebarNodeLike, 'type'> | null | undefined,
): boolean => node?.type === 'table';

export const isSidebarTreeNewQueryShortcutNode = (
  node: Pick<SidebarNodeLike, 'type'> | null | undefined,
): boolean => (
  node?.type === 'database'
  || node?.type === 'table'
  || node?.type === 'view'
  || node?.type === 'materialized-view'
);

export const shouldHandleSidebarTreeShortcut = (input: {
  selectedCount: number;
  treeContainer: HTMLElement | null;
  activeElement: Element | null;
  eventTarget: EventTarget | null;
  lastTreeInteractionAt: number;
  requireSingleSelection?: boolean;
  now?: number;
}): boolean => {
  if (input.selectedCount <= 0) return false;
  if (input.requireSingleSelection && input.selectedCount !== 1) return false;
  const container = input.treeContainer;
  if (!container) return false;
  const activeInTree = !!input.activeElement && container.contains(input.activeElement);
  const targetInTree = !!input.eventTarget && container.contains(input.eventTarget as Node);
  if (isQueryEditorShortcutTarget(input.activeElement) && !activeInTree && !targetInTree) {
    return false;
  }
  const recentTreeInteraction = (input.now ?? Date.now()) - input.lastTreeInteractionAt < 8000;
  return activeInTree || targetInTree || recentTreeInteraction;
};

export const shouldHandleSidebarTreeCopyShortcut = (input: {
  selectedCount: number;
  treeContainer: HTMLElement | null;
  activeElement: Element | null;
  eventTarget: EventTarget | null;
  lastTreeInteractionAt: number;
  now?: number;
}): boolean => shouldHandleSidebarTreeShortcut(input);
