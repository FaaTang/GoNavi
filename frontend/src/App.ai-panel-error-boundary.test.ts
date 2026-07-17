import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const appSource = readFileSync(
  fileURLToPath(new globalThis.URL('./App.tsx', import.meta.url)),
  'utf8',
);
const aiPanelBoundarySource = readFileSync(
  fileURLToPath(new globalThis.URL('./components/ai/AIPanelErrorBoundary.tsx', import.meta.url)),
  'utf8',
);

describe('AI panel lazy-load guard', () => {
  it('keeps AI panel failures scoped to the panel area with retry support', () => {
    expect(appSource).toContain("const LazyAIChatPanel = lazy(() => import('./components/AIChatPanel'));");
    expect(appSource).not.toContain("import AIChatPanel from './components/AIChatPanel';");
    expect(appSource).toContain("import AIPanelErrorBoundary from './components/ai/AIPanelErrorBoundary';");
    expect(aiPanelBoundarySource).toContain('class AIPanelErrorBoundary extends React.Component');
    expect(appSource).toContain('<AIPanelErrorBoundary');
    expect(appSource).toContain('key={aiPanelRenderNonce}');
    expect(appSource).toContain("t('app.ai_panel.error.title')");
    expect(appSource).toContain("t('app.ai_panel.action.reload')");
    expect(appSource).toContain('setAiPanelRenderNonce((current) => current + 1)');
    expect(appSource).toContain('<LazyAIChatPanel width={aiPanelRenderWidth}');
    expect(appSource).not.toContain('<AIChatPanel width={aiPanelRenderWidth}');
    expect(appSource).toContain('<Suspense');
    expect(appSource).not.toContain('const loadAIChatPanelModule = async (retryNonce: number) => {');
  });
});
