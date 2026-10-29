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
import type { Task } from '../domain/task';
import type { ReferralRequest } from '../domain/referral';
import { useApp } from './AppContext';
import { useReferrals } from './ReferralContext';
import {
  loadLocalTasks,
  readCloudTasks,
  saveLocalTasks,
  writeCloudTasks,
  type TaskSnapshot,
} from '../services/taskStorage';
import {
  clearTaskNotifications,
  syncTaskNotifications,
} from '../services/taskNotifications';
import { createSupabaseClient } from '../services/supabase';

type NewTask = Omit<Task, 'id' | 'completedAt' | 'createdAt' | 'updatedAt'>;

type TaskContextValue = {
  tasks: Task[];
  ready: boolean;
  error: string | null;
  reminderMessage: string;
  addTask: (task: NewTask) => Task;
  updateTask: (task: Task) => void;
  retrySync: () => Promise<void>;
  retryReminders: () => Promise<void>;
  syncReferralFollowUp: (
    request: ReferralRequest,
    title: string,
    reschedule: boolean,
  ) => void;
};

const EMPTY_SNAPSHOT: TaskSnapshot = { tasks: [], syncPending: false };

const TaskContext = createContext<TaskContextValue | null>(null);

function mergeById(local: Task[], cloud: Task[]): Task[] {
  const merged = new Map<string, Task>();
  for (const task of [...cloud, ...local]) merged.set(task.id, task);
  return [...merged.values()];
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeTaskId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function TaskProvider({ children }: PropsWithChildren) {
  const { authStatus, currentUser } = useApp();
  const { requests, updateRequest } = useReferrals();
  const ownerId =
    authStatus === 'authenticated' || authStatus === 'onboarding'
      ? currentUser?.id
      : undefined;
  const identity =
    ownerId ?? (authStatus === 'offline' ? 'local' : `session:${authStatus}`);
  const notificationOwnerId =
    ownerId ?? (authStatus === 'offline' ? 'local-device' : undefined);
  const [snapshot, setSnapshot] = useState<TaskSnapshot>(EMPTY_SNAPSHOT);
  const [loadedIdentity, setLoadedIdentity] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<{
    identity: string;
    message: string;
  } | null>(null);
  const [reminderState, setReminderState] = useState<{
    identity: string;
    message: string;
  } | null>(null);
  const snapshotRef = useRef(snapshot);
  const ownerIdRef = useRef<string | undefined>(undefined);
  const identityRef = useRef('local');
  const notificationOwnerRef = useRef<string | undefined>(undefined);
  const saveRevision = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const ready = loadedIdentity === identity;
  const canAccessSnapshot = ready && (authStatus === 'offline' || Boolean(ownerId));
  const error =
    errorState?.identity === identity ? errorState.message : null;
  const reminderMessage =
    reminderState?.identity === identity ? reminderState.message : '';

  const showSnapshot = useCallback((next: TaskSnapshot) => {
    snapshotRef.current = next;
    setSnapshot(next);
  }, []);
  const setTaskError = useCallback((message: string | null) => {
    setErrorState(
      message === null
        ? null
        : { identity: identityRef.current, message },
    );
  }, []);
  const setReminderNotice = useCallback((message: string) => {
    setReminderState({ identity: identityRef.current, message });
  }, []);
  const syncSnapshot = useCallback(
    async (next: TaskSnapshot, userId: string): Promise<TaskSnapshot> => {
      const client = createSupabaseClient();
      if (!client) throw new Error('Supabase is not configured.');
      await writeCloudTasks(client, userId, next);
      return { ...next, syncPending: false };
    },
    [],
  );
  const scheduleNotifications = useCallback(
    async (
      tasks: Task[],
      userId: string,
      requestPermission: boolean,
      expectedIdentity: string,
    ) => {
      const granted = await syncTaskNotifications(
        tasks,
        userId,
        requestPermission,
      );
      if (identityRef.current !== expectedIdentity) return;
      const hasReminders = tasks.some(
        (task) =>
          task.reminderEnabled &&
          (task.status === 'open' || task.status === 'in_progress'),
      );
      setReminderNotice(
        granted || !hasReminders
          ? ''
          : 'Tasks are saved, but notifications are off. Enable them in device settings to receive reminders.',
      );
    },
    [setReminderNotice],
  );

  useEffect(() => {
    let cancelled = false;
    ownerIdRef.current = ownerId;
    identityRef.current = identity;

    const previousNotificationOwner = notificationOwnerRef.current;
    if (
      previousNotificationOwner &&
      previousNotificationOwner !== notificationOwnerId
    ) {
      void clearTaskNotifications(previousNotificationOwner).catch(
        (clearError: unknown) => {
          if (!cancelled) {
            setReminderNotice(
              `Could not clear reminders for the previous account: ${clearError instanceof Error ? clearError.message : String(clearError)}`,
            );
          }
        },
      );
    }
    notificationOwnerRef.current = notificationOwnerId;

    const hydrate = async () => {
      try {
        if (authStatus === 'loading') return;
        if (authStatus !== 'offline' && !ownerId) return;

        const local = (await loadLocalTasks(ownerId)) ?? EMPTY_SNAPSHOT;
        if (authStatus === 'offline') {
          if (!cancelled) {
            showSnapshot(local);
            await scheduleNotifications(
              local.tasks,
              'local-device',
              false,
              identity,
            );
          }
          return;
        }

        const client = createSupabaseClient();
        if (!client || !ownerId) {
          if (!cancelled) {
            showSnapshot(local);
            setTaskError(
              'Task data is available locally; cloud sync is not configured.',
            );
          }
          return;
        }

        let cloud: TaskSnapshot;
        try {
          cloud = await readCloudTasks(client, ownerId);
        } catch (readError) {
          if (!cancelled) {
            showSnapshot(local);
            setTaskError(
              `Could not load tasks from Supabase: ${readError instanceof Error ? readError.message : String(readError)}`,
            );
            await scheduleNotifications(
              local.tasks,
              ownerId,
              false,
              identity,
            );
          }
          return;
        }

        const next = local.syncPending
          ? {
              tasks: mergeById(local.tasks, cloud.tasks),
              syncPending: true,
            }
          : cloud;
        if (cancelled) return;
        showSnapshot(next);
        await saveLocalTasks(next, ownerId);
        if (next.syncPending) {
          try {
            const synced = await syncSnapshot(next, ownerId);
            await saveLocalTasks(synced, ownerId);
            if (!cancelled) showSnapshot(synced);
          } catch (syncError) {
            if (!cancelled) {
              setTaskError(
                `Task cloud sync failed: ${syncError instanceof Error ? syncError.message : String(syncError)}`,
              );
            }
          }
        }
        if (!cancelled) {
          await scheduleNotifications(next.tasks, ownerId, false, identity);
        }
      } catch (loadError) {
        if (!cancelled) {
          setTaskError(
            `Could not load saved tasks: ${loadError instanceof Error ? loadError.message : String(loadError)}`,
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
    notificationOwnerId,
    ownerId,
    scheduleNotifications,
    setReminderNotice,
    setTaskError,
    showSnapshot,
    syncSnapshot,
  ]);

  const queueSave = useCallback(
    (next: TaskSnapshot, requestPermission: boolean) => {
      const userId = ownerIdRef.current;
      const expectedIdentity = identityRef.current;
      const currentNotificationOwner = notificationOwnerRef.current;
      const revision = ++saveRevision.current;
      const pending = { ...next, syncPending: Boolean(userId) };
      showSnapshot(pending);
      saveQueue.current = saveQueue.current.then(async () => {
        try {
          await saveLocalTasks(pending, userId);
        } catch (saveError) {
          if (
            ownerIdRef.current === userId &&
            identityRef.current === expectedIdentity
          ) {
            setTaskError(
              `Could not save tasks on this device: ${saveError instanceof Error ? saveError.message : String(saveError)}`,
            );
          }
          return;
        }

        let synced = pending;
        if (userId) {
          try {
            synced = await syncSnapshot(pending, userId);
            await saveLocalTasks(synced, userId);
            if (ownerIdRef.current === userId) setTaskError(null);
          } catch (syncError) {
            if (
              ownerIdRef.current === userId &&
              identityRef.current === expectedIdentity
            ) {
              setTaskError(
                `Task data is saved on this device, but cloud sync failed: ${syncError instanceof Error ? syncError.message : String(syncError)}`,
              );
            }
          }
        }

        if (
          ownerIdRef.current === userId &&
          identityRef.current === expectedIdentity &&
          revision === saveRevision.current
        ) {
          showSnapshot(synced);
        }
        if (currentNotificationOwner) {
          try {
            await scheduleNotifications(
              pending.tasks,
              currentNotificationOwner,
              requestPermission,
              expectedIdentity,
            );
          } catch (notificationError) {
            if (identityRef.current === expectedIdentity) {
              setReminderNotice(
                `Could not schedule task reminders: ${notificationError instanceof Error ? notificationError.message : String(notificationError)}`,
              );
            }
          }
        }
      });
    },
    [
      scheduleNotifications,
      setReminderNotice,
      setTaskError,
      showSnapshot,
      syncSnapshot,
    ],
  );

  const addTask = useCallback(
    (values: NewTask) => {
      const timestamp = nowIso();
      const task: Task = {
        ...values,
        id: makeTaskId(),
        completedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      queueSave(
        { ...snapshotRef.current, tasks: [task, ...snapshotRef.current.tasks] },
        task.reminderEnabled,
      );
      return task;
    },
    [queueSave],
  );

  const updateTask = useCallback(
    (task: Task) => {
      const currentTask = snapshotRef.current.tasks.find(
        (item) => item.id === task.id,
      );
      if (!currentTask) {
        throw new Error('This task no longer exists.');
      }
      const nextTask = {
        ...task,
        completedAt:
          task.status === 'completed'
            ? task.completedAt ?? nowIso()
            : null,
        updatedAt: nowIso(),
      };
      queueSave(
        {
          ...snapshotRef.current,
          tasks: snapshotRef.current.tasks.map((item) =>
            item.id === task.id ? nextTask : item,
          ),
        },
        nextTask.reminderEnabled,
      );
      const source = currentTask.source;
      const linkedRequest =
        source?.type === 'referral_request' &&
        currentTask.id === `referral-follow-up-${source.id}`
          ? requests.find((request) => request.id === source.id)
          : undefined;
      if (linkedRequest) {
        const stillLinked =
          nextTask.source?.type === 'referral_request' &&
          nextTask.source.id === linkedRequest.id;
        const wasClosed =
          currentTask.status === 'completed' ||
          currentTask.status === 'canceled';
        const isClosed =
          nextTask.status === 'completed' ||
          nextTask.status === 'canceled';
        const changedDueDate = currentTask.dueDate !== nextTask.dueDate;
        const nextFollowUpAt =
          !stillLinked || isClosed
            ? null
            : changedDueDate || wasClosed
              ? nextTask.dueDate
                ? `${nextTask.dueDate}T12:00:00.000Z`
                : null
              : linkedRequest.nextFollowUpAt;
        if (nextFollowUpAt !== linkedRequest.nextFollowUpAt) {
          updateRequest({
            ...linkedRequest,
            nextFollowUpAt,
          });
        }
      }
    },
    [queueSave, requests, updateRequest],
  );

  const syncReferralFollowUp = useCallback(
    (request: ReferralRequest, title: string, reschedule: boolean) => {
      const current = snapshotRef.current;
      const taskId = `referral-follow-up-${request.id}`;
      const existing = current.tasks.find((task) => task.id === taskId);
      const followUpDate =
        request.status === 'closed'
          ? null
          : request.nextFollowUpAt?.slice(0, 10) ?? null;
      const timestamp = nowIso();
      if (!followUpDate) {
        if (
          !existing ||
          existing.status === 'completed' ||
          existing.status === 'canceled'
        ) {
          return;
        }
        queueSave(
          {
            ...current,
            tasks: current.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    status: 'canceled',
                    reminderEnabled: false,
                    remindAt: null,
                    updatedAt: timestamp,
                  }
                : task,
            ),
          },
          false,
        );
        return;
      }

      const nextTask: Task = existing
        ? {
            ...existing,
            title,
            dueDate: followUpDate,
            status:
              reschedule ||
              existing.status === 'completed' ||
              existing.status === 'canceled'
                ? 'open'
                : existing.status,
            reminderEnabled: reschedule ? false : existing.reminderEnabled,
            remindAt: reschedule ? null : existing.remindAt,
            completedAt: null,
            updatedAt: timestamp,
          }
        : {
            id: taskId,
            title,
            description: 'Follow up regarding this referral request.',
            dueDate: followUpDate,
            dueAt: null,
            priority: 'normal',
            status: 'open',
            reminderEnabled: false,
            remindAt: null,
            completedAt: null,
            source: { type: 'referral_request', id: request.id },
            createdAt: timestamp,
            updatedAt: timestamp,
          };
      queueSave(
        {
          ...current,
          tasks: existing
            ? current.tasks.map((task) =>
                task.id === taskId ? nextTask : task,
              )
            : [nextTask, ...current.tasks],
        },
        nextTask.reminderEnabled,
      );
    },
    [queueSave],
  );

  const retrySync = useCallback(async () => {
    const userId = ownerIdRef.current;
    if (!userId) return;
    await saveQueue.current;
    const revision = saveRevision.current;
    const current = snapshotRef.current;
    try {
      const client = createSupabaseClient();
      if (!client) throw new Error('Supabase is not configured.');
      const synced = current.syncPending
        ? await syncSnapshot(current, userId)
        : await readCloudTasks(client, userId);
      await saveLocalTasks(synced, userId);
      if (
        ownerIdRef.current === userId &&
        revision === saveRevision.current
      ) {
        showSnapshot(synced);
        setTaskError(null);
        await scheduleNotifications(
          synced.tasks,
          userId,
          false,
          identityRef.current,
        );
      }
    } catch (syncError) {
      if (ownerIdRef.current === userId) {
        setTaskError(
          `Task cloud sync failed: ${syncError instanceof Error ? syncError.message : String(syncError)}`,
        );
      }
    }
  }, [scheduleNotifications, setTaskError, showSnapshot, syncSnapshot]);

  const retryReminders = useCallback(async () => {
    const notificationOwner = notificationOwnerRef.current;
    if (!notificationOwner) return;
    try {
      await scheduleNotifications(
        snapshotRef.current.tasks,
        notificationOwner,
        true,
        identityRef.current,
      );
    } catch (notificationError) {
      setReminderNotice(
        `Could not schedule task reminders: ${notificationError instanceof Error ? notificationError.message : String(notificationError)}`,
      );
    }
  }, [scheduleNotifications, setReminderNotice]);

  const value = useMemo<TaskContextValue>(
    () => ({
      tasks: canAccessSnapshot ? snapshot.tasks : [],
      ready,
      error,
      reminderMessage,
      addTask,
      updateTask,
      retrySync,
      retryReminders,
      syncReferralFollowUp,
    }),
    [
      snapshot,
      canAccessSnapshot,
      ready,
      error,
      reminderMessage,
      addTask,
      updateTask,
      retrySync,
      retryReminders,
      syncReferralFollowUp,
    ],
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTasks must be used within TaskProvider.');
  }
  return context;
}
