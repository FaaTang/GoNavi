export interface SqlStatementRange {
  start: number;
  end: number;
  text: string;
}

export type SqlSubqueryDialect = 'mysql' | 'postgres' | string;

export type SqlExecutionSelectionSource = 'selection' | 'statement' | 'line';

export interface SqlExecutionSelection {
  sql: string;
  source: SqlExecutionSelectionSource;
}

const isWhitespace = (ch: string): boolean => (
  ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f'
);

const isHorizontalWhitespace = (ch: string): boolean => (
  ch === ' ' || ch === '\t' || ch === '\r' || ch === '\f'
);

const isSqlIdentifierStart = (ch: string): boolean => /^[A-Za-z_]$/.test(ch);

const isSqlIdentifierPart = (ch: string): boolean => /^[A-Za-z0-9_$#]$/.test(ch);

const skipSqlWhitespaceAndComments = (text: string, position: number): number => {
  let index = position;
  while (index < text.length) {
    const ch = text[index];
    const next = index + 1 < text.length ? text[index + 1] : '';
    if (isWhitespace(ch)) {
      index += 1;
      continue;
    }
    if (ch === '-' && next === '-') {
      index += 2;
      while (index < text.length && text[index] !== '\n') index += 1;
      continue;
    }
    if (ch === '#') {
      index += 1;
      while (index < text.length && text[index] !== '\n') index += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      index += 2;
      while (index + 1 < text.length && !(text[index] === '*' && text[index + 1] === '/')) {
        index += 1;
      }
      if (index + 1 < text.length) index += 2;
      continue;
    }
    break;
  }
  return index;
};

const nextSqlSignificantToken = (text: string, position: number): string => {
  const index = skipSqlWhitespaceAndComments(text, position);
  if (index >= text.length || !isSqlIdentifierStart(text[index])) return '';
  let end = index + 1;
  while (end < text.length && isSqlIdentifierPart(text[end])) end += 1;
  return text.slice(index, end).toLowerCase();
};

const nextSqlSignificantChar = (text: string, position: number): string => {
  const index = skipSqlWhitespaceAndComments(text, position);
  return index >= text.length ? '' : text[index];
};

const resolveStandaloneSqlSlashLineEnd = (text: string, index: number): number | null => {
  if (text[index] !== '/') return null;

  const lineStart = text.lastIndexOf('\n', Math.max(0, index - 1)) + 1;
  for (let pos = lineStart; pos < index; pos++) {
    if (!isHorizontalWhitespace(text[pos])) {
      return null;
    }
  }

  let lineEnd = index + 1;
  while (lineEnd < text.length && text[lineEnd] !== '\n') {
    if (text[lineEnd] === '-' && text[lineEnd + 1] === '-') {
      while (lineEnd < text.length && text[lineEnd] !== '\n') {
        lineEnd += 1;
      }
      return lineEnd;
    }
    if (!isHorizontalWhitespace(text[lineEnd])) {
      return null;
    }
    lineEnd += 1;
  }
  return lineEnd;
};

const shouldEnterPlsqlBeginBlock = (text: string, tokenEnd: number): boolean => {
  const nextChar = nextSqlSignificantChar(text, tokenEnd);
  if (!nextChar || nextChar === ';') return false;
  return !['transaction', 'work', 'isolation', 'read', 'write'].includes(nextSqlSignificantToken(text, tokenEnd));
};

const shouldEnterPlsqlDeclareBlock = (text: string, tokenEnd: number): boolean => Boolean(nextSqlSignificantToken(text, tokenEnd));

const nextSqlSignificantTokenSpan = (text: string, position: number): { token: string; end: number } => {
  const index = skipSqlWhitespaceAndComments(text, position);
  if (index >= text.length || !isSqlIdentifierStart(text[index])) {
    return { token: '', end: index };
  }
  let end = index + 1;
  while (end < text.length && isSqlIdentifierPart(text[end])) end += 1;
  return { token: text.slice(index, end).toLowerCase(), end };
};

const isCreateRoutineHeaderPrefix = (text: string): boolean => {
  let current = nextSqlSignificantTokenSpan(text, 0);
  if (current.token !== 'create') return false;

  current = nextSqlSignificantTokenSpan(text, current.end);
  if (current.token === 'or') {
    current = nextSqlSignificantTokenSpan(text, current.end);
    if (current.token !== 'replace') return false;
    current = nextSqlSignificantTokenSpan(text, current.end);
  }

  while (['editionable', 'noneditionable'].includes(current.token)) {
    current = nextSqlSignificantTokenSpan(text, current.end);
  }

  if (current.token === 'procedure' || current.token === 'function') {
    return true;
  }
  if (current.token !== 'package') {
    return false;
  }
  current = nextSqlSignificantTokenSpan(text, current.end);
  return current.token === '' || current.token === 'body' || isSqlIdentifierStart(current.token[0] || '');
};

const isCreatePackageHeaderPrefix = (text: string): boolean => {
  let current = nextSqlSignificantTokenSpan(text, 0);
  if (current.token !== 'create') return false;

  current = nextSqlSignificantTokenSpan(text, current.end);
  if (current.token === 'or') {
    current = nextSqlSignificantTokenSpan(text, current.end);
    if (current.token !== 'replace') return false;
    current = nextSqlSignificantTokenSpan(text, current.end);
  }

  while (['editionable', 'noneditionable'].includes(current.token)) {
    current = nextSqlSignificantTokenSpan(text, current.end);
  }

  return current.token === 'package';
};

const shouldEnterPlsqlCreateRoutineBlock = (
  text: string,
  statementStart: number,
  token: string,
  tokenEnd: number,
): boolean => {
  if (token !== 'is' && token !== 'as') return false;
  const nextChar = nextSqlSignificantChar(text, tokenEnd);
  if (!nextChar) return false;
  if (token === 'as' && (nextChar === '$' || nextChar === "'" || nextChar === '"')) {
    return false;
  }
  return isCreateRoutineHeaderPrefix(text.slice(statementStart, tokenEnd - token.length));
};

const isPlsqlControlEnd = (text: string, tokenEnd: number): boolean => (
  ['if', 'loop', 'case'].includes(nextSqlSignificantToken(text, tokenEnd))
);

const trimStatementRange = (sql: string, start: number, end: number): SqlStatementRange | null => {
  let nextStart = Math.max(0, start);
  let nextEnd = Math.min(sql.length, Math.max(start, end));

  while (nextStart < nextEnd && isWhitespace(sql[nextStart])) {
    nextStart++;
  }
  while (nextEnd > nextStart && isWhitespace(sql[nextEnd - 1])) {
    nextEnd--;
  }

  if (nextStart >= nextEnd) {
    return null;
  }

  return {
    start: nextStart,
    end: nextEnd,
    text: sql.slice(nextStart, nextEnd),
  };
};

export const findSqlStatementRanges = (sql: string): SqlStatementRange[] => {
  const text = String(sql || '').replace(/\r\n/g, '\n');
  const ranges: SqlStatementRange[] = [];

  let statementStart = 0;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarTag: string | null = null;
  let plsqlDepth = 0;
  let plsqlDeclareBeginSkips = 0;
  let plsqlCaseDepth = 0;
  let skipNextPlsqlCaseEndToken = false;
  let justClosedPLSQLBlock = false;

  const push = (end: number) => {
    const range = trimStatementRange(text, statementStart, end);
    if (range) {
      ranges.push(range);
    }
  };

  for (let index = 0; index < text.length; index++) {
    const ch = text[index];
    const next = index + 1 < text.length ? text[index + 1] : '';
    const prev = index > 0 ? text[index - 1] : '';
    const next2 = index + 2 < text.length ? text[index + 2] : '';

    if (dollarTag) {
      if (text.startsWith(dollarTag, index)) {
        index += dollarTag.length - 1;
        dollarTag = null;
      }
      continue;
    }

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        index++;
        inBlockComment = false;
      }
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick) {
      if (ch === '/' && next === '*') {
        index++;
        inBlockComment = true;
        continue;
      }
      if ((justClosedPLSQLBlock || !text.slice(statementStart, index).trim()) && ch === '/') {
        const slashLineEnd = resolveStandaloneSqlSlashLineEnd(text, index);
        if (slashLineEnd !== null) {
          push(index);
          statementStart = slashLineEnd < text.length && text[slashLineEnd] === '\n'
            ? slashLineEnd + 1
            : slashLineEnd;
          index = slashLineEnd;
          justClosedPLSQLBlock = false;
          continue;
        }
      }
      if (ch === '#') {
        inLineComment = true;
        continue;
      }
      if (ch === '-' && next === '-' && (index === 0 || isWhitespace(prev)) && (next2 === '' || isWhitespace(next2))) {
        index++;
        inLineComment = true;
        continue;
      }
      if (ch === '$') {
        const match = text.slice(index).match(/^\$[A-Za-z0-9_]*\$/);
        if (match?.[0]) {
          dollarTag = match[0];
          index += dollarTag.length - 1;
          continue;
        }
      }
    }

    if (escaped) {
      escaped = false;
      continue;
    }

    if ((inSingle || inDouble) && ch === '\\') {
      escaped = true;
      continue;
    }

    if (!inDouble && !inBacktick && ch === "'") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && !inBacktick && ch === '"') {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && ch === '`') {
      inBacktick = !inBacktick;
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick && !dollarTag && isSqlIdentifierStart(ch)) {
      let tokenEnd = index + 1;
      while (tokenEnd < text.length && isSqlIdentifierPart(text[tokenEnd])) {
        tokenEnd++;
      }
      const token = text.slice(index, tokenEnd).toLowerCase();
      if (token === 'case' && plsqlDepth > 0) {
        if (skipNextPlsqlCaseEndToken) {
          skipNextPlsqlCaseEndToken = false;
        } else {
          plsqlCaseDepth++;
          justClosedPLSQLBlock = false;
        }
      } else if (token !== 'case') {
        skipNextPlsqlCaseEndToken = false;
      }
      if (token === 'begin' && plsqlDeclareBeginSkips > 0) {
        plsqlDeclareBeginSkips--;
        justClosedPLSQLBlock = false;
      } else if (token === 'begin' && shouldEnterPlsqlBeginBlock(text, tokenEnd)) {
        plsqlDepth++;
        justClosedPLSQLBlock = false;
      } else if (token === 'declare' && shouldEnterPlsqlDeclareBlock(text, tokenEnd)) {
        plsqlDepth++;
        plsqlDeclareBeginSkips++;
        justClosedPLSQLBlock = false;
      } else if (plsqlDepth === 0 && shouldEnterPlsqlCreateRoutineBlock(text, statementStart, token, tokenEnd)) {
        plsqlDepth++;
        if (!isCreatePackageHeaderPrefix(text.slice(statementStart, tokenEnd - token.length))) {
          plsqlDeclareBeginSkips++;
        }
        justClosedPLSQLBlock = false;
      } else if (token === 'end' && plsqlDepth > 0 && plsqlCaseDepth > 0) {
        plsqlCaseDepth--;
        if (nextSqlSignificantToken(text, tokenEnd) === 'case') {
          skipNextPlsqlCaseEndToken = true;
        }
        justClosedPLSQLBlock = false;
      } else if (token === 'end' && plsqlDepth > 0 && !isPlsqlControlEnd(text, tokenEnd)) {
        plsqlDepth--;
        if (plsqlDeclareBeginSkips > plsqlDepth) {
          plsqlDeclareBeginSkips = plsqlDepth;
        }
        if (plsqlCaseDepth > plsqlDepth) {
          plsqlCaseDepth = plsqlDepth;
        }
        justClosedPLSQLBlock = plsqlDepth === 0;
      }
      index = tokenEnd - 1;
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick && (ch === ';' || ch === '；')) {
      if (plsqlDepth > 0) {
        continue;
      }
      push(justClosedPLSQLBlock ? index + 1 : index);
      statementStart = index + 1;
      justClosedPLSQLBlock = false;
      continue;
    }
  }

  push(text.length);
  return ranges;
};

