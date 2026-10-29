import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ActivityEvent,
  ActivityEventType,
  ActivitySourceType,
} from '../domain/activity';

const storageKey = 'my_stack.activity.v1';

export type ActivitySnapshot = {
  events: ActivityEvent[];
  pendingIds: string[];
};

function keyForUser(userId?: string): string {
  return userId ? `${storageKey}.user.${userId}` : storageKey;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isActivityEvent(value: unknown): value is ActivityEvent {
  if (!isRecord(value) || !isRecord(value.metadata)) return false;
  return (
    typeof value.id === 'string' &&
    [
      'created',
      'updated',
      'archived',
      'completed',
      'status_changed',
      'interaction_logged',
      'follow_up_scheduled',
      'reminder_completed',
    ].includes(String(value.eventType)) &&
    [
      'learning_item',
      'learning_section',
      'contact',
      'opportunity',
      'referral_request',
      'interaction',
      'task',
      'note',
      'subscription',
      'tool',
    ].includes(String(value.sourceType)) &&
    typeof value.sourceId === 'string' &&
    typeof value.summary === 'string' &&
    typeof value.createdAt === 'string'
  );
}

export async function loadLocalActivity(
  userId?: string,
): Promise<ActivitySnapshot | null> {
  const encoded = await AsyncStorage.getItem(keyForUser(userId));
  if (encoded === null) return null;
  const decoded: unknown = JSON.parse(encoded);
  if (
    !isRecord(decoded) ||
    decoded.version !== 1 ||
    !Array.isArray(decoded.events) ||
    !decoded.events.every(isActivityEvent) ||
    !Array.isArray(decoded.pendingIds) ||
    !decoded.pendingIds.every((id) => typeof id === 'string')
  ) {
    throw new Error('Saved activity data has an unsupported format.');
  }
  return {
    events: decoded.events,
    pendingIds: decoded.pendingIds,
  };
}

export async function saveLocalActivity(
  snapshot: ActivitySnapshot,
  userId?: string,
): Promise<void> {
  await AsyncStorage.setItem(
    keyForUser(userId),
    JSON.stringify({ version: 1, ...snapshot }),
  );
}

function activityFromRow(row: Record<string, unknown>): ActivityEvent {
  const metadata = row.metadata;
  if (
    typeof row.id !== 'string' ||
    typeof row.event_type !== 'string' ||
    typeof row.source_type !== 'string' ||
    typeof row.source_id !== 'string' ||
    typeof row.summary !== 'string' ||
    typeof row.created_at !== 'string' ||
    !isRecord(metadata) ||
    ![
      'created',
      'updated',
      'archived',
      'completed',
      'status_changed',
      'interaction_logged',
      'follow_up_scheduled',
      'reminder_completed',
    ].includes(row.event_type) ||
    ![
      'learning_item',
      'learning_section',
      'contact',
      'opportunity',
      'referral_request',
      'interaction',
      'task',
      'note',
      'subscription',
      'tool',
    ].includes(row.source_type)
  ) {
    throw new Error('Activity data from Supabase has an unsupported format.');
  }
  return {
    id: row.id,
    eventType: row.event_type as ActivityEventType,
    sourceType: row.source_type as ActivitySourceType,
    sourceId: row.source_id,
    summary: row.summary,
    metadata,
    createdAt: row.created_at,
  };
}

export async function readCloudActivity(
  client: SupabaseClient,
  userId: string,
): Promise<ActivityEvent[]> {
  const { data, error } = await client
    .from('activity_events')
    .select('id,event_type,source_type,source_id,summary,metadata,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((row) =>
    activityFromRow(row as Record<string, unknown>),
  );
}

export async function insertCloudActivity(
  client: SupabaseClient,
  userId: string,
  event: ActivityEvent,
): Promise<void> {
  const { error } = await client.from('activity_events').insert({
    id: event.id,
    user_id: userId,
    event_type: event.eventType,
    source_type: event.sourceType,
    source_id: event.sourceId,
    summary: event.summary,
    metadata: event.metadata,
    created_at: event.createdAt,
  });
  if (error && error.code !== '23505') throw error;
}
