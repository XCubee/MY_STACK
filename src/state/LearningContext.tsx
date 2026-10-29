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
  LearningItem,
  LearningSection,
} from '../domain/learning';
import {
  makeLearningItemId,
  makeLearningSectionId,
} from '../domain/learning';
import { useApp } from './AppContext';
import {
  loadLocalLearning,
  readCloudLearning,
  saveLocalLearning,
  writeCloudLearning,
  type LearningSnapshot,
} from '../services/learningStorage';
import { createSupabaseClient } from '../services/supabase';

type NewLearningItem = Omit<
  LearningItem,
  'id' | 'archivedAt' | 'createdAt' | 'updatedAt'
>;
type NewLearningSection = Omit<
  LearningSection,
  'id' | 'completedAt' | 'createdAt' | 'updatedAt'
>;

type LearningContextValue = {
  items: LearningItem[];
  sections: LearningSection[];
  ready: boolean;
  error: string | null;
  addItem: (item: NewLearningItem) => LearningItem;
  updateItem: (item: LearningItem) => void;
  archiveItem: (id: string) => void;
  deleteItem: (id: string) => Promise<void>;
  addSection: (section: NewLearningSection) => LearningSection;
  updateSection: (section: LearningSection) => void;
  deleteSection: (id: string) => void;
  retrySync: () => Promise<void>;
};

const EMPTY_SNAPSHOT: LearningSnapshot = {
  items: [],
  sections: [],
  deletedItemIds: [],
  deletedSectionIds: [],
  syncPending: false,
};

const LearningContext = createContext<LearningContextValue | null>(null);

function mergeById<T extends { id: string }>(
  local: T[],
  cloud: T[],
): T[] {
  const merged = new Map<string, T>();
  for (const value of [...cloud, ...local]) merged.set(value.id, value);
  return [...merged.values()];
}

function removeDeleted<T extends { id: string }>(
  values: T[],
  deletedIds: string[],
): T[] {
  const deleted = new Set(deletedIds);
  return values.filter((value) => !deleted.has(value.id));
}

function nowIso(): string {
  return new Date().toISOString();
}