export const resolveCurrentSqlStatementRange = (sql: string, cursorOffset: number): SqlStatementRange | null => {
  const text = String(sql || '').replace(/\r\n/g, '\n');
  const offset = Math.max(0, Math.min(text.length, Number.isFinite(cursorOffset) ? cursorOffset : 0));
  const ranges = findSqlStatementRanges(text);
  if (ranges.length === 0) {
    return null;
  }

  const containingRange = ranges.find((range) => offset >= range.start && offset <= range.end);
  if (containingRange) {
    return containingRange;
  }

  for (let i = 0; i < ranges.length; i += 1) {
    const current = ranges[i];
    const next = ranges[i + 1];
    if (!next) {
      if (offset > current.end) {
        const tail = text.slice(current.end, offset);
        if (tail.trim() === '') {
          return current;
        }
      }
      break;
    }
    if (offset > current.end && offset < next.start) {
      const lineEndAfterCurrent = text.indexOf('\n', current.end);
      const sameLineEnd = lineEndAfterCurrent === -1 ? text.length : lineEndAfterCurrent;
      if (offset <= sameLineEnd) {
        return current;
      }
      const gap = text.slice(current.end, next.start);
      if (gap.includes('\n\n')) {
        const leadingIntoNext = text.slice(offset, next.start);
        if (leadingIntoNext.trim() === '') {
          return next;
        }
        return null;
      }
      return current;
    }
  }

  const nextRange = ranges.find((range) => offset < range.start);
  if (nextRange) {
    const leading = text.slice(0, nextRange.start);
    if (leading.trim() === '') {
      return nextRange;
    }
    return null;
  }

  return ranges[ranges.length - 1];
};

