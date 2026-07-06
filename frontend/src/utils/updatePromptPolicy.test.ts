import { describe, expect, it } from 'vitest';

import {
  compareVersion,
  DEFAULT_UPDATE_PREFERENCES,
  sanitizeUpdatePreferences,
  shouldAutoPromptUpdate,
} from './updatePromptPolicy';

describe('updatePromptPolicy', () => {
  it('compareVersion follows semver-like ordering', () => {
    expect(compareVersion('1.0.2', '1.0.3')).toBe(-1);
    expect(compareVersion('1.0.3', '1.0.2')).toBe(1);
    expect(compareVersion('v1.0.2', '1.0.2')).toBe(0);
    expect(compareVersion('1.0', '1.0.0')).toBe(0);
  });

  it('sanitizeUpdatePreferences falls back to defaults', () => {
    expect(sanitizeUpdatePreferences(undefined)).toEqual(DEFAULT_UPDATE_PREFERENCES);
    expect(sanitizeUpdatePreferences({ autoPromptEnabled: false, skippedVersion: ' v1.2.3 ' })).toEqual({
      autoPromptEnabled: false,
      skippedVersion: '1.2.3',
    });
    expect(sanitizeUpdatePreferences({ skippedVersion: '   ' }).skippedVersion).toBeNull();
  });

  it('shouldAutoPromptUpdate respects auto prompt and skipped version', () => {
    const info = { hasUpdate: true, latestVersion: '1.0.2' };

    expect(shouldAutoPromptUpdate(info, DEFAULT_UPDATE_PREFERENCES)).toBe(true);
    expect(shouldAutoPromptUpdate(info, { autoPromptEnabled: false, skippedVersion: null })).toBe(false);
    expect(shouldAutoPromptUpdate(info, { autoPromptEnabled: true, skippedVersion: '1.0.2' })).toBe(false);
    expect(shouldAutoPromptUpdate(
      { hasUpdate: true, latestVersion: '1.0.3' },
      { autoPromptEnabled: true, skippedVersion: '1.0.2' },
    )).toBe(true);
    expect(shouldAutoPromptUpdate({ hasUpdate: false, latestVersion: '1.0.3' }, DEFAULT_UPDATE_PREFERENCES)).toBe(false);
  });
});
