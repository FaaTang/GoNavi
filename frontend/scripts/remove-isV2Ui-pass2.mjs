import fs from 'node:fs';
import path from 'node:path';

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      walk(fullPath, files);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

const srcDir = path.resolve('src');

function stripIsV2UiPropLines(source) {
  return source
    .replace(/^\s*isV2Ui(\?)?: boolean;\r?\n/gm, '')
    .replace(/^\s*isV2Ui,\r?\n/gm, '')
    .replace(/^\s*isV2Ui\?\: boolean;\r?\n/gm, '')
    .replace(/\s*isV2Ui=\{isV2Ui\}\r?\n/g, '\n')
    .replace(/\s*isV2Ui=\{true\}\r?\n/g, '\n')
    .replace(/\s*isV2Ui=\{false\}\r?\n/g, '\n')
    .replace(/,\s*isV2Ui\b/g, '')
    .replace(/\bisV2Ui,\s*/g, '')
    .replace(/\[\s*isV2Ui,\s*/g, '[')
    .replace(/,\s*isV2Ui\s*\]/g, ']');
}

function simplifyTernaries(source) {
  let s = source;
  // isV2Ui ? a : b -> a (single line common patterns)
  s = s.replace(/isV2Ui \? ([^:]+) : undefined/g, '$1');
  s = s.replace(/isV2Ui \? '([^']+)' : '([^']+)'/g, "'$1'");
  s = s.replace(/isV2Ui \? "([^"]+)" : "([^"]+)"/g, '"$1"');
  s = s.replace(/isV2Ui \? ([^:]+) : 'list'/g, '$1');
  s = s.replace(/isV2Ui \? v2VisibleTreeData : displayTreeData/g, 'v2VisibleTreeData');
  s = s.replace(/isV2Ui \? v2TreeHorizontalScrollWidth : undefined/g, 'v2TreeHorizontalScrollWidth');
  s = s.replace(/isV2Ui \? currentPinnedSidebarTables : \[\]/g, 'currentPinnedSidebarTables');
  s = s.replace(/`\$\{isV2Ui \? 'v2' : 'legacy'\}\|/g, '`v2|');
  s = s.replace(/isV2Ui \? Math\.max\(24, Math\.round\(28 \* effectiveUiScale\)\) : undefined/g, 'Math.max(24, Math.round(28 * effectiveUiScale))');
  s = s.replace(/isV2Ui \? 'query-result-panel-header gn-v2-query-result-panel-header' : 'query-result-panel-header'/g, "'query-result-panel-header gn-v2-query-result-panel-header'");
  s = s.replace(/isV2Ui \? undefined : \{ width: (\d+) \}/g, 'undefined');
  s = s.replace(/isV2Ui \? undefined : \{ width: 1, height: 18[^}]+\}/g, 'undefined');
  s = s.replace(/isV2Ui \? undefined : \{ display: 'flex'[^}]+\}/g, 'undefined');
  s = s.replace(/isV2Ui \? undefined : \{ fontSize: 12[^}]+\}/g, 'undefined');
  s = s.replace(/isV2Ui \? undefined : \{ padding: 0[^}]+\}/g, 'undefined');
  s = s.replace(/isV2Ui \? undefined : 16/g, 'undefined');
  s = s.replace(/isV2Ui \? undefined : accentColor/g, 'undefined');
  s = s.replace(/isV2Ui \? undefined : 'all 0\.15s ease'/g, 'undefined');
  s = s.replace(/isV2Ui \? undefined : \(e => \{[^}]+\}\)/g, 'undefined');
  s = s.replace(/isV2Ui \? \(event\) => openV2OverviewContextMenu\(event, table\) : undefined/g, '(event) => openV2OverviewContextMenu(event, table)');
  s = s.replace(/isV2Ui \? translate\('data_grid\.toolbar\.ai_insight_short'\) : translate\('data_grid\.toolbar\.ai_insight'\)/g, "translate('data_grid.toolbar.ai_insight_short')");
  s = s.replace(/open=\{isV2Ui \? undefined : legacyDropdownOpen\}/g, 'open={undefined}');
  s = s.replace(/const legacyDropdownOpen = !isV2Ui &&/g, 'const legacyDropdownOpen = false &&');
  s = s.replace(/closable: !isV2Ui,/g, 'closable: false,');
  s = s.replace(/shouldClearSidebarActiveContextOnEmptySelect\(isV2Ui\)/g, 'false');
  s = s.replace(/buildSidebarTableChildrenForUi\(groupNodeKey, children, isV2Ui\)/g, 'buildSidebarTableChildrenForUi(groupNodeKey, children, true)');
  s = s.replace(/resolveAIChatPanelMode\(isV2Ui, activePanelMode\)/g, 'resolveAIChatPanelMode(activePanelMode)');
  s = s.replace(/shouldOverlayAIPanel\(\{\s*\n\s*isV2Ui,\s*\n/g, 'shouldOverlayAIPanel({\n');
  s = s.replace(/if \(!isTableSurfaceActive \|\| !isV2Ui \|\| !cellContextMenu\.visible\) return;/g, 'if (!isTableSurfaceActive || !cellContextMenu.visible) return;');
  s = s.replace(/if \(!isV2Ui\) return;/g, '');
  s = s.replace(/if \(!isV2Ui\) \{\s*\n[^}]*\n\s*\}/g, '');
  s = s.replace(/\.\.\.\(isV2Ui \? \{\} : \{[^}]+\}\)/g, '');
  s = s.replace(/const legacyAiButtonStyle[^;]+;/g, '');
  s = s.replace(/isV2Ui \|\| \(viewMode/g, '(viewMode');
  s = s.replace(/options\?\.asView === true && isV2Ui/g, 'options?.asView === true');
  s = s.replace(/\(nextMode === 'fields' \|\| nextMode === 'ddl' \|\| nextMode === 'er'\) && !isV2Ui/g, 'false');
  return s;
}

for (const file of walk(srcDir)) {
  if (file.includes('remove-isV2Ui')) continue;
  let source = fs.readFileSync(file, 'utf8');
  const original = source;
  source = stripIsV2UiPropLines(source);
  source = simplifyTernaries(source);
  if (source !== original) {
    fs.writeFileSync(file, source);
    console.log('Updated:', path.relative(srcDir, file));
  }
}

console.log('Done pass 2');