const isMysqlSubqueryDialect = (dialect: SqlSubqueryDialect): boolean => (
  ['mysql', 'mariadb', 'oceanbase', 'diros', 'starrocks', 'sphinx', 'tidb']
    .includes(String(dialect || '').trim().toLowerCase())
);

const isPostgresSubqueryDialect = (dialect: SqlSubqueryDialect): boolean => (
  ['postgres', 'postgresql', 'kingbase', 'highgo', 'vastbase', 'opengauss', 'gaussdb']
    .includes(String(dialect || '').trim().toLowerCase())
);

export interface SqlJoinTableSourceRange extends SqlStatementRange {
  /** Qualified table reference as written in SQL (quotes preserved). */
  tableRef: string;
  /** Executable probe query for this table. */
  executableSql: string;
}

const FROM_CLAUSE_TERMINATORS = new Set([
  'where', 'group', 'order', 'having', 'limit', 'offset', 'fetch', 'window',
  'union', 'except', 'intersect', 'minus', 'for', 'into', 'returning', 'start',
  'connect', 'qualify', 'settings',
]);

const JOIN_PREFIX_KEYWORDS = new Set([
  'inner', 'left', 'right', 'full', 'cross', 'outer', 'natural', 'lateral', 'straight_join',
]);

const skipSqlTrivia = (
  text: string,
  position: number,
  options: { mysqlLike: boolean; postgresLike: boolean },
): number => {
  let index = position;
  while (index < text.length) {
    const ch = text[index];
    const next = index + 1 < text.length ? text[index + 1] : '';
    if (isWhitespace(ch)) {
      index += 1;
      continue;
    }
    if (ch === '-' && next === '-' && (
      options.postgresLike || index + 2 >= text.length || isWhitespace(text[index + 2])
    )) {
      index += 2;
      while (index < text.length && text[index] !== '\n') index += 1;
      continue;
    }
    if (options.mysqlLike && ch === '#') {
      index += 1;
      while (index < text.length && text[index] !== '\n') index += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      index += 2;
      while (index + 1 < text.length && !(text[index] === '*' && text[index + 1] === '/')) {
        index += 1;
      }
      if (index + 1 < text.length) index += 2;
      continue;
    }
    break;
  }
  return index;
};

