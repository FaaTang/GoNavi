export const RELEASE_TAB_QUERY_RESULTS_EVENT = "gonavi:release-tab-query-results";

export type ReleaseTabQueryResultsDetail = {
  tabIds: string[];
};

export const dispatchReleaseTabQueryResults = (tabIds: string[]): void => {
  if (typeof window === "undefined") {
    return;
  }
  const normalized = [
    ...new Set(
      tabIds.map((id) => String(id || "").trim()).filter(Boolean),
    ),
  ];
  if (normalized.length === 0) {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<ReleaseTabQueryResultsDetail>(
      RELEASE_TAB_QUERY_RESULTS_EVENT,
      { detail: { tabIds: normalized } },
    ),
  );
};
