export interface UpdatePreferences {
  autoPromptEnabled: boolean;
  skippedVersion: string | null;
}

export interface UpdatePromptInfo {
  hasUpdate: boolean;
  latestVersion: string;
}

export const DEFAULT_UPDATE_PREFERENCES: UpdatePreferences = {
  autoPromptEnabled: true,
  skippedVersion: null,
};

export const normalizeVersion = (version: string): string => {
  return String(version || '').trim().replace(/^v/i, '');
};

const splitVersionParts = (version: string): number[] => {
  return normalizeVersion(version)
    .split('.')
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) {
        return 0;
      }
      let num = 0;
      for (const ch of trimmed) {
        if (ch < '0' || ch > '9') {
          break;
        }
        num = num * 10 + (ch.charCodeAt(0) - 48);
      }
      return num;
    });
};

/** Mirrors Go compareVersion: -1 if current < latest, 0 if equal, 1 if current > latest. */
export const compareVersion = (current: string, latest: string): number => {
  const normalizedCurrent = normalizeVersion(current);
  const normalizedLatest = normalizeVersion(latest);
  if (!normalizedCurrent) {
    return -1;
  }
  if (normalizedCurrent === normalizedLatest) {
    return 0;
  }

  const curParts = splitVersionParts(normalizedCurrent);
  const latParts = splitVersionParts(normalizedLatest);
  const max = Math.max(curParts.length, latParts.length);
  for (let i = 0; i < max; i += 1) {
    const cur = i < curParts.length ? curParts[i] : 0;
    const lat = i < latParts.length ? latParts[i] : 0;
    if (cur < lat) {
      return -1;
    }
    if (cur > lat) {
      return 1;
    }
  }
  return 0;
};

export const sanitizeUpdatePreferences = (value: unknown): UpdatePreferences => {
  const raw = value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
  const autoPromptEnabled = raw.autoPromptEnabled !== false;
  let skippedVersion: string | null = null;
  if (typeof raw.skippedVersion === 'string') {
    const normalized = normalizeVersion(raw.skippedVersion);
    skippedVersion = normalized || null;
  }
  return { autoPromptEnabled, skippedVersion };
};

export const shouldAutoPromptUpdate = (
  info: UpdatePromptInfo,
  prefs: UpdatePreferences,
): boolean => {
  if (!info.hasUpdate) {
    return false;
  }
  if (!prefs.autoPromptEnabled) {
    return false;
  }
  const latestVersion = normalizeVersion(info.latestVersion);
  if (!latestVersion) {
    return false;
  }
  if (prefs.skippedVersion) {
    return compareVersion(prefs.skippedVersion, latestVersion) < 0;
  }
  return true;
};
