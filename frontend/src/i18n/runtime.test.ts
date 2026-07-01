import { afterEach, describe, expect, it, vi } from "vitest";

const dayjsLocaleMock = vi.fn();

vi.mock("dayjs", () => ({
  default: {
    locale: dayjsLocaleMock,
  },
}));

vi.mock("dayjs/locale/zh-cn", () => ({}));
vi.mock("dayjs/locale/en", () => ({}));

describe("syncLanguageRuntime", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("syncs dayjs, app, and AI service language", async () => {
    const appSetLanguage = vi.fn(async () => undefined);
    const aiSetLanguage = vi.fn(async () => undefined);
    vi.stubGlobal("window", {
      go: {
        app: { App: { SetLanguage: appSetLanguage } },
        aiservice: { Service: { AISetLanguage: aiSetLanguage } },
      },
    });

    const { syncLanguageRuntime } = await import("./runtime");
    await syncLanguageRuntime("zh-CN");

    expect(dayjsLocaleMock).toHaveBeenCalledWith("zh-cn");
    expect(appSetLanguage).toHaveBeenCalledWith("zh-CN");
    expect(aiSetLanguage).toHaveBeenCalledWith("zh-CN");
  });

  it("applies dayjs locales for every supported language", async () => {
    vi.stubGlobal("window", {});

    const { applyDayjsLocale } = await import("./runtime");
    applyDayjsLocale("zh-CN");
    applyDayjsLocale("en-US");

    expect(dayjsLocaleMock).toHaveBeenNthCalledWith(1, "zh-cn");
    expect(dayjsLocaleMock).toHaveBeenNthCalledWith(2, "en");
  });

  it("does not re-sync backend runtimes when the same language is requested repeatedly", async () => {
    const appSetLanguage = vi.fn(async () => undefined);
    const aiSetLanguage = vi.fn(async () => undefined);
    vi.stubGlobal("window", {
      go: {
        app: { App: { SetLanguage: appSetLanguage } },
        aiservice: { Service: { AISetLanguage: aiSetLanguage } },
      },
    });

    const { syncLanguageRuntime } = await import("./runtime");
    await syncLanguageRuntime("en-US");
    await syncLanguageRuntime("en-US");

    expect(appSetLanguage).toHaveBeenCalledTimes(1);
    expect(appSetLanguage).toHaveBeenCalledWith("en-US");
    expect(aiSetLanguage).toHaveBeenCalledTimes(1);
    expect(aiSetLanguage).toHaveBeenCalledWith("en-US");
  });

  it("reuses the same in-flight sync for concurrent calls with the same language", async () => {
    const syncResolvers: Array<() => void> = [];
    const appSetLanguage = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          syncResolvers.push(resolve);
        }),
    );
    const aiSetLanguage = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          syncResolvers.push(resolve);
        }),
    );
    vi.stubGlobal("window", {
      go: {
        app: { App: { SetLanguage: appSetLanguage } },
        aiservice: { Service: { AISetLanguage: aiSetLanguage } },
      },
    });

    const { syncLanguageRuntime } = await import("./runtime");
    const firstSync = syncLanguageRuntime("en-US");
    const secondSync = syncLanguageRuntime("en-US");

    expect(appSetLanguage).toHaveBeenCalledTimes(1);
    expect(aiSetLanguage).toHaveBeenCalledTimes(1);

    syncResolvers.forEach((resolve) => resolve());
    await Promise.all([firstSync, secondSync]);
  });

  it("serializes cross-language in-flight updates so the final synced language matches the latest request", async () => {
    const resolversByLanguage = new Map<string, Array<() => void>>();
    const recordResolver = (language: string, resolve: () => void) => {
      const resolvers = resolversByLanguage.get(language) || [];
      resolvers.push(resolve);
      resolversByLanguage.set(language, resolvers);
    };
    const appSetLanguage = vi.fn(
      (language: string) =>
        new Promise<void>((resolve) => {
          recordResolver(language, resolve);
        }),
    );
    const aiSetLanguage = vi.fn(
      (language: string) =>
        new Promise<void>((resolve) => {
          recordResolver(language, resolve);
        }),
    );
    vi.stubGlobal("window", {
      go: {
        app: { App: { SetLanguage: appSetLanguage } },
        aiservice: { Service: { AISetLanguage: aiSetLanguage } },
      },
    });

    const { syncLanguageRuntime } = await import("./runtime");
    const zhSync = syncLanguageRuntime("zh-CN");
    const enSync = syncLanguageRuntime("en-US");

    expect(appSetLanguage).toHaveBeenCalledTimes(1);
    expect(appSetLanguage).toHaveBeenNthCalledWith(1, "zh-CN");
    expect(aiSetLanguage).toHaveBeenCalledTimes(1);
    expect(aiSetLanguage).toHaveBeenNthCalledWith(1, "zh-CN");

    resolversByLanguage.get("zh-CN")?.forEach((resolve) => resolve());
    await Promise.resolve();
    await Promise.resolve();

    expect(appSetLanguage).toHaveBeenCalledTimes(2);
    expect(appSetLanguage).toHaveBeenNthCalledWith(2, "en-US");
    expect(aiSetLanguage).toHaveBeenCalledTimes(2);
    expect(aiSetLanguage).toHaveBeenNthCalledWith(2, "en-US");

    resolversByLanguage.get("en-US")?.forEach((resolve) => resolve());
    await Promise.all([zhSync, enSync]);

    await syncLanguageRuntime("en-US");
    expect(appSetLanguage).toHaveBeenCalledTimes(2);
    expect(aiSetLanguage).toHaveBeenCalledTimes(2);
  });

  it("re-syncs a previously synced language when switching back while another language is in flight", async () => {
    const resolversByLanguage = new Map<string, Array<() => void>>();
    const recordResolver = (language: string, resolve: () => void) => {
      const resolvers = resolversByLanguage.get(language) || [];
      resolvers.push(resolve);
      resolversByLanguage.set(language, resolvers);
    };
    const appSetLanguage = vi.fn((language: string) => {
      if (language === "en-US") {
        return new Promise<void>((resolve) => {
          recordResolver(language, resolve);
        });
      }
      return Promise.resolve();
    });
    const aiSetLanguage = vi.fn((language: string) => {
      if (language === "en-US") {
        return new Promise<void>((resolve) => {
          recordResolver(language, resolve);
        });
      }
      return Promise.resolve();
    });
    vi.stubGlobal("window", {
      go: {
        app: { App: { SetLanguage: appSetLanguage } },
        aiservice: { Service: { AISetLanguage: aiSetLanguage } },
      },
    });

    const { syncLanguageRuntime } = await import("./runtime");
    await syncLanguageRuntime("zh-CN");

    const enSync = syncLanguageRuntime("en-US");
    const backToZhSync = syncLanguageRuntime("zh-CN");

    expect(appSetLanguage).toHaveBeenNthCalledWith(1, "zh-CN");
    expect(appSetLanguage).toHaveBeenNthCalledWith(2, "en-US");
    expect(aiSetLanguage).toHaveBeenNthCalledWith(1, "zh-CN");
    expect(aiSetLanguage).toHaveBeenNthCalledWith(2, "en-US");

    resolversByLanguage.get("en-US")?.forEach((resolve) => resolve());
    await Promise.all([enSync, backToZhSync]);

    expect(appSetLanguage).toHaveBeenNthCalledWith(3, "zh-CN");
    expect(aiSetLanguage).toHaveBeenNthCalledWith(3, "zh-CN");
  });

  it("retries the same language after a failed sync instead of caching the failure as synced", async () => {
    const appSetLanguage = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("app failed"))
      .mockResolvedValueOnce(undefined);
    const aiSetLanguage = vi.fn(async () => undefined);
    vi.stubGlobal("window", {
      go: {
        app: { App: { SetLanguage: appSetLanguage } },
        aiservice: { Service: { AISetLanguage: aiSetLanguage } },
      },
    });

    const { syncLanguageRuntime } = await import("./runtime");
    await syncLanguageRuntime("en-US");
    await syncLanguageRuntime("en-US");

    expect(appSetLanguage).toHaveBeenCalledTimes(2);
    expect(appSetLanguage).toHaveBeenNthCalledWith(1, "en-US");
    expect(appSetLanguage).toHaveBeenNthCalledWith(2, "en-US");
    expect(aiSetLanguage).toHaveBeenCalledTimes(2);
    expect(aiSetLanguage).toHaveBeenNthCalledWith(1, "en-US");
    expect(aiSetLanguage).toHaveBeenNthCalledWith(2, "en-US");
  });

  it("continues syncing when the language actually changes", async () => {
    const appSetLanguage = vi.fn(async () => undefined);
    const aiSetLanguage = vi.fn(async () => undefined);
    vi.stubGlobal("window", {
      go: {
        app: { App: { SetLanguage: appSetLanguage } },
        aiservice: { Service: { AISetLanguage: aiSetLanguage } },
      },
    });

    const { syncLanguageRuntime } = await import("./runtime");
    await syncLanguageRuntime("zh-CN");
    await syncLanguageRuntime("en-US");

    expect(appSetLanguage).toHaveBeenNthCalledWith(1, "zh-CN");
    expect(appSetLanguage).toHaveBeenNthCalledWith(2, "en-US");
    expect(aiSetLanguage).toHaveBeenNthCalledWith(1, "zh-CN");
    expect(aiSetLanguage).toHaveBeenNthCalledWith(2, "en-US");
  });
});
