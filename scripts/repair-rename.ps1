# 修复 rename-product.ps1 误改的内部标识符，保留用户可见的 GoNavi-Lite 文案。
$root = 'd:\kayou\github\GoNavi'
$patterns = @(
  @{ Old = 'GoNavi'; New = 'GoNavi' },
  @{ Old = 'GoNavi'; New = 'GoNavi' },
  @{ Old = 'GoNaviCommand'; New = 'GoNaviCommand' },
  @{ Old = 'gonavi-command'; New = 'gonavi-command' },
  @{ Old = 'GONAVI_MCP_'; New = 'GONAVI_MCP_' },
  @{ Old = 'GONAVI_LOW_MEMORY_MODE'; New = 'GONAVI_LOW_MEMORY_MODE' },
  @{ Old = 'GONAVI_JMX_JAVA_BIN'; New = 'GONAVI_JMX_JAVA_BIN' },
  @{ Old = 'GONAVI_VERSION'; New = 'GONAVI_VERSION' },
  @{ Old = 'GONAVI_ROW_KEY'; New = 'GONAVI_ROW_KEY' },
  @{ Old = 'GONAVI_AUTHOR'; New = 'GONAVI_AUTHOR' },
  @{ Old = 'VITE_GONAVI_'; New = 'VITE_GONAVI_' },
  @{ Old = '__gonavi_db_N__'; New = '__gonavi_db_N__' },
  @{ Old = 'known.gonavi_mcp_http_token'; New = 'known.gonavi_mcp_http_token' },
  @{ Old = 'gonavi_full_drivers'; New = 'gonavi_full_drivers' },
  @{ Old = 'gonavi_mysql_driver'; New = 'gonavi_mysql_driver' },
  @{ Old = 'gonavi_mariadb_driver'; New = 'gonavi_mariadb_driver' },
  @{ Old = 'gonavi_oceanbase_driver'; New = 'gonavi_oceanbase_driver' },
  @{ Old = 'gonavi_diros_driver'; New = 'gonavi_diros_driver' },
  @{ Old = 'gonavi_starrocks_driver'; New = 'gonavi_starrocks_driver' },
  @{ Old = 'gonavi_sphinx_driver'; New = 'gonavi_sphinx_driver' },
  @{ Old = 'gonavi_sqlserver_driver'; New = 'gonavi_sqlserver_driver' },
  @{ Old = 'gonavi_sqlite_driver'; New = 'gonavi_sqlite_driver' },
  @{ Old = 'gonavi_duckdb_driver'; New = 'gonavi_duckdb_driver' },
  @{ Old = 'gonavi_dameng_driver'; New = 'gonavi_dameng_driver' },
  @{ Old = 'gonavi_kingbase_driver'; New = 'gonavi_kingbase_driver' },
  @{ Old = 'gonavi_highgo_driver'; New = 'gonavi_highgo_driver' },
  @{ Old = 'gonavi_vastbase_driver'; New = 'gonavi_vastbase_driver' },
  @{ Old = 'gonavi_opengauss_driver'; New = 'gonavi_opengauss_driver' },
  @{ Old = 'gonavi_gaussdb_driver'; New = 'gonavi_gaussdb_driver' },
  @{ Old = 'gonavi_iris_driver'; New = 'gonavi_iris_driver' },
  @{ Old = 'gonavi_mongodb_driver_v1'; New = 'gonavi_mongodb_driver_v1' },
  @{ Old = 'gonavi_mongodb_driver'; New = 'gonavi_mongodb_driver' },
  @{ Old = 'gonavi_tdengine_driver'; New = 'gonavi_tdengine_driver' },
  @{ Old = 'gonavi_iotdb_driver'; New = 'gonavi_iotdb_driver' },
  @{ Old = 'gonavi_clickhouse_driver'; New = 'gonavi_clickhouse_driver' },
  @{ Old = 'gonavi_elasticsearch_driver'; New = 'gonavi_elasticsearch_driver' },
  @{ Old = 'gonavi_trino_driver'; New = 'gonavi_trino_driver' },
  @{ Old = 'gonavi-mcp-server remote-config'; New = 'gonavi-mcp-server remote-config' },
  @{ Old = 'StandaloneCommand: "gonavi-mcp-server"'; New = 'StandaloneCommand: "gonavi-mcp-server"' },
  @{ Old = 'options.StandaloneCommand = "gonavi-mcp-server"'; New = 'options.StandaloneCommand = "gonavi-mcp-server"' }
)

$extensions = @('*.go', '*.ts', '*.tsx', '*.json', '*.md', '*.yml', '*.sh', '*.ps1')
$changed = 0
Get-ChildItem -Path $root -Recurse -Include $extensions -File |
  Where-Object { $_.FullName -notmatch '\\node_modules\\|\\\.git\\' } |
  ForEach-Object {
    $text = [IO.File]::ReadAllText($_.FullName)
    $updated = $text
    foreach ($pair in $patterns) {
      $updated = $updated.Replace($pair.Old, $pair.New)
    }
    if ($updated -ne $text) {
      [IO.File]::WriteAllText($_.FullName, $updated)
      $changed++
      Write-Host "Repaired: $($_.FullName.Substring($root.Length + 1))"
    }
  }

Write-Host "Repaired $changed files."
