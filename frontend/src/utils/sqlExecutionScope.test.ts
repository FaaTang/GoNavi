import { describe, expect, it } from 'vitest';

import { buildSqlExecutionChooserOptions, resolveSqlExecutionIntent } from './sqlExecutionScope';

describe('sqlExecutionScope', () => {
  it('offers the MySQL subquery and current statement for a single statement', () => {
    const sql = 'SELECT * FROM (SELECT id FROM `users` WHERE active = 1) active_users';
    const intent = resolveSqlExecutionIntent({
      fullSql: sql,
      selectedSql: '',
      cursorOffset: sql.indexOf('active = 1'),
      askWhatToExecute: true,
      dialect: 'mysql',
    });

    expect(intent.kind).toBe('chooser');
    if (intent.kind !== 'chooser') return;
    expect(intent.defaultOptionId).toBe('subquery-0');
    expect(intent.options.map((option) => option.id)).toEqual(['statement-0', 'subquery-0']);
    expect(intent.options[1].sql).toBe('SELECT id FROM `users` WHERE active = 1');
  });

  it('lists every nested subquery even when the cursor is outside them', () => {
    const sql = [
      'SELECT *',
      'FROM (',
      '  SELECT id FROM (SELECT id FROM users WHERE active = 1) nested',
      ') outer_query',
    ].join('\n');
    const options = buildSqlExecutionChooserOptions(sql, sql.indexOf('SELECT *'), 'mysql');

    expect(options.map((option) => option.id)).toEqual(['statement-0', 'subquery-0', 'subquery-1']);
    expect(options[1].sql).toBe('SELECT id FROM (SELECT id FROM users WHERE active = 1) nested');
    expect(options[2].sql).toBe('SELECT id FROM users WHERE active = 1');

    const intent = resolveSqlExecutionIntent({
      fullSql: sql,
      selectedSql: '',
      cursorOffset: sql.indexOf('SELECT *'),
      askWhatToExecute: true,
      dialect: 'mysql',
    });
    expect(intent.kind).toBe('chooser');
    if (intent.kind !== 'chooser') return;
    expect(intent.defaultOptionId).toBe('statement-0');
  });

  it('defaults to the innermost enclosing subquery when the cursor is inside nested queries', () => {
    const sql = [
      'SELECT *',
      'FROM (',
      '  SELECT id FROM (SELECT id FROM users WHERE active = 1) nested',
      ') outer_query',
    ].join('\n');
    const intent = resolveSqlExecutionIntent({
      fullSql: sql,
      selectedSql: '',
      cursorOffset: sql.indexOf('active = 1'),
      askWhatToExecute: true,
      dialect: 'mysql',
    });

    expect(intent.kind).toBe('chooser');
    if (intent.kind !== 'chooser') return;
    expect(intent.defaultOptionId).toBe('subquery-1');
    expect(intent.options.find((option) => option.id === 'subquery-1')?.sql)
      .toBe('SELECT id FROM users WHERE active = 1');
  });

  it('lists every statement plus subqueries and all-statements for multi-statement scripts', () => {
    const sql = [
      'SELECT EXISTS (SELECT 1 FROM audit_log WHERE success);',
      'SELECT 2;',
      'SELECT 3;',
    ].join('\n');
    const options = buildSqlExecutionChooserOptions(sql, sql.indexOf('SELECT 2'), 'postgres');

    expect(options.map((option) => option.id)).toEqual([
      'statement-0',
      'statement-1',
      'statement-2',
      'subquery-0',
      'all',
    ]);
    expect(options[0].sql).toBe('SELECT EXISTS (SELECT 1 FROM audit_log WHERE success)');
    expect(options[1].sql).toBe('SELECT 2');
    expect(options[2].sql).toBe('SELECT 3');
    expect(options[3].sql).toBe('SELECT 1 FROM audit_log WHERE success');
    expect(options[4].statementCount).toBe(3);

    const intent = resolveSqlExecutionIntent({
      fullSql: sql,
      selectedSql: '',
      cursorOffset: sql.indexOf('SELECT 2'),
      askWhatToExecute: true,
      dialect: 'postgres',
    });
    expect(intent.kind).toBe('chooser');
    if (intent.kind !== 'chooser') return;
    expect(intent.defaultOptionId).toBe('statement-1');
  });

  it('offers per-table probes for join queries', () => {
    const sql = [
      'SELECT u.id, o.amount',
      'FROM users u',
      'JOIN orders o ON u.id = o.user_id',
    ].join('\n');
    const intent = resolveSqlExecutionIntent({
      fullSql: sql,
      selectedSql: '',
      cursorOffset: sql.indexOf('JOIN'),
      askWhatToExecute: true,
      dialect: 'mysql',
    });

    expect(intent.kind).toBe('chooser');
    if (intent.kind !== 'chooser') return;
    expect(intent.options.map((option) => option.id)).toEqual([
      'statement-0',
      'table-0',
      'table-1',
    ]);
    expect(intent.options[1]).toMatchObject({
      tableName: 'users',
      sql: 'SELECT * FROM users',
      highlightStart: sql.indexOf('users'),
      highlightEnd: sql.indexOf('users') + 'users'.length,
    });
    expect(intent.options[2]).toMatchObject({
      tableName: 'orders',
      sql: 'SELECT * FROM orders',
      highlightStart: sql.indexOf('orders'),
      highlightEnd: sql.indexOf('orders') + 'orders'.length,
    });
    expect(intent.defaultOptionId).toBe('statement-0');
  });

  it('highlights only the table name for per-table probe options', () => {
    const sql = 'select * from t_channel_oppwa_auth_req JOIN SELECT * from t_channel_nuvei_auth_req';
    const options = buildSqlExecutionChooserOptions(sql, 0, 'mysql');
    const first = options.find((option) => option.id === 'table-0');
    const second = options.find((option) => option.id === 'table-1');

    expect(first).toMatchObject({
      sql: 'SELECT * FROM t_channel_oppwa_auth_req',
      highlightStart: sql.indexOf('t_channel_oppwa_auth_req'),
      highlightEnd: sql.indexOf('t_channel_oppwa_auth_req') + 't_channel_oppwa_auth_req'.length,
    });
    expect(sql.slice(first!.highlightStart, first!.highlightEnd))
      .toBe('t_channel_oppwa_auth_req');
    expect(sql.slice(second!.highlightStart, second!.highlightEnd))
      .toBe('t_channel_nuvei_auth_req');
  });

  it('keeps explicit selection precedence over subquery detection', () => {
    const sql = 'SELECT * FROM (SELECT id FROM users) nested';

    expect(resolveSqlExecutionIntent({
      fullSql: sql,
      selectedSql: 'SELECT 42',
      cursorOffset: sql.indexOf('id'),
      askWhatToExecute: true,
      dialect: 'postgres',
    })).toEqual({ kind: 'execute', sql: 'SELECT 42' });
  });

  it('does not add a subquery option for unsupported dialects', () => {
    const sql = 'SELECT * FROM (SELECT id FROM users) nested';
    const intent = resolveSqlExecutionIntent({
      fullSql: sql,
      selectedSql: '',
      cursorOffset: sql.indexOf('id'),
      askWhatToExecute: true,
      dialect: 'oracle',
    });

    expect(intent).toEqual({ kind: 'execute', sql });
  });
});
