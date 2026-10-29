import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LearningItem, LearningSection } from '../domain/learning';

const storageKey = 'my_stack.learning.v1';

export type LearningSnapshot = {
  items: LearningItem[];
  sections: LearningSection[];
  deletedItemIds: string[];
  deletedSectionIds: string[];
  syncPending: boolean;
};

function keyForUser(userId?: string): string {
  return userId ? `${storageKey}.user.${userId}` : storageKey;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isLearningItem(value: unknown): value is LearningItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    ['course', 'topic', 'skill', 'book', 'tutorial', 'certification', 'roadmap'].includes(String(value.type)) &&
    typeof value.provider === 'string' &&
    typeof value.sourceUrl === 'string' &&
    ['planned', 'in_progress', 'paused', 'completed'].includes(String(value.status)) &&
    (value.progress === null ||
      (typeof value.progress === 'number' &&
        Number.isInteger(value.progress) &&
        value.progress >= 0 &&
        value.progress <= 100)) &&
    typeof value.currentPosition === 'string' &&
    isNullableString(value.startDate) &&
    isNullableString(value.targetDate) &&
    isNullableString(value.lastStudiedDate) &&
    typeof value.notes === 'string' &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === 'string') &&
    isNullableString(value.archivedAt) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function isLearningSection(value: unknown): value is LearningSection {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.learningItemId === 'string' &&
    isNullableString(value.parentSectionId) &&
    typeof value.title === 'string' &&
    typeof value.position === 'number' &&
    Number.isInteger(value.position) &&
    value.position >= 0 &&
    typeof value.isCompleted === 'boolean' &&
    typeof value.url === 'string' &&
    isNullableString(value.completedAt) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

export async function loadLocalLearning(
  userId?: string,
): Promise<LearningSnapshot | null> {
  const encoded = await AsyncStorage.getItem(keyForUser(userId));
  if (encoded === null) return null;

  const decoded: unknown = JSON.parse(encoded);
  if (
    !isRecord(decoded) ||
    decoded.version !== 1 ||
    !Array.isArray(decoded.items) ||
    !decoded.items.every(isLearningItem) ||
    !Array.isArray(decoded.sections) ||
    !decoded.sections.every(isLearningSection) ||
    !Array.isArray(decoded.deletedItemIds) ||
    !decoded.deletedItemIds.every((id) => typeof id === 'string') ||
    !Array.isArray(decoded.deletedSectionIds) ||
    !decoded.deletedSectionIds.every((id) => typeof id === 'string') ||
    typeof decoded.syncPending !== 'boolean'
  ) {
    throw new Error('Saved learning data has an unsupported format.');
  }

  return {
    items: decoded.items,
    sections: decoded.sections,
    deletedItemIds: decoded.deletedItemIds,
    deletedSectionIds: decoded.deletedSectionIds,
    syncPending: decoded.syncPending,
  };
}

export async function saveLocalLearning(
  snapshot: LearningSnapshot,
  userId?: string,
): Promise<void> {
  await AsyncStorage.setItem(
    keyForUser(userId),
    JSON.stringify({ version: 1, ...snapshot }),
  );
}

export function learningItemFromRow(
  row: Record<string, unknown>,
): LearningItem {
  if (
    typeof row.id !== 'string' ||
    typeof row.title !== 'string' ||
    typeof row.item_type !== 'string' ||
    typeof row.provider !== 'string' ||
    typeof row.source_url !== 'string' ||
    typeof row.status !== 'string' ||
    !(row.progress === null || typeof row.progress === 'number') ||
    typeof row.current_position !== 'string' ||
    !(row.start_date === null || typeof row.start_date === 'string') ||
    !(row.target_date === null || typeof row.target_date === 'string') ||
    !(row.last_studied_date === null ||
      typeof row.last_studied_date === 'string') ||
    typeof row.notes !== 'string' ||
    !Array.isArray(row.tags) ||
    !row.tags.every((tag) => typeof tag === 'string') ||
    !(row.archived_at === null || typeof row.archived_at === 'string') ||
    typeof row.created_at !== 'string' ||
    typeof row.updated_at !== 'string'
  ) {
    throw new Error('Learning data from Supabase has an unsupported format.');
  }

  const item: LearningItem = {
    id: row.id,
    title: row.title,
    type: row.item_type as LearningItem['type'],
    provider: row.provider,
    sourceUrl: row.source_url,
    status: row.status as LearningItem['status'],
    progress: row.progress,
    currentPosition: row.current_position,
    startDate: row.start_date,
    targetDate: row.target_date,
    lastStudiedDate: row.last_studied_date,
    notes: row.notes,
    tags: row.tags,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (!isLearningItem(item)) {
    throw new Error('Learning data from Supabase has an unsupported format.');
  }
  return item;
}

export function learningItemToRow(
  item: LearningItem,
  userId: string,
): Record<string, unknown> {
  return {
    id: item.id,
    user_id: userId,
    title: item.title,
    item_type: item.type,
    provider: item.provider,
    source_url: item.sourceUrl,
    status: item.status,
    progress: item.progress,
    current_position: item.currentPosition,
    start_date: item.startDate,
    target_date: item.targetDate,
    last_studied_date: item.lastStudiedDate,
    notes: item.notes,
    tags: item.tags,
    archived_at: item.archivedAt,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

export function learningSectionFromRow(
  row: Record<string, unknown>,
): LearningSection {
  const section: LearningSection = {
    id: typeof row.id === 'string' ? row.id : '',
    learningItemId:
      typeof row.learning_item_id === 'string' ? row.learning_item_id : '',
    parentSectionId:
      typeof row.parent_section_id === 'string' ? row.parent_section_id : null,
    title: typeof row.title === 'string' ? row.title : '',
    position: typeof row.position === 'number' ? row.position : -1,
    isCompleted: row.is_completed === true,
    url: typeof row.url === 'string' ? row.url : '',
    completedAt:
      typeof row.completed_at === 'string' ? row.completed_at : null,
    createdAt: typeof row.created_at === 'string' ? row.created_at : '',
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : '',
  };
  if (!isLearningSection(section)) {
    throw new Error('Learning section from Supabase has an unsupported format.');
  }
  return section;
}

export function learningSectionToRow(
  section: LearningSection,
  userId: string,
): Record<string, unknown> {
  return {
    id: section.id,
    user_id: userId,
    learning_item_id: section.learningItemId,
    parent_section_id: section.parentSectionId,
    title: section.title,
    position: section.position,
    is_completed: section.isCompleted,
    url: section.url,
    completed_at: section.completedAt,
    created_at: section.createdAt,
    updated_at: section.updatedAt,
  };
}

export async function readCloudLearning(
  client: SupabaseClient,
  userId: string,
): Promise<LearningSnapshot> {
  const [itemsResult, sectionsResult] = await Promise.all([
    client.from('learning_items').select('*').eq('user_id', userId),
    client.from('learning_sections').select('*').eq('user_id', userId),
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (sectionsResult.error) throw sectionsResult.error;

  return {
    items: (itemsResult.data ?? []).map((row) =>
      learningItemFromRow(row as Record<string, unknown>),
    ),
    sections: (sectionsResult.data ?? []).map((row) =>
      learningSectionFromRow(row as Record<string, unknown>),
    ),
    deletedItemIds: [],
    deletedSectionIds: [],
    syncPending: false,
  };
}

export async function writeCloudLearning(
  client: SupabaseClient,
  userId: string,
  snapshot: LearningSnapshot,
): Promise<void> {
  if (snapshot.items.length > 0) {
    const { error } = await client
      .from('learning_items')
      .upsert(
        snapshot.items.map((item) => learningItemToRow(item, userId)),
        { onConflict: 'user_id,id' },
      );
    if (error) throw error;
  }

  if (snapshot.sections.length > 0) {
    const { error } = await client
      .from('learning_sections')
      .upsert(
        snapshot.sections.map((section) =>
          learningSectionToRow(section, userId),
        ),
        { onConflict: 'user_id,id' },
      );
    if (error) throw error;
  }

  if (snapshot.deletedSectionIds.length > 0) {
    const { error } = await client
      .from('learning_sections')
      .delete()
      .eq('user_id', userId)
      .in('id', snapshot.deletedSectionIds);
    if (error) throw error;
  }

  if (snapshot.deletedItemIds.length > 0) {
    const { error } = await client
      .from('learning_items')
      .delete()
      .eq('user_id', userId)
      .in('id', snapshot.deletedItemIds);
    if (error) throw error;
  }
}
