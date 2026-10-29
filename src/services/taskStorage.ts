import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Task,
  type TaskSource,
} from '../domain/task';
import { isValidDateOnly } from '../domain/subscription';

const storageKey = 'my_stack.tasks.v1';

export type TaskSnapshot = {
  tasks: Task[];
  syncPending: boolean;
};

const sourceColumns = [
  ['learning_item_id', 'learning_item'],
  ['referral_request_id', 'referral_request'],
  ['subscription_id', 'subscription'],
  ['tool_id', 'tool'],
  ['contact_id', 'contact'],
  ['opportunity_id', 'opportunity'],
] as const;

function keyForUser(userId?: string): string {
  return userId ? `${storageKey}.user.${userId}` : storageKey;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isTaskSource(value: unknown): value is TaskSource {
  if (!isRecord(value) || typeof value.id !== 'string') return false;
  return sourceColumns.some(([, type]) => type === value.type);
}

function isTask(value: unknown): value is Task {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    value.title.trim().length > 0 &&
    typeof value.description === 'string' &&
    (value.dueDate === null ||
      (typeof value.dueDate === 'string' && isValidDateOnly(value.dueDate))) &&
    nullableString(value.dueAt) &&
    (value.dueAt === null || Number.isFinite(Date.parse(value.dueAt))) &&
    TASK_PRIORITIES.some((priority) => priority === value.priority) &&
    TASK_STATUSES.some((status) => status === value.status) &&
    typeof value.reminderEnabled === 'boolean' &&
    nullableString(value.remindAt) &&
    (value.remindAt === null || Number.isFinite(Date.parse(value.remindAt))) &&
    nullableString(value.completedAt) &&
    (value.completedAt === null ||
      Number.isFinite(Date.parse(value.completedAt))) &&
    (value.source === null || isTaskSource(value.source)) &&
    typeof value.createdAt === 'string' &&
    Number.isFinite(Date.parse(value.createdAt)) &&
    typeof value.updatedAt === 'string' &&
    Number.isFinite(Date.parse(value.updatedAt))
  );
}

export async function loadLocalTasks(
  userId?: string,
): Promise<TaskSnapshot | null> {
  const encoded = await AsyncStorage.getItem(keyForUser(userId));
  if (encoded === null) return null;

  const decoded: unknown = JSON.parse(encoded);
  if (
    !isRecord(decoded) ||
    decoded.version !== 1 ||
    !Array.isArray(decoded.tasks) ||
    !decoded.tasks.every(isTask) ||
    typeof decoded.syncPending !== 'boolean'
  ) {
    throw new Error('Saved task data has an unsupported format.');
  }
  return { tasks: decoded.tasks, syncPending: decoded.syncPending };
}

export async function saveLocalTasks(
  snapshot: TaskSnapshot,
  userId?: string,
): Promise<void> {
  await AsyncStorage.setItem(
    keyForUser(userId),
    JSON.stringify({ version: 1, ...snapshot }),
  );
}

function sourceFromRow(row: Record<string, unknown>): TaskSource | null {
  for (const [column] of sourceColumns) {
    if (row[column] !== null && typeof row[column] !== 'string') {
      throw new Error('Task data from Supabase has an invalid source record.');
    }
  }
  const found = sourceColumns.flatMap(([column, type]) => {
    const value = row[column];
    return typeof value === 'string' ? [{ type, id: value }] : [];
  });
  if (found.length > 1) {
    throw new Error('Task data from Supabase has multiple source records.');
  }
  return found.length === 0 ? null : found[0];
}

export function taskFromRow(row: Record<string, unknown>): Task {
  const task: Task = {
    id: typeof row.id === 'string' ? row.id : '',
    title: typeof row.title === 'string' ? row.title : '',
    description: typeof row.description === 'string' ? row.description : '',
    dueDate: row.due_date as string | null,
    dueAt: row.due_at as string | null,
    priority: row.priority as Task['priority'],
    status: row.status as Task['status'],
    reminderEnabled: row.reminder_enabled as boolean,
    remindAt: row.remind_at as string | null,
    completedAt: row.completed_at as string | null,
    source: sourceFromRow(row),
    createdAt: typeof row.created_at === 'string' ? row.created_at : '',
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : '',
  };
  if (!isTask(task)) {
    throw new Error('Task data from Supabase has an unsupported format.');
  }
  return task;
}

export async function readCloudTasks(
  client: SupabaseClient,
  userId: string,
): Promise<TaskSnapshot> {
  const { data, error } = await client
    .from('tasks')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return {
    tasks: (data ?? []).map((row) =>
      taskFromRow(row as Record<string, unknown>),
    ),
    syncPending: false,
  };
}

function taskToRow(task: Task, userId: string): Record<string, unknown> {
  const sourceRow: Record<string, string | null> = Object.fromEntries(
    sourceColumns.map(([column]) => [column, null]),
  );
  if (task.source) {
    const column = sourceColumns.find(([, type]) => type === task.source?.type)?.[0];
    if (!column) throw new Error('Task source type is unsupported.');
    sourceRow[column] = task.source.id;
  }
  return {
    id: task.id,
    user_id: userId,
    title: task.title,
    description: task.description,
    due_date: task.dueDate,
    due_at: task.dueAt,
    priority: task.priority,
    status: task.status,
    reminder_enabled: task.reminderEnabled,
    remind_at: task.remindAt,
    completed_at: task.completedAt,
    ...sourceRow,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  };
}

export async function writeCloudTasks(
  client: SupabaseClient,
  userId: string,
  snapshot: TaskSnapshot,
): Promise<void> {
  if (snapshot.tasks.length === 0) return;
  const { error } = await client
    .from('tasks')
    .upsert(
      snapshot.tasks.map((task) => taskToRow(task, userId)),
      { onConflict: 'user_id,id' },
    );
  if (error) throw error;
}