export function LearningProvider({ children }: PropsWithChildren) {
  const { authStatus, currentUser } = useApp();
  const ownerId =
    authStatus === 'authenticated' || authStatus === 'onboarding'
      ? currentUser?.id
      : undefined;
  const identity =
    ownerId ?? (authStatus === 'offline' ? 'local' : `session:${authStatus}`);
  const [snapshot, setSnapshot] =
    useState<LearningSnapshot>(EMPTY_SNAPSHOT);
  const [loadedIdentity, setLoadedIdentity] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<{
    identity: string;
    message: string;
  } | null>(null);
  const snapshotRef = useRef(snapshot);
  const ownerIdRef = useRef<string | undefined>(undefined);
  const identityRef = useRef('local');
  const saveRevision = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const ready = loadedIdentity === identity;
  const canAccessSnapshot =
    ready && (authStatus === 'offline' || Boolean(ownerId));
  const error =
    errorState?.identity === identity ? errorState.message : null;

  const showSnapshot = useCallback((next: LearningSnapshot) => {
    snapshotRef.current = next;
    setSnapshot(next);
  }, []);
  const setLearningError = useCallback((message: string | null) => {
    setErrorState(
      message === null
        ? null
        : { identity: identityRef.current, message },
    );
  }, []);

  const syncSnapshot = useCallback(
    async (
      next: LearningSnapshot,
      ownerId: string,
    ): Promise<LearningSnapshot> => {
      const client = createSupabaseClient();
      if (!client) throw new Error('Supabase is not configured.');
      await writeCloudLearning(client, ownerId, next);
      return {
        ...next,
        deletedItemIds: [],
        deletedSectionIds: [],
        syncPending: false,
      };
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    ownerIdRef.current = ownerId;
    identityRef.current = identity;

    const hydrate = async () => {
      try {
        if (authStatus === 'loading') return;
        if (authStatus !== 'offline' && !ownerId) return;

        const local = (await loadLocalLearning(ownerId)) ?? EMPTY_SNAPSHOT;
        if (authStatus === 'offline') {
          if (!cancelled) showSnapshot(local);
          return;
        }

        const client = createSupabaseClient();
        if (!client || !ownerId) {
          if (!cancelled) {
            showSnapshot(local);
            setLearningError(
              'Learning data is available locally; cloud sync is not configured.',
            );
          }
          return;
        }

        let cloud: LearningSnapshot;
        try {
          cloud = await readCloudLearning(client, ownerId);
        } catch (readError) {
          if (!cancelled) {
            showSnapshot(local);
            setLearningError(
              `Could not load learning data from Supabase: ${readError instanceof Error ? readError.message : String(readError)}`,
            );
          }
          return;
        }

        let next = local.syncPending
          ? {
              ...cloud,
              items: removeDeleted(
                mergeById(local.items, cloud.items),
                local.deletedItemIds,
              ),
              sections: removeDeleted(
                mergeById(local.sections, cloud.sections),
                local.deletedSectionIds,
              ),
              deletedItemIds: local.deletedItemIds,
              deletedSectionIds: local.deletedSectionIds,
              syncPending: true,
            }
          : cloud;
        const availableItemIds = new Set(next.items.map((item) => item.id));
        next = {
          ...next,
          sections: next.sections.filter((section) =>
            availableItemIds.has(section.learningItemId),
          ),
        };
        if (cancelled) return;
        showSnapshot(next);
        await saveLocalLearning(next, ownerId);
        if (next.syncPending) {
          try {
            const synced = await syncSnapshot(next, ownerId);
            await saveLocalLearning(synced, ownerId);
            if (!cancelled) showSnapshot(synced);
          } catch (syncError) {
            if (!cancelled) {
              setLearningError(
                `Learning cloud sync failed: ${syncError instanceof Error ? syncError.message : String(syncError)}`,
              );
            }
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setLearningError(
            `Could not load saved learning data: ${loadError instanceof Error ? loadError.message : String(loadError)}`,
          );
        }
      } finally {
        if (!cancelled) setLoadedIdentity(identity);
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [
    authStatus,
    currentUser?.id,
    identity,
    ownerId,
    setLearningError,
    showSnapshot,
    syncSnapshot,
  ]);

  const queueSave = useCallback(
    (next: LearningSnapshot) => {
      const ownerId = ownerIdRef.current;
      const revision = ++saveRevision.current;
      const pending = { ...next, syncPending: Boolean(ownerId) };
      showSnapshot(pending);
      saveQueue.current = saveQueue.current.then(async () => {
        try {
          await saveLocalLearning(pending, ownerId);
          if (!ownerId || ownerIdRef.current !== ownerId) return;
          const synced = await syncSnapshot(pending, ownerId);
          await saveLocalLearning(synced, ownerId);
          if (
            ownerIdRef.current === ownerId &&
            revision === saveRevision.current
          ) {
            showSnapshot(synced);
            setLearningError(null);
          }
        } catch (saveError) {
          if (
            ownerIdRef.current === ownerId &&
            revision === saveRevision.current
          ) {
            setLearningError(
              `Learning data is saved on this device, but cloud sync failed: ${saveError instanceof Error ? saveError.message : String(saveError)}`,
            );
          }
        }
      });
    },
    [setLearningError, showSnapshot, syncSnapshot],
  );

  const addItem = useCallback(
    (values: NewLearningItem) => {
      const timestamp = nowIso();
      const item: LearningItem = {
        ...values,
        id: makeLearningItemId(),
        archivedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      queueSave({
        ...snapshotRef.current,
        items: [item, ...snapshotRef.current.items],
        deletedItemIds: snapshotRef.current.deletedItemIds.filter(
          (id) => id !== item.id,
        ),
      });
      return item;
    },
    [queueSave],
  );

  const updateItem = useCallback(
    (item: LearningItem) => {
      const current = snapshotRef.current.items.find(
        (value) => value.id === item.id,
      );
      if (!current) throw new Error('This learning item no longer exists.');
      queueSave({
        ...snapshotRef.current,
        items: snapshotRef.current.items.map((value) =>
          value.id === item.id ? { ...item, updatedAt: nowIso() } : value,
        ),
      });
    },
    [queueSave],
  );

  const archiveItem = useCallback(
    (id: string) => {
      const item = snapshotRef.current.items.find((value) => value.id === id);
      if (!item) throw new Error('This learning item no longer exists.');
      updateItem({ ...item, archivedAt: item.archivedAt ?? nowIso() });
    },
    [updateItem],
  );

  const deleteItem = useCallback(
    async (id: string) => {
      await saveQueue.current;
      const current = snapshotRef.current;
      if (!current.items.some((item) => item.id === id)) {
        throw new Error('This learning item no longer exists.');
      }
      const ownerId = ownerIdRef.current;
      if (ownerId) {
        try {
          const client = createSupabaseClient();
          if (!client) throw new Error('Supabase is not configured.');
          const { error: deleteError } = await client
            .from('learning_items')
            .delete()
            .eq('user_id', ownerId)
            .eq('id', id);
          if (deleteError) throw deleteError;
        } catch (deleteError) {
          const message =
            deleteError instanceof Error
              ? deleteError.message
              : String(deleteError);
          setLearningError(
            `Could not delete this learning item from Supabase: ${message}`,
          );
          throw deleteError;
        }
      }
      const next = {
        ...snapshotRef.current,
        items: snapshotRef.current.items.filter((item) => item.id !== id),
        sections: snapshotRef.current.sections.filter(
          (section) => section.learningItemId !== id,
        ),
        deletedItemIds: snapshotRef.current.deletedItemIds.filter(
          (deletedId) => deletedId !== id,
        ),
      };
      if (ownerId) {
        queueSave(next);
      } else {
        queueSave({
          ...next,
          deletedSectionIds: [],
        });
      }
    },
    [queueSave, setLearningError],
  );

  const addSection = useCallback(
    (values: NewLearningSection) => {
      const current = snapshotRef.current;
      if (!current.items.some((item) => item.id === values.learningItemId)) {
        throw new Error('Add the section to an existing learning item.');
      }
      if (
        values.parentSectionId &&
        !current.sections.some(
          (section) =>
            section.id === values.parentSectionId &&
            section.learningItemId === values.learningItemId,
        )
      ) {
        throw new Error('The parent section does not belong to this learning item.');
      }
      const timestamp = nowIso();
      const section: LearningSection = {
        ...values,
        id: makeLearningSectionId(),
        completedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      queueSave({
        ...current,
        sections: [...current.sections, section],
        deletedSectionIds: current.deletedSectionIds.filter(
          (id) => id !== section.id,
        ),
      });
      return section;
    },
    [queueSave],
  );

  const updateSection = useCallback(
    (section: LearningSection) => {
      if (
        !snapshotRef.current.sections.some((value) => value.id === section.id)
      ) {
        throw new Error('This learning section no longer exists.');
      }
      queueSave({
        ...snapshotRef.current,
        sections: snapshotRef.current.sections.map((value) =>
          value.id === section.id
            ? { ...section, updatedAt: nowIso() }
            : value,
        ),
      });
    },
    [queueSave],
  );

  const deleteSection = useCallback(
    (id: string) => {
      const current = snapshotRef.current;
      if (!current.sections.some((section) => section.id === id)) {
        throw new Error('This learning section no longer exists.');
      }
      const deleted = new Set([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const section of current.sections) {
          if (
            section.parentSectionId &&
            deleted.has(section.parentSectionId) &&
            !deleted.has(section.id)
          ) {
            deleted.add(section.id);
            changed = true;
          }
        }
      }
      queueSave({
        ...current,
        sections: current.sections.filter(
          (section) => !deleted.has(section.id),
        ),
        deletedSectionIds: [
          ...new Set([...current.deletedSectionIds, ...deleted]),
        ],
      });
    },
    [queueSave],
  );

  const retrySync = useCallback(async () => {
    const ownerId = ownerIdRef.current;
    if (!ownerId) return;
    await saveQueue.current;
    const revision = saveRevision.current;
    const current = snapshotRef.current;
    try {
      const client = createSupabaseClient();
      if (!client) throw new Error('Supabase is not configured.');
      const synced = current.syncPending
        ? await syncSnapshot(current, ownerId)
        : await readCloudLearning(client, ownerId);
      await saveLocalLearning(synced, ownerId);
      if (
        ownerIdRef.current === ownerId &&
        revision === saveRevision.current
      ) {
        showSnapshot(synced);
        setLearningError(null);
      }
    } catch (syncError) {
      if (ownerIdRef.current === ownerId) {
        setLearningError(
          `Learning cloud sync failed: ${syncError instanceof Error ? syncError.message : String(syncError)}`,
        );
      }
    }
  }, [setLearningError, showSnapshot, syncSnapshot]);

  const value = useMemo<LearningContextValue>(
    () => ({
      items: canAccessSnapshot ? snapshot.items : [],
      sections: canAccessSnapshot ? snapshot.sections : [],
      ready,
      error,
      addItem,
      updateItem,
      archiveItem,
      deleteItem,
      addSection,
      updateSection,
      deleteSection,
      retrySync,
    }),
    [
      snapshot,
      ready,
      canAccessSnapshot,
      error,
      addItem,
      updateItem,
      archiveItem,
      deleteItem,
      addSection,
      updateSection,
      deleteSection,
      retrySync,
    ],
  );

  return (
    <LearningContext.Provider value={value}>{children}</LearningContext.Provider>
  );
}

export function useLearning() {
  const context = useContext(LearningContext);
  if (!context) {
    throw new Error('useLearning must be used within LearningProvider.');
  }
  return context;
}
