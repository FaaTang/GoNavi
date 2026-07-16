import {
  findSqlJoinTableSources,
  findSqlStatementRanges,
  findSqlSubqueryRanges,
  resolveCurrentSqlStatementRange,
  resolveEnclosingSqlSubqueryRange,
  resolveExecutableSql,
  type SqlStatementRange,
} from './sqlStatementSelection';

export type SqlExecutionChooserOptionId =
  | 'all'
  | `statement-${number}`
  | `subquery-${number}`
  | `table-${number}`;

export type SqlExecutionChooserOption = {
  id: SqlExecutionChooserOptionId;
  sql: string;
  preview: string;
  highlightStart: number;
  highlightEnd: number;
  statementCount: number;
  tableName?: string;
};

export type SqlExecutionIntent =
  | { kind: 'execute'; sql: string }
  | {
      kind: 'chooser';
      options: SqlExecutionChooserOption[];
      defaultOptionId: SqlExecutionChooserOptionId;
    }
  | { kind: 'use-auto' }
  | { kind: 'empty' };

export const isSqlExecutionSubqueryOptionId = (
  id: string,
): id is `subquery-${number}` => /^subquery-\d+$/.test(id);

export const isSqlExecutionStatementOptionId = (
  id: string,
): id is `statement-${number}` => /^statement-\d+$/.test(id);

export const isSqlExecutionTableOptionId = (
  id: string,
): id is `table-${number}` => /^table-\d+$/.test(id);

export const buildSqlExecutionSubqueryOptionId = (index: number): `subquery-${number}` => (
  `subquery-${Math.max(0, Math.floor(index))}`
);

export const buildSqlExecutionStatementOptionId = (index: number): `statement-${number}` => (
  `statement-${Math.max(0, Math.floor(index))}`
);

export const buildSqlExecutionTableOptionId = (index: number): `table-${number}` => (
  `table-${Math.max(0, Math.floor(index))}`
);

