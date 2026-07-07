import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAppUpdateManager } from './useAppUpdateManager';
import { useStore } from '../store';

const runtimeApi = vi.hoisted(() => ({
  EventsOn: vi.fn(() => vi.fn()),
}));

const messageApi = vi.hoisted(() => ({
  info: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../../wailsjs/runtime', () => runtimeApi);

vi.mock('antd', () => ({
  message: messageApi,
}));

type BackendAppMock = {
  CheckForUpdates: ReturnType<typeof vi.fn>;
  CheckForUpdatesSilently: ReturnType<typeof vi.fn>;
  DownloadUpdate: ReturnType<typeof vi.fn>;
  InstallUpdateAndRestart: ReturnType<typeof vi.fn>;
  OpenDownloadedUpdateDirectory: ReturnType<typeof vi.fn>;
  OpenDownloadedUpdatePackage: ReturnType<typeof vi.fn>;
  GetAppInfo: ReturnType<typeof vi.fn>;
};

const createBackendAppMock = (): BackendAppMock => ({
  CheckForUpdates: vi.fn(),
  CheckForUpdatesSilently: vi.fn(),
  DownloadUpdate: vi.fn(),
  InstallUpdateAndRestart: vi.fn(),
  OpenDownloadedUpdateDirectory: vi.fn(),
  OpenDownloadedUpdatePackage: vi.fn(),
  GetAppInfo: vi.fn(async () => ({ success: true, data: { version: '0.8.1', author: 'Syngnat' } })),
});

describe('useAppUpdateManager', () => {
  let backendApp: BackendAppMock;
  let hook: ReturnType<typeof useAppUpdateManager> | null = null;
  let renderer: ReactTestRenderer | null = null;

  const t = (key: string, params?: Record<string, any>) => {
    if (params?.version) return `${key}:${params.version}`;
    if (params?.path) return `${key}:${params.path}`;
    if (params?.error) return `${key}:${params.error}`;
    return key;
  };

  const renderHook = (isMacRuntime: boolean) => {
    const Harness = () => {
      hook = useAppUpdateManager({
        isMacRuntime,
        runtimeBuildType: 'release',
        t,
      });
      return null;
    };

    act(() => {
      renderer = create(<Harness />);
    });
  };

  beforeEach(() => {
    backendApp = createBackendAppMock();
    hook = null;
    renderer = null;
    runtimeApi.EventsOn.mockClear();
    messageApi.info.mockReset();
    messageApi.success.mockReset();
    messageApi.error.mockReset();
    useStore.setState({
      updatePreferences: {
        autoPromptEnabled: true,
        skippedVersion: null,
      },
    });
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      go: {
        app: {
          App: backendApp,
        },
      },
    });
  });

  afterEach(() => {
    act(() => {
      renderer?.unmount();
    });
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('uses InstallUpdateAndRestart for downloaded macOS updates', async () => {
    backendApp.CheckForUpdates.mockResolvedValue({
      success: true,
      data: {
        hasUpdate: true,
        currentVersion: '0.8.1',
        latestVersion: '0.8.2',
        downloaded: true,
        assetSize: 1024,
      },
    });
    backendApp.InstallUpdateAndRestart.mockResolvedValue({ success: true });
    backendApp.OpenDownloadedUpdateDirectory.mockResolvedValue({ success: true });

    renderHook(true);

    await act(async () => {
      await hook?.checkForUpdates(false);
    });

    await act(async () => {
      await hook?.handleInstallFromProgress();
    });

    expect(backendApp.InstallUpdateAndRestart).toHaveBeenCalledTimes(1);
    expect(backendApp.OpenDownloadedUpdateDirectory).not.toHaveBeenCalled();
  });

  it('does not auto-open the downloaded macOS package directory after download succeeds', async () => {
    backendApp.CheckForUpdates.mockResolvedValue({
      success: true,
      data: {
        hasUpdate: true,
        currentVersion: '0.8.1',
        latestVersion: '0.8.2',
        downloaded: false,
        assetSize: 2048,
      },
    });
    backendApp.DownloadUpdate.mockResolvedValue({
      success: true,
      data: {
        downloadPath: '/Users/test/Desktop/GoNavi-0.8.2-MacOS-Arm64.dmg',
      },
    });
    backendApp.OpenDownloadedUpdateDirectory.mockResolvedValue({ success: true });

    renderHook(true);

    await act(async () => {
      await hook?.checkForUpdates(false);
    });

    await act(async () => {
      await hook?.downloadUpdate(hook?.lastUpdateInfo!, false);
    });

    expect(backendApp.DownloadUpdate).toHaveBeenCalledTimes(1);
    expect(backendApp.OpenDownloadedUpdateDirectory).not.toHaveBeenCalled();
    expect(hook?.lastUpdateInfo?.downloaded).toBe(true);
    expect(hook?.aboutUpdateDownloadPath).toBe('/Users/test/Desktop/GoNavi-0.8.2-MacOS-Arm64.dmg');
  });

  it('opens downloaded update package from about dialog action', async () => {
    backendApp.CheckForUpdates.mockResolvedValue({
      success: true,
      data: {
        hasUpdate: true,
        currentVersion: '0.8.1',
        latestVersion: '0.8.2',
        downloaded: true,
        downloadPath: 'C:\\Temp\\gonavi-updates\\.gonavi-update-windows-0.8.2\\GoNavi.exe',
      },
    });
    backendApp.OpenDownloadedUpdatePackage.mockResolvedValue({ success: true });

    renderHook(false);

    await act(async () => {
      await hook?.checkForUpdates(false);
    });

    await act(async () => {
      await hook?.openDownloadedUpdatePackage();
    });

    expect(backendApp.OpenDownloadedUpdatePackage).toHaveBeenCalledTimes(1);
  });

  it('auto-opens About on silent update check when auto prompt is enabled', async () => {
    backendApp.CheckForUpdatesSilently.mockResolvedValue({
      success: true,
      data: {
        hasUpdate: true,
        currentVersion: '0.8.1',
        latestVersion: '0.8.2',
      },
    });

    renderHook(false);

    await act(async () => {
      await hook?.checkForUpdates(true);
    });

    expect(hook?.isAboutOpen).toBe(true);
  });

  it('does not auto-open About after skipping the current version', async () => {
    backendApp.CheckForUpdatesSilently.mockResolvedValue({
      success: true,
      data: {
        hasUpdate: true,
        currentVersion: '0.8.1',
        latestVersion: '0.8.2',
      },
    });

    renderHook(false);

    await act(async () => {
      await hook?.checkForUpdates(true);
    });
    expect(hook?.isAboutOpen).toBe(true);

    await act(async () => {
      hook?.skipCurrentUpdateVersion();
    });
    expect(hook?.isAboutOpen).toBe(false);
    expect(useStore.getState().updatePreferences.skippedVersion).toBe('0.8.2');

    await act(async () => {
      await hook?.checkForUpdates(true);
    });
    expect(hook?.isAboutOpen).toBe(false);
  });

  it('does not auto-open About when auto prompt is disabled', async () => {
    useStore.getState().setUpdateAutoPromptEnabled(false);
    backendApp.CheckForUpdatesSilently.mockResolvedValue({
      success: true,
      data: {
        hasUpdate: true,
        currentVersion: '0.8.1',
        latestVersion: '0.8.2',
      },
    });

    renderHook(false);

    await act(async () => {
      await hook?.checkForUpdates(true);
    });

    expect(hook?.isAboutOpen).toBe(false);
  });

  it('still reports updates on manual check when auto prompt is disabled', async () => {
    useStore.getState().setUpdateAutoPromptEnabled(false);
    backendApp.CheckForUpdates.mockResolvedValue({
      success: true,
      data: {
        hasUpdate: true,
        currentVersion: '0.8.1',
        latestVersion: '0.8.2',
      },
    });

    renderHook(false);

    await act(async () => {
      await hook?.checkForUpdates(false);
    });

    expect(messageApi.info).toHaveBeenCalled();
    expect(hook?.isAboutOpen).toBe(false);
  });
});
