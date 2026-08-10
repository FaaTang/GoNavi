import { describe, expect, it } from 'vitest';

import {
  resolveSidebarNodeDatabaseName,
  resolveSidebarScrollContextCrumbs,
  isSidebarTreeKeyForConnection,
} from './sidebarV2Utils';

describe('sidebar scroll context crumbs', () => {
  const connections = [{ id: 'conn-1', name: '本地' }];
  const treeData = [
    {
      key: 'conn-1',
      type: 'connection',
      title: '本地',
      dataRef: { id: 'conn-1', name: '本地' },
      children: [
        {
          key: 'conn-1-app_db',
          type: 'database',
          title: 'app_db',
          dataRef: { id: 'conn-1', dbName: 'app_db' },
          children: [
            {
              key: 'conn-1-app_db-tables',
              type: 'object-group',
              title: '表',
              dataRef: { id: 'conn-1', dbName: 'app_db', groupKey: 'tables' },
              children: [
                {
                  key: 'conn-1-app_db-users',
                  type: 'table',
                  title: 'users',
                  dataRef: { id: 'conn-1', dbName: 'app_db', tableName: 'users' },
                },
              ],
            },
          ],
        },
      ],
    },
  ] as any;

  it('resolves database name from database and descendant nodes', () => {
    expect(resolveSidebarNodeDatabaseName({
      type: 'database',
      title: 'app_db',
      dataRef: { dbName: 'app_db' },
    })).toBe('app_db');
    expect(resolveSidebarNodeDatabaseName({
      type: 'table',
      title: 'users',
      dataRef: { dbName: 'app_db', tableName: 'users' },
    })).toBe('app_db');
    expect(resolveSidebarNodeDatabaseName({
      type: 'connection',
      title: '本地',
      dataRef: { id: 'conn-1' },
    })).toBe('');
  });

  it('matches tree keys that belong to a connection', () => {
    expect(isSidebarTreeKeyForConnection('conn-1', 'conn-1')).toBe(true);
    expect(isSidebarTreeKeyForConnection('conn-1-app_db-users', 'conn-1')).toBe(true);
    expect(isSidebarTreeKeyForConnection('conn-2', 'conn-1')).toBe(false);
    expect(isSidebarTreeKeyForConnection('conn-11-app_db', 'conn-1')).toBe(false);
  });

  it('shows only connection when database node itself is still visible', () => {
    expect(resolveSidebarScrollContextCrumbs({
      visibleNodeKeys: ['conn-1-app_db', 'conn-1-app_db-tables'],
      treeData,
      connectionIds: ['conn-1'],
      connections,
    })).toEqual({
      connectionId: 'conn-1',
      connectionName: '本地',
      dbName: 'app_db',
      showConnection: true,
      showDatabase: false,
    });
  });

  it('prefers the selected visible node over the topmost viewport node', () => {
    const multiConnectionTree = [
      {
        key: 'dev-aml-83',
        type: 'connection',
        title: 'dev-aml-83',
        dataRef: { id: 'dev-aml-83', name: 'dev-aml-83' },
      },
      {
        key: 'pro-aml-212',
        type: 'connection',
        title: 'pro-aml-212',
        dataRef: { id: 'pro-aml-212', name: 'pro-aml-212' },
        children: [
          {
            key: 'pro-aml-212-aml_schema',
            type: 'database',
            title: 'aml_schema',
            dataRef: { id: 'pro-aml-212', dbName: 'aml_schema' },
            children: [
              {
                key: 'pro-aml-212-aml_schema-customer_kyc_verify',
                type: 'table',
                title: 'customer.customer_kyc_verify',
                dataRef: {
                  id: 'pro-aml-212',
                  dbName: 'aml_schema',
                  tableName: 'public.customer_kyc_verify',
                },
              },
            ],
          },
        ],
      },
    ] as any;

    expect(resolveSidebarScrollContextCrumbs({
      visibleNodeKeys: [
        'dev-aml-83',
        'pro-aml-212-aml_schema-customer_kyc_verify',
      ],
      treeData: multiConnectionTree,
      connectionIds: ['dev-aml-83', 'pro-aml-212'],
      connections: [
        { id: 'dev-aml-83', name: 'dev-aml-83' },
        { id: 'pro-aml-212', name: 'pro-aml-212' },
      ],
      preferredVisibleKey: 'pro-aml-212-aml_schema-customer_kyc_verify',
    })).toEqual({
      connectionId: 'pro-aml-212',
      connectionName: 'pro-aml-212',
      dbName: 'aml_schema',
      showConnection: true,
      showDatabase: true,
    });
  });

  it('shows only connection when schema groups are still visible', () => {
    const withSchema = [
      {
        key: 'conn-1',
        type: 'connection',
        title: '本地',
        dataRef: { id: 'conn-1', name: '本地' },
        children: [
          {
            key: 'conn-1-app_db',
            type: 'database',
            title: 'app_db',
            dataRef: { id: 'conn-1', dbName: 'app_db' },
            children: [
              {
                key: 'conn-1-app_db-schema-va',
                type: 'object-group',
                title: 'va_schema',
                dataRef: { id: 'conn-1', dbName: 'app_db', groupKey: 'schema', schemaName: 'va_schema' },
                children: [
                  {
                    key: 'conn-1-app_db-tables',
                    type: 'object-group',
                    title: '表',
                    dataRef: { id: 'conn-1', dbName: 'app_db', groupKey: 'tables', schemaName: 'va_schema' },
                    children: [
                      {
                        key: 'conn-1-app_db-users',
                        type: 'table',
                        title: 'users',
                        dataRef: { id: 'conn-1', dbName: 'app_db', tableName: 'users', schemaName: 'va_schema' },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ] as any;

    expect(resolveSidebarScrollContextCrumbs({
      visibleNodeKeys: ['conn-1-app_db-schema-va', 'conn-1-app_db-tables'],
      treeData: withSchema,
      connectionIds: ['conn-1'],
      connections,
    })).toEqual({
      connectionId: 'conn-1',
      connectionName: '本地',
      dbName: 'app_db',
      showConnection: true,
      showDatabase: false,
    });
  });

  it('shows connection and database when only tables remain in the viewport', () => {
    expect(resolveSidebarScrollContextCrumbs({
      visibleNodeKeys: ['conn-1-app_db-users'],
      treeData,
      connectionIds: ['conn-1'],
      connections,
    })).toEqual({
      connectionId: 'conn-1',
      connectionName: '本地',
      dbName: 'app_db',
      showConnection: true,
      showDatabase: true,
    });
  });

  it('hides connection crumb when the connection node is visible', () => {
    expect(resolveSidebarScrollContextCrumbs({
      visibleNodeKeys: ['conn-1', 'conn-1-app_db'],
      treeData,
      connectionIds: ['conn-1'],
      connections,
    })).toEqual({
      connectionId: 'conn-1',
      connectionName: '本地',
      dbName: '',
      showConnection: false,
      showDatabase: false,
    });
  });

  it('falls back to active context when viewport keys are empty', () => {
    expect(resolveSidebarScrollContextCrumbs({
      visibleNodeKeys: [],
      treeData,
      connectionIds: ['conn-1'],
      connections,
      fallbackConnectionId: 'conn-1',
      fallbackConnectionName: '本地',
      fallbackDbName: 'app_db',
    })).toEqual({
      connectionId: 'conn-1',
      connectionName: '本地',
      dbName: 'app_db',
      showConnection: true,
      showDatabase: true,
    });
  });
});