const readSqlQuotedIdentifier = (
  text: string,
  position: number,
  quote: "'" | '"' | '`',
): { end: number; value: string } | null => {
  if (text[position] !== quote) return null;
  let index = position + 1;
  while (index < text.length) {
    const ch = text[index];
    if (ch === quote) {
      if (text[index + 1] === quote) {
        index += 2;
        continue;
      }
      return { end: index + 1, value: text.slice(position, index + 1) };
    }
    if (ch === '\\') {
      index += 2;
      continue;
    }
    index += 1;
  }
  return null;
};

const readSqlIdentifierPart = (
  text: string,
  position: number,
  options: { mysqlLike: boolean; postgresLike: boolean },
): { end: number; value: string } | null => {
  const index = skipSqlTrivia(text, position, options);
  if (index >= text.length) return null;
  const ch = text[index];
  if (options.mysqlLike && ch === '`') {
    return readSqlQuotedIdentifier(text, index, '`');
  }
  if ((options.postgresLike || !options.mysqlLike) && ch === '"') {
    return readSqlQuotedIdentifier(text, index, '"');
  }
  if (!isSqlIdentifierStart(ch)) return null;
  let end = index + 1;
  while (end < text.length && isSqlIdentifierPart(text[end])) end += 1;
  return { end, value: text.slice(index, end) };
};

