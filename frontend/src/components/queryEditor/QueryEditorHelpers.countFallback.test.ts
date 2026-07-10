import { beforeEach, describe, expect, it, vi } from 'vitest';

const backendApp = vi.hoisted(() => ({
  DBGetColumns: vi.fn(),
  DBGetIndexes: vi.fn(),
  DBQuery: vi.fn(),
}));

vi.mock('../../../wailsjs/go/app/App', () => backendApp);

vi.mock('../../utils/connectionRpcConfig', () => ({
  buildRpcConnectionConfig: (config: unknown) => config,
}));

import { resolveQueryLocatorPlan } from './QueryEditorHelpers';

describe('resolveQueryLocatorPlan MySQL COUNT fallback', () => {
  beforeEach(() => {
    backendApp.DBGetColumns.mockReset();
    backendApp.DBGetIndexes.mockReset();
    backendApp.DBQuery.mockReset();
  });

  it('enables editable count-where fallback for MySQL without PK/UK by default', async () => {
    backendApp.DBGetColumns.mockResolvedValue({
      success: true,
      data: [{ name: 'NAME', key: '' }],
    });
    backendApp.DBGetIndexes.mockResolvedValue({
      success: true,
      data: [],
    });

    const plan = await resolveQueryLocatorPlan({
      statement: 'SELECT NAME FROM sys_menu',
      dbType: 'mysql',
      currentDb: 'aml_schema',
      config: { type: 'mysql' },
      forceReadOnly: false,
    });

    expect(plan.editLocator).toMatchObject({
      strategy: 'none',
      readOnly: false,
      fallbackMode: 'count-where',
    });
    expect(plan.warning).toBeUndefined();
  });

  it('enables editable count-where fallback for PostgreSQL without PK/UK by default', async () => {
    backendApp.DBGetColumns.mockResolvedValue({
      success: true,
      data: [{ name: 'NAME', key: '' }],
    });
    backendApp.DBGetIndexes.mockResolvedValue({
      success: true,
      data: [],
    });

    const plan = await resolveQueryLocatorPlan({
      statement: 'SELECT NAME FROM sys_menu',
      dbType: 'postgres',
      currentDb: 'public',
      config: { type: 'postgres' },
      forceReadOnly: false,
    });

    expect(plan.editLocator).toMatchObject({
      strategy: 'none',
      readOnly: false,
      fallbackMode: 'count-where',
    });
    expect(plan.warning).toBeUndefined();
  });

  it('still enables COUNT fallback when index metadata fails', async () => {
    backendApp.DBGetColumns.mockResolvedValue({
      success: true,
      data: [{ name: 'NAME', key: '' }],
    });
    backendApp.DBGetIndexes.mockResolvedValue({
      success: false,
      data: [],
    });

    const plan = await resolveQueryLocatorPlan({
      statement: 'SELECT NAME FROM sys_menu',
      dbType: 'mysql',
      currentDb: 'aml_schema',
      config: { type: 'mysql' },
      forceReadOnly: false,
      allowCountFallback: true,
    });

    expect(plan.editLocator).toMatchObject({
      strategy: 'none',
      readOnly: false,
      fallbackMode: 'count-where',
    });
    expect(plan.warning).toBeUndefined();
  });

  it('keeps read-only when COUNT fallback is explicitly disabled', async () => {
    backendApp.DBGetColumns.mockResolvedValue({
      success: true,
      data: [{ name: 'NAME', key: '' }],
    });
    backendApp.DBGetIndexes.mockResolvedValue({
      success: true,
      data: [],
    });

    const plan = await resolveQueryLocatorPlan({
      statement: 'SELECT NAME FROM sys_menu',
      dbType: 'mysql',
      currentDb: 'aml_schema',
      config: { type: 'mysql' },
      forceReadOnly: false,
      allowCountFallback: false,
    });

    expect(plan.editLocator).toMatchObject({
      strategy: 'none',
      readOnly: true,
    });
    expect(plan.warning).toMatch(/read-only|只读/i);
  });

  it('waits for slow column metadata and keeps primary-key locator (no soft-timeout false read-only)', async () => {
    vi.useFakeTimers();
    try {
      backendApp.DBGetColumns.mockImplementation(() => new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            data: [
              { name: 'id', key: 'PRI' },
              { name: 'name', key: '' },
            ],
          });
        }, 3000);
      }));
      backendApp.DBGetIndexes.mockResolvedValue({
        success: true,
        data: [],
      });

      const planPromise = resolveQueryLocatorPlan({
        statement: 'SELECT id, name FROM public.rule_list_item',
        dbType: 'postgres',
        currentDb: 'public',
        config: { type: 'postgres' },
        forceReadOnly: false,
      });

      await vi.advanceTimersByTimeAsync(3000);
      const plan = await planPromise;

      expect(plan.editLocator).toMatchObject({
        strategy: 'primary-key',
        columns: ['id'],
        readOnly: false,
      });
      expect(plan.warning).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('falls back to count-where when column metadata fails but SELECT lists writable columns', async () => {
    backendApp.DBGetColumns.mockResolvedValue({
      success: false,
      message: 'connection reset',
      data: [],
    });
    backendApp.DBGetIndexes.mockResolvedValue({
      success: false,
      data: [],
    });

    const plan = await resolveQueryLocatorPlan({
      statement: 'SELECT id, name FROM public.rule_list_item',
      dbType: 'postgres',
      currentDb: 'public',
      config: { type: 'postgres' },
      forceReadOnly: false,
    });

    expect(plan.editLocator).toMatchObject({
      strategy: 'none',
      readOnly: false,
      fallbackMode: 'count-where',
    });
    expect(plan.warning).toBeUndefined();
  });
});
