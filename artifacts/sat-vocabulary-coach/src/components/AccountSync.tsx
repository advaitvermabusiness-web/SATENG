import { useEffect, useMemo, useRef, useState } from 'react';
import { useUser } from '@clerk/react';
import type { DiscoveryHistoryItem, Session, StudySettings, WordProgress } from '../types';
import {
  isVocabularyState,
  type VocabularyState,
} from '../lib/vocabularyStateValidation';

export type AccountSyncStatus = 'local' | 'loading' | 'saving' | 'synced' | 'offline';

type StateSetter<T> = (value: T | ((current: T) => T)) => void;

function emptyVocabularyState(): VocabularyState {
  return {
    settings: {
      level: 'Foundational',
      dailyGoal: 5,
      reminderEnabled: false,
      hasCompletedOnboarding: false,
      paywallSeen: false,
    },
    progress: [],
    sessions: [],
    bookmarks: [],
    discoveryHistory: [],
  };
}

function mergeDiscoveryHistory(local: DiscoveryHistoryItem[], remote?: DiscoveryHistoryItem[]) {
  const merged = new Map(local.map(item => [item.wordId, item]));
  for (const remoteItem of remote ?? []) {
    const localItem = merged.get(remoteItem.wordId);
    if (!localItem) {
      merged.set(remoteItem.wordId, remoteItem);
      continue;
    }
    const remoteIsNewer = new Date(remoteItem.lastSeen).getTime() >= new Date(localItem.lastSeen).getTime();
    const newerItem = remoteIsNewer ? remoteItem : localItem;
    merged.set(remoteItem.wordId, {
      ...newerItem,
      firstSeen: new Date(Math.min(
        new Date(localItem.firstSeen).getTime(),
        new Date(remoteItem.firstSeen).getTime(),
      )).toISOString(),
      seenCount: Math.max(localItem.seenCount, remoteItem.seenCount),
      note: newerItem.note ?? (remoteIsNewer ? localItem.note : remoteItem.note),
    });
  }
  return [...merged.values()];
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function saveState(state: VocabularyState, signal?: AbortSignal) {
  const response = await fetch('/api/me/vocabulary-state', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ state }),
    signal,
  });
  if (!response.ok) throw new Error(`Account sync failed (${response.status})`);
}

export function useAccountSync({
  settings,
  setSettings,
  progress,
  setProgress,
  sessions,
  setSessions,
  bookmarks,
  setBookmarks,
  discoveryHistory,
  setDiscoveryHistory,
}: {
  settings: StudySettings;
  setSettings: StateSetter<StudySettings>;
  progress: WordProgress[];
  setProgress: StateSetter<WordProgress[]>;
  sessions: Session[];
  setSessions: StateSetter<Session[]>;
  bookmarks: string[];
  setBookmarks: StateSetter<string[]>;
  discoveryHistory: DiscoveryHistoryItem[];
  setDiscoveryHistory: StateSetter<DiscoveryHistoryItem[]>;
}): AccountSyncStatus {
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? null;
  const [status, setStatus] = useState<AccountSyncStatus>('local');
  const hydratedUserRef = useRef<string | null>(null);

  const currentState = useMemo<VocabularyState>(
    () => ({ settings, progress, sessions, bookmarks, discoveryHistory }),
    [settings, progress, sessions, bookmarks, discoveryHistory],
  );
  const latestStateRef = useRef(currentState);
  latestStateRef.current = currentState;

  useEffect(() => {
    if (!isLoaded) return;
    if (!userId) {
      hydratedUserRef.current = null;
      setStatus('local');
      return;
    }
    if (hydratedUserRef.current === userId) return;

    const controller = new AbortController();
    setStatus('loading');

    void (async () => {
      try {
        let storedOwner: string | null = null;
        try {
          storedOwner = localStorage.getItem('wordwell-state-owner');
        } catch {
          // Treat unavailable ownership metadata as anonymous local state.
        }
        const localStateCanMerge = !storedOwner || storedOwner === userId;
        const safeLocalState = localStateCanMerge &&
          isVocabularyState(latestStateRef.current)
          ? latestStateRef.current
          : emptyVocabularyState();

        const response = await fetch('/api/me/vocabulary-state', {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Account sync failed (${response.status})`);

        const payload: unknown = await response.json();
        const remoteState = isPlainRecord(payload) && isVocabularyState(payload.state)
          ? payload.state
          : null;
        if (remoteState) {
          const mergedDiscoveryHistory = mergeDiscoveryHistory(
            safeLocalState.discoveryHistory ?? [],
            remoteState.discoveryHistory,
          );
          hydratedUserRef.current = userId;
          setSettings(current => ({ ...current, ...remoteState.settings }));
          setProgress(remoteState.progress);
          setSessions(remoteState.sessions);
          setBookmarks(remoteState.bookmarks);
          setDiscoveryHistory(mergedDiscoveryHistory);
          if (
            remoteState.discoveryHistory === undefined ||
            JSON.stringify(mergedDiscoveryHistory) !== JSON.stringify(remoteState.discoveryHistory)
          ) {
            await saveState({ ...remoteState, discoveryHistory: mergedDiscoveryHistory }, controller.signal);
          }
        } else {
          await saveState(safeLocalState, controller.signal);
          hydratedUserRef.current = userId;
          if (!localStateCanMerge) {
            setSettings(safeLocalState.settings);
            setProgress(safeLocalState.progress);
            setSessions(safeLocalState.sessions);
            setBookmarks(safeLocalState.bookmarks);
            setDiscoveryHistory(safeLocalState.discoveryHistory ?? []);
          }
        }

        try {
          localStorage.setItem('wordwell-state-owner', userId);
        } catch {
          // Account sync remains authoritative when browser storage is unavailable.
        }
        setStatus('synced');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setStatus('offline');
      }
    })();

    return () => controller.abort();
  }, [
    isLoaded,
    setBookmarks,
    setProgress,
    setSessions,
    setSettings,
    setDiscoveryHistory,
    userId,
  ]);

  useEffect(() => {
    if (!userId || hydratedUserRef.current !== userId) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setStatus('saving');
      void saveState(currentState, controller.signal)
        .then(() => setStatus('synced'))
        .catch(error => {
          if ((error as Error).name !== 'AbortError') setStatus('offline');
        });
    }, 650);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [currentState, userId]);

  return status;
}