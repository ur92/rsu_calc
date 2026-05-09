import { useMemo, useCallback } from 'react';
import { changelog } from '../data/changelog';

const LS_KEY = 'rsu_changelog_last_seen_id';

function getLastSeenId(): string | null {
  try {
    return localStorage.getItem(LS_KEY);
  } catch {
    return null;
  }
}

function findIndex(id: string | null): number {
  if (!id) return -1;
  return changelog.findIndex((e) => e.id === id);
}

export function useChangelog() {
  const lastSeenId = getLastSeenId();
  const lastSeenIdx = findIndex(lastSeenId);

  const unseenCount = useMemo(() => {
    if (!lastSeenId || lastSeenIdx === -1) return changelog.length;
    return lastSeenIdx;
  }, [lastSeenId, lastSeenIdx]);

  const hasUnseen = unseenCount > 0;

  const isNew = useCallback(
    (entryId: string) => {
      if (!lastSeenId || lastSeenIdx === -1) return true;
      const idx = changelog.findIndex((e) => e.id === entryId);
      return idx < lastSeenIdx;
    },
    [lastSeenId, lastSeenIdx],
  );

  const markAllSeen = useCallback(() => {
    if (changelog.length > 0) {
      try {
        localStorage.setItem(LS_KEY, changelog[0].id);
      } catch { /* noop */ }
    }
  }, []);

  return { changelog, unseenCount, hasUnseen, isNew, markAllSeen };
}