const readSqlQualifiedTableRef = (
  text: string,
  position: number,
  options: { mysqlLike: boolean; postgresLike: boolean },
): SqlJoinTableSourceRange | null => {
  const first = readSqlIdentifierPart(text, position, options);
  if (!first) return null;
  const token = first.value.replace(/^[`"]|[`"]$/g, '').toLowerCase();
  if ([
    'select', 'with', 'values', 'lateral', 'unnest', 'jsonb_each', 'json_each',
    'generate_series', 'table', 'only', 'rows', 'xmltable',
  ].includes(token)) {
    return null;
  }

  let end = first.end;
  const parts = [first.value];
  while (true) {
    const dotPos = skipSqlTrivia(text, end, options);
    if (text[dotPos] !== '.') break;
    const next = readSqlIdentifierPart(text, dotPos + 1, options);
    if (!next) break;
    parts.push(next.value);
    end = next.end;
  }

  const tableRef = parts.join('.');
  const start = skipSqlTrivia(text, position, options);
  return {
    start,
    end,
    text: tableRef,
    tableRef,
    executableSql: `SELECT * FROM ${tableRef}`,
  };
};

/**
 * Finds physical table sources from top-level FROM / JOIN / comma-join lists.
 * Derived tables `(SELECT ...)` are ignored here; use findSqlSubqueryRanges for those.
 */
export const findSqlJoinTableSources = (
  sql: string,
  dialect: SqlSubqueryDialect,
): SqlJoinTableSourceRange[] => {
  const mysqlLike = isMysqlSubqueryDialect(dialect);
  const postgresLike = isPostgresSubqueryDialect(dialect);
  if (!mysqlLike && !postgresLike) {
    return [];
  }

  const text = String(sql || '').replace(/\r\n/g, '\n');
  const options = { mysqlLike, postgresLike };
  const sources: SqlJoinTableSourceRange[] = [];
  const seen = new Set<string>();

  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarTag: string | null = null;
  let parenDepth = 0;
  let inFromClause = false;
  let expectTable = false;

  const pushSource = (source: SqlJoinTableSourceRange | null) => {
    if (!source) return;
    const key = source.tableRef.replace(/[`"]/g, '').toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    sources.push(source);
  };

  const tryConsumeTable = (fromIndex: number): number => {
    const start = skipSqlTrivia(text, fromIndex, options);
    if (start >= text.length) return fromIndex;
    if (text[start] === '(') {
      return fromIndex;
    }
    const onlyToken = nextSqlSignificantToken(text, start);
    let tableStart = start;
    if (onlyToken === 'only') {
      const onlySpan = nextSqlSignificantTokenSpan(text, start);
      tableStart = onlySpan.end;
    }
    const source = readSqlQualifiedTableRef(text, tableStart, options);
    if (!source) return fromIndex;
    pushSource(source);
    return source.end;
  };

  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    const next = index + 1 < text.length ? text[index + 1] : '';

    if (dollarTag) {
      if (text.startsWith(dollarTag, index)) {
        index += dollarTag.length - 1;
        dollarTag = null;
      }
      continue;
    }
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        index += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick) {
      if (ch === '/' && next === '*') {
        index += 1;
        inBlockComment = true;
        continue;
      }
      if (ch === '-' && next === '-' && (
        postgresLike || index + 2 >= text.length || isWhitespace(text[index + 2])
      )) {
        index += 1;
        inLineComment = true;
        continue;
      }
      if (mysqlLike && ch === '#') {
        inLineComment = true;
        continue;
      }
      if (postgresLike && ch === '$') {
        const match = text.slice(index).match(/^\$[A-Za-z0-9_]*\$/);
        if (match?.[0]) {
          dollarTag = match[0];
          index += dollarTag.length - 1;
          continue;
        }
      }
    }

    if (escaped) {
      escaped = false;
      continue;
    }
    if ((inSingle || inDouble || inBacktick) && ch === '\\') {
      escaped = true;
      continue;
    }

    if (
      expectTable
      && inFromClause
      && parenDepth === 0
      && !inSingle
      && !inDouble
      && !inBacktick
      && (ch === '`' || ch === '"' || isSqlIdentifierStart(ch))
    ) {
      const onlyToken = nextSqlSignificantToken(text, index);
      if (!(JOIN_PREFIX_KEYWORDS.has(onlyToken) && onlyToken !== 'straight_join')) {
        const consumedEnd = tryConsumeTable(index);
        expectTable = false;
        if (consumedEnd > index) {
          index = consumedEnd - 1;
          continue;
        }
      }
    }

    if (!inDouble && !inBacktick && ch === "'") {
      if (inSingle && next === "'") {
        index += 1;
      } else {
        inSingle = !inSingle;
      }
      continue;
    }
    if (!inSingle && !inBacktick && ch === '"') {
      if (inDouble && next === '"') {
        index += 1;
      } else {
        inDouble = !inDouble;
      }
      continue;
    }
    if (mysqlLike && !inSingle && !inDouble && ch === '`') {
      if (inBacktick && next === '`') {
        index += 1;
      } else {
        inBacktick = !inBacktick;
      }
      continue;
    }
    if (inSingle || inDouble || inBacktick) {
      continue;
    }

    if (ch === '(') {
      if (expectTable && parenDepth === 0) {
        expectTable = false;
      }
      parenDepth += 1;
      continue;
    }
    if (ch === ')') {
      if (parenDepth > 0) parenDepth -= 1;
      continue;
    }

    if (parenDepth !== 0) {
      continue;
    }

    if ((ch === ';' || ch === '；')) {
      inFromClause = false;
      expectTable = false;
      continue;
    }

    if (inFromClause && ch === ',') {
      expectTable = true;
      continue;
    }

    if (!isSqlIdentifierStart(ch)) {
      continue;
    }

    let tokenEnd = index + 1;
    while (tokenEnd < text.length && isSqlIdentifierPart(text[tokenEnd])) {
      tokenEnd += 1;
    }
    const token = text.slice(index, tokenEnd).toLowerCase();

    if (token === 'from') {
      inFromClause = true;
      expectTable = true;
      index = tokenEnd - 1;
      continue;
    }

    if (token === 'join' || token === 'straight_join') {
      inFromClause = true;
      expectTable = true;
      index = tokenEnd - 1;
      continue;
    }

    if (inFromClause && FROM_CLAUSE_TERMINATORS.has(token)) {
      inFromClause = false;
      expectTable = false;
      index = tokenEnd - 1;
      continue;
    }

    if (inFromClause && expectTable && JOIN_PREFIX_KEYWORDS.has(token) && token !== 'straight_join') {
      index = tokenEnd - 1;
      continue;
    }

    index = tokenEnd - 1;
  }

  if (expectTable) {
    tryConsumeTable(text.length);
  }

  return sources;
};

/**
 * Finds every parenthesized SELECT/WITH subquery in document order.
 * Ranges exclude the surrounding parentheses so they can be executed directly.
 */
export const findSqlSubqueryRanges = (
  sql: string,
  dialect: SqlSubqueryDialect,
): SqlStatementRange[] => {
  const mysqlLike = isMysqlSubqueryDialect(dialect);
  const postgresLike = isPostgresSubqueryDialect(dialect);
  if (!mysqlLike && !postgresLike) {
    return [];
  }

  const text = String(sql || '').replace(/\r\n/g, '\n');
  const openParentheses: number[] = [];
  const ranges: SqlStatementRange[] = [];
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarTag: string | null = null;

  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    const next = index + 1 < text.length ? text[index + 1] : '';

    if (dollarTag) {
      if (text.startsWith(dollarTag, index)) {
        index += dollarTag.length - 1;
        dollarTag = null;
      }
      continue;
    }
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        index += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick) {
      if (ch === '/' && next === '*') {
        index += 1;
        inBlockComment = true;
        continue;
      }
      if (ch === '-' && next === '-' && (
        postgresLike || index + 2 >= text.length || isWhitespace(text[index + 2])
      )) {
        index += 1;
        inLineComment = true;
        continue;
      }
      if (mysqlLike && ch === '#') {
        inLineComment = true;
        continue;
      }
      if (postgresLike && ch === '$') {
        const match = text.slice(index).match(/^\$[A-Za-z0-9_]*\$/);
        if (match?.[0]) {
          dollarTag = match[0];
          index += dollarTag.length - 1;
          continue;
        }
      }
    }

    if (escaped) {
      escaped = false;
      continue;
    }
    if ((inSingle || inDouble || inBacktick) && ch === '\\') {
      escaped = true;
      continue;
    }
    if (!inDouble && !inBacktick && ch === "'") {
      if (inSingle && next === "'") {
        index += 1;
      } else {
        inSingle = !inSingle;
      }
      continue;
    }
    if (!inSingle && !inBacktick && ch === '"') {
      if (inDouble && next === '"') {
        index += 1;
      } else {
        inDouble = !inDouble;
      }
      continue;
    }
    if (mysqlLike && !inSingle && !inDouble && ch === '`') {
      if (inBacktick && next === '`') {
        index += 1;
      } else {
        inBacktick = !inBacktick;
      }
      continue;
    }
    if (inSingle || inDouble || inBacktick) {
      continue;
    }

    if (ch === '(') {
      openParentheses.push(index);
      continue;
    }
    if (ch !== ')' || openParentheses.length === 0) {
      continue;
    }

    const open = openParentheses.pop()!;
    const range = trimStatementRange(text, open + 1, index);
    if (!range) {
      continue;
    }
    const firstToken = nextSqlSignificantToken(range.text, 0);
    if (firstToken === 'select' || firstToken === 'with') {
      ranges.push(range);
    }
  }

  return ranges.sort((left, right) => (
    left.start - right.start || left.end - right.end
  ));
};

/**
 * Resolves the innermost parenthesized SELECT/WITH query containing the cursor
 * from the full subquery catalog produced by findSqlSubqueryRanges.
 */
export const resolveEnclosingSqlSubqueryRange = (
  sql: string,
  cursorOffset: number,
  dialect: SqlSubqueryDialect,
): SqlStatementRange | null => {
  const text = String(sql || '').replace(/\r\n/g, '\n');
  const offset = Math.max(0, Math.min(text.length, Number.isFinite(cursorOffset) ? cursorOffset : 0));
  return findSqlSubqueryRanges(text, dialect).reduce<SqlStatementRange | null>((innermost, candidate) => {
    if (offset < candidate.start || offset > candidate.end) {
      return innermost;
    }
    if (!innermost || candidate.end - candidate.start < innermost.end - innermost.start) {
      return candidate;
    }
    return innermost;
  }, null);
};

export const resolveExecutableSql = (
  sql: string,
  cursorOffset: number,
  selectedSql = '',
): SqlExecutionSelection | null => {
  const selected = String(selectedSql || '').trim();
  if (selected) {
    return { sql: selectedSql, source: 'selection' };
  }

  const text = String(sql || '').replace(/\r\n/g, '\n');
  const offset = Math.max(0, Math.min(text.length, Number.isFinite(cursorOffset) ? cursorOffset : 0));
  const ranges = findSqlStatementRanges(text);
  const statement = ranges.find((range) => offset >= range.start && offset <= range.end);
  if (statement?.text.trim()) {
    return { sql: statement.text, source: 'statement' };
  }

  const lineStart = text.lastIndexOf('\n', Math.max(0, offset - 1)) + 1;
  const nextLineBreak = text.indexOf('\n', offset);
  const lineEnd = nextLineBreak === -1 ? text.length : nextLineBreak;
  const line = text.slice(lineStart, lineEnd).trim();
  if (line) {
    const lineStatement = [...ranges].reverse().find((range) => range.start < lineEnd && range.end >= lineStart);
    if (lineStatement?.text.trim()) {
      return { sql: lineStatement.text, source: 'statement' };
    }
  }
  if (line) {
    return { sql: line, source: 'line' };
  }

  return null;
};