export function truncateSqlPreview(sql: string, maxLength = 80): string {
  const singleLine = String(sql || '').replace(/\s+/g, ' ').trim();
  if (!singleLine) return '';
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function buildAllStatementsSql(fullSql: string): string {
  const statements = findSqlStatementRanges(fullSql)
    .map((range) => stripLeadingSqlNoise(range.text))
    .filter((sql) => sql.trim() && hasExecutableSqlContent(sql));
  if (statements.length <= 1) {
    return statements[0] || '';
  }

  let merged = statements[0];
  for (let i = 1; i < statements.length; i += 1) {
    const previous = merged.replace(/\s+$/g, '');
    const separator = /[;；]$/.test(previous) ? '\n' : ';\n';
    merged += `${separator}${statements[i]}`;
  }
  return merged;
}

type ExecutableStatementRange = SqlStatementRange & { executableText: string };

const collectExecutableStatementRanges = (fullSql: string): ExecutableStatementRange[] => (
  findSqlStatementRanges(fullSql)
    .map((range) => ({
      ...range,
      executableText: stripLeadingSqlNoise(range.text),
    }))
    .filter((range) => range.executableText.trim() && hasExecutableSqlContent(range.executableText))
);

export function buildSqlExecutionChooserOptions(
  fullSql: string,
  _cursorOffset: number,
  dialect = '',
): SqlExecutionChooserOption[] {
  const text = String(fullSql || '').replace(/\r\n/g, '\n');
  const statementRanges = collectExecutableStatementRanges(text);
  const tableSources = findSqlJoinTableSources(text, dialect);
  const subqueryRanges = findSqlSubqueryRanges(text, dialect)
    .filter((range) => range.text.trim() && hasExecutableSqlContent(range.text));
  const allSql = buildAllStatementsSql(text);

  const options: SqlExecutionChooserOption[] = [];
  statementRanges.forEach((range, index) => {
    options.push({
      id: buildSqlExecutionStatementOptionId(index),
      sql: range.executableText,
      preview: truncateSqlPreview(range.executableText),
      highlightStart: range.start,
      highlightEnd: range.end,
      statementCount: 1,
    });
  });
  // Only surface per-table probes for real multi-table (join / comma-join) queries.
  if (tableSources.length >= 2) {
    tableSources.forEach((source, index) => {
      options.push({
        id: buildSqlExecutionTableOptionId(index),
        sql: source.executableSql,
        preview: truncateSqlPreview(source.executableSql),
        highlightStart: source.start,
        highlightEnd: source.end,
        statementCount: 1,
        tableName: source.tableRef,
      });
    });
  }
  subqueryRanges.forEach((range, index) => {
    options.push({
      id: buildSqlExecutionSubqueryOptionId(index),
      sql: range.text,
      preview: truncateSqlPreview(range.text),
      highlightStart: range.start,
      highlightEnd: range.end,
      statementCount: 1,
    });
  });
  if (allSql.trim() && statementRanges.length > 1) {
    options.push({
      id: 'all',
      sql: allSql,
      preview: truncateSqlPreview(allSql),
      highlightStart: 0,
      highlightEnd: text.length,
      statementCount: statementRanges.length,
    });
  }
  return options;
}

const hasExecutableSqlContent = (sql: string): boolean => {
  const text = String(sql || '');
  let i = 0;
  while (i < text.length) {
    // Whitespace
    const ch = text[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f') {
      i += 1;
      continue;
    }

    // Line comment: -- ...
    if (ch === '-' && i + 1 < text.length && text[i + 1] === '-') {
      i += 2;
      while (i < text.length && text[i] !== '\n') i += 1;
      continue;
    }

    // Line comment: # ...
    if (ch === '#') {
      i += 1;
      while (i < text.length && text[i] !== '\n') i += 1;
      continue;
    }

    // Block comment: /* ... */
    if (ch === '/' && i + 1 < text.length && text[i + 1] === '*') {
      i += 2;
      while (i + 1 < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        i += 1;
      }
      if (i + 1 < text.length) i += 2;
      continue;
    }

    // Any other char means there's something executable-ish.
    return true;
  }
  return false;
};

const stripLeadingSqlNoise = (sql: string): string => {
  const text = String(sql || '');
  let i = 0;
  while (i < text.length) {
    // Whitespace
    const ch = text[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f') {
      i += 1;
      continue;
    }

    // Line comment: -- ...
    if (ch === '-' && i + 1 < text.length && text[i + 1] === '-') {
      i += 2;
      while (i < text.length && text[i] !== '\n') i += 1;
      continue;
    }

    // Line comment: # ...
    if (ch === '#') {
      i += 1;
      while (i < text.length && text[i] !== '\n') i += 1;
      continue;
    }

    // Block comment: /* ... */
    if (ch === '/' && i + 1 < text.length && text[i + 1] === '*') {
      i += 2;
      while (i + 1 < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        i += 1;
      }
      if (i + 1 < text.length) i += 2;
      continue;
    }

    break;
  }
  return text.slice(i);
};

const cursorLineHasExecutableSql = (fullSql: string, cursorOffset: number): boolean => {
  const text = String(fullSql || '').replace(/\r\n/g, '\n');
  const offset = Math.max(0, Math.min(text.length, Number.isFinite(cursorOffset) ? cursorOffset : 0));
  const lineStart = text.lastIndexOf('\n', Math.max(0, offset - 1)) + 1;
  const nextLineBreak = text.indexOf('\n', offset);
  const lineEnd = nextLineBreak === -1 ? text.length : nextLineBreak;
  const line = text.slice(lineStart, lineEnd);
  return hasExecutableSqlContent(line);
};

const findOptionByHighlightRange = (
  options: SqlExecutionChooserOption[],
  range: Pick<SqlStatementRange, 'start' | 'end'> | null | undefined,
  predicate: (option: SqlExecutionChooserOption) => boolean,
): SqlExecutionChooserOption | undefined => {
  if (!range) return undefined;
  return options.find((option) => (
    predicate(option)
    && option.highlightStart === range.start
    && option.highlightEnd === range.end
  ));
};

const resolveDefaultChooserOptionId = (
  options: SqlExecutionChooserOption[],
  fullSql: string,
  cursorOffset: number,
  dialect = '',
): SqlExecutionChooserOptionId => {
  const enclosing = resolveEnclosingSqlSubqueryRange(fullSql, cursorOffset, dialect);
  const matchedSubquery = findOptionByHighlightRange(
    options,
    enclosing,
    (option) => isSqlExecutionSubqueryOptionId(option.id),
  );
  if (matchedSubquery) {
    return matchedSubquery.id;
  }

  const currentRange = resolveCurrentSqlStatementRange(fullSql, cursorOffset);
  const matchedStatement = findOptionByHighlightRange(
    options,
    currentRange,
    (option) => isSqlExecutionStatementOptionId(option.id),
  );
  if (matchedStatement) {
    return matchedStatement.id;
  }

  const matchedTableSource = findSqlJoinTableSources(fullSql, dialect).find((source) => (
    cursorOffset >= source.start && cursorOffset <= source.end
  ));
  if (matchedTableSource) {
    const matchedTable = options.find((option) => (
      isSqlExecutionTableOptionId(option.id)
      && option.tableName === matchedTableSource.tableRef
    ));
    if (matchedTable) {
      return matchedTable.id;
    }
  }

  const firstStatement = options.find((option) => isSqlExecutionStatementOptionId(option.id));
  if (firstStatement) {
    return firstStatement.id;
  }
  const firstSubquery = options.find((option) => isSqlExecutionSubqueryOptionId(option.id));
  if (firstSubquery) {
    return firstSubquery.id;
  }
  return options[0]?.id || 'all';
};

export function resolveSqlExecutionIntent(input: {
  fullSql: string;
  selectedSql: string;
  cursorOffset: number;
  askWhatToExecute: boolean;
  dialect?: string;
}): SqlExecutionIntent {
  const selected = String(input.selectedSql || '').trim();
  if (selected) {
    return { kind: 'execute', sql: input.selectedSql };
  }

  if (!input.askWhatToExecute) {
    return { kind: 'use-auto' };
  }

  const text = String(input.fullSql || '').replace(/\r\n/g, '\n');
  const dialect = input.dialect || '';
  const tableSources = findSqlJoinTableSources(text, dialect);
  const subqueryRanges = findSqlSubqueryRanges(text, dialect)
    .filter((range) => range.text.trim() && hasExecutableSqlContent(range.text));
  const executableRanges = collectExecutableStatementRanges(text);
  const hasJoinTableChoices = tableSources.length >= 2;
  if (executableRanges.length < 2 && subqueryRanges.length === 0 && !hasJoinTableChoices) {
    if (executableRanges.length === 1) {
      return { kind: 'execute', sql: executableRanges[0].executableText };
    }

    // Spec expects "current statement" semantics even when cursor is outside of it (e.g. leading comments).
    // Still, pure comment/whitespace scripts should not execute.
    //
    // Note: our statement splitter can merge leading comments with the following statement. In that case,
    // prefer the executable statement text (without the comment prefix) when it can be resolved.
    const selection = resolveExecutableSql(text, input.cursorOffset, '');
    if (selection?.sql?.trim() && hasExecutableSqlContent(selection.sql)) {
      const stripped = stripLeadingSqlNoise(selection.sql);
      if (stripped.trim() && hasExecutableSqlContent(stripped)) {
        return { kind: 'execute', sql: stripped };
      }
      return { kind: 'execute', sql: selection.sql };
    }

    const current = resolveCurrentSqlStatementRange(text, input.cursorOffset);
    if (current?.text?.trim() && hasExecutableSqlContent(current.text)) {
      const stripped = stripLeadingSqlNoise(current.text);
      if (stripped.trim() && hasExecutableSqlContent(stripped)) {
        return { kind: 'execute', sql: stripped };
      }
      return { kind: 'execute', sql: current.text };
    }

    return { kind: 'empty' };
  }

  if (
    subqueryRanges.length === 0
    && !hasJoinTableChoices
    && !cursorLineHasExecutableSql(text, input.cursorOffset)
  ) {
    return { kind: 'empty' };
  }

  const options = buildSqlExecutionChooserOptions(text, input.cursorOffset, dialect);
  if (options.length === 0) {
    return { kind: 'empty' };
  }

  return {
    kind: 'chooser',
    options,
    defaultOptionId: resolveDefaultChooserOptionId(options, text, input.cursorOffset, dialect),
  };
}
