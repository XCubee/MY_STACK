import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import type {
  ActivityEvent,
  ActivityEventType,
  ActivitySourceType,
} from '../domain/activity';
import { useApp } from './AppContext';
import {
  insertCloudActivity,
  loadLocalActivity,
  readCloudActivity,
  saveLocalActivity,
  type ActivitySnapshot,
} from '../services/activityStorage';
import { createSupabaseClient } from '../services/supabase';

type NewActivityEvent = {
  eventType: ActivityEventType;
  sourceType: ActivitySourceType;
  sourceId: string;
  summary: string;
  metadata?: Record<string, unknown>;
};

type ActivityContextValue = {
  events: ActivityEvent[];
  ready: boolean;
  error: string | null;
  recordActivity: (event: NewActivityEvent) => void;
  retrySync: () => Promise<void>;
};

const EMPTY_SNAPSHOT: ActivitySnapshot = { events: [], pendingIds: [] };
const ActivityContext = createContext<ActivityContextValue | null>(null);

function mergeEvents(...groups: ActivityEvent[][]): ActivityEvent[] {
  const merged = new Map<string, ActivityEvent>();
  for (const event of groups.flat()) merged.set(event.id, event);
  return [...merged.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

function makeEventId(): string {
  return `activity-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ActivityProvider({ children }: PropsWithChildren) {
  const { authStatus, currentUser } = useApp();
  const ownerId =
    authStatus === 'authenticated' || authStatus === 'onboarding'
      ? currentUser?.id
      : undefined;
  const identity =
    ownerId ?? (authStatus === 'offline' ? 'local' : `session:${authStatus}`);
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [loadedIdentity, setLoadedIdentity] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<{
    identity: string;
    message: string;
  } | null>(null);
  const snapshotRef = useRef(snapshot);
  const ownerRef = useRef<string | undefined>(undefined);
  const identityRef = useRef(identity);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const ready = loadedIdentity === identity;
  const events = ready ? snapshot.events : [];
  const error = errorState?.identity === identity ? errorState.message : null;

  const showSnapshot = useCallback((next: ActivitySnapshot) => {
    snapshotRef.current = next;
    setSnapshot(next);
  }, []);

  const flushPending = useCallback(async () => {
    const userId = ownerRef.current;
    if (!userId) return;
    const client = createSupabaseClient();
    if (!client) return;

    for (const id of [...snapshotRef.current.pendingIds]) {
      const event = snapshotRef.current.events.find((item) => item.id === id);
      if (!event) continue;
      await insertCloudActivity(client, userId, event);
      const current = snapshotRef.current;
      const next = {
        ...current,
        pendingIds: current.pendingIds.filter((pendingId) => pendingId !== id),
      };
      showSnapshot(next);
      await saveLocalActivity(next, userId);
    }
  }, [showSnapshot]);

  const queueSave = useCallback(
    (next: ActivitySnapshot, userId?: string) => {
      saveQueue.current = saveQueue.current
        .catch(() => undefined)
        .then(async () => {
          if (identityRef.current !== identity) return;
          await saveLocalActivity(next, userId);
          await flushPending();
        })
        .catch((cause: unknown) => {
          setErrorState({
            identity,
            message:
              cause instanceof Error
                ? cause.message
                : 'Could not save activity history.',
          });
        });
    },
    [flushPending, identity],
  );

  useEffect(() => {
    let active = true;
    identityRef.current = identity;
    ownerRef.current = ownerId;
    setLoadedIdentity(null);
    setErrorState(null);
    showSnapshot(EMPTY_SNAPSHOT);

    const load = async () => {
      try {
        const local = (await loadLocalActivity(ownerId)) ?? EMPTY_SNAPSHOT;
        const client = ownerId ? createSupabaseClient() : null;
        const cloudEvents =
          client && ownerId
            ? await readCloudActivity(client, ownerId)
            : [];
        if (!active) return;
        const events = mergeEvents(cloudEvents, local.events);
        const cloudIds = new Set(cloudEvents.map((event) => event.id));
        const pendingIds = ownerId
          ? [
              ...new Set([
                ...local.pendingIds,
                ...local.events
                  .filter((event) => !cloudIds.has(event.id))
                  .map((event) => event.id),
              ]),
            ]
          : [];
        const next = { events, pendingIds };
        showSnapshot(next);
        setLoadedIdentity(identity);
        await saveLocalActivity(next, ownerId);
        if (pendingIds.length > 0) await flushPending();
      } catch (cause) {
        if (!active) return;
        setErrorState({
          identity,
          message:
            cause instanceof Error
              ? cause.message
              : 'Could not load activity history.',
        });
        setLoadedIdentity(identity);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [flushPending, identity, ownerId, showSnapshot]);

  const recordActivity = useCallback(
    (event: NewActivityEvent) => {
      const created: ActivityEvent = {
        ...event,
        id: makeEventId(),
        metadata: event.metadata ?? {},
        createdAt: new Date().toISOString(),
      };
      const current = snapshotRef.current;
      const next = {
        events: mergeEvents([created], current.events).slice(0, 500),
        pendingIds: ownerRef.current
          ? [...current.pendingIds, created.id]
          : current.pendingIds,
      };
      showSnapshot(next);
      queueSave(next, ownerRef.current);
    },
    [queueSave, showSnapshot],
  );

  const retrySync = useCallback(async () => {
    try {
      await flushPending();
      setErrorState(null);
    } catch (cause) {
      setErrorState({
        identity,
        message:
          cause instanceof Error
            ? cause.message
            : 'Could not sync activity history.',
      });
      throw cause;
    }
  }, [flushPending, identity]);

  const value = useMemo(
    () => ({ events, ready, error, recordActivity, retrySync }),
    [error, events, ready, recordActivity, retrySync],
  );
  return (
    <ActivityContext.Provider value={value}>
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity() {
  const context = useContext(ActivityContext);
  if (!context) {
    throw new Error('useActivity must be used within an ActivityProvider.');
  }
  return context;
}
