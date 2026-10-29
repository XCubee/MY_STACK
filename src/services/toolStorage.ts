import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Tool } from '../domain/tool';
import { profileFromRow, type UserProfile } from '../domain/profile';

const toolsKey = 'my_stack.tools.v1';
const profileKey = 'my_stack.profile.v1';
const pendingKey = 'my_stack.cloud_sync_pending.v1';

function storageKey(key: string, userId?: string): string {
  return userId ? `${key}.user.${userId}` : key;
}

function isTool(value: unknown): value is Tool {
  if (typeof value !== 'object' || value === null) return false;
  const tool = value as Record<string, unknown>;
  return (
    typeof tool.id === 'string' &&
    typeof tool.name === 'string' &&
    typeof tool.url === 'string' &&
    typeof tool.description === 'string' &&
    typeof tool.category === 'string' &&
    Array.isArray(tool.tags) &&
    tool.tags.every((tag) => typeof tag === 'string') &&
    typeof tool.notes === 'string' &&
    Array.isArray(tool.projectLinks) &&
    tool.projectLinks.every((link) => typeof link === 'string') &&
    typeof tool.isFavorite === 'boolean' &&
    typeof tool.colorValue === 'number'
  );
}

export async function loadLocalTools(userId?: string): Promise<Tool[] | null> {
  const encoded = await AsyncStorage.getItem(storageKey(toolsKey, userId));
  if (encoded === null) return null;

  const decoded: unknown = JSON.parse(encoded);
  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    !('version' in decoded) ||
    decoded.version !== 1 ||
    !('tools' in decoded) ||
    !Array.isArray(decoded.tools) ||
    !decoded.tools.every(isTool)
  ) {
    throw new Error('Saved tool data has an unsupported format.');
  }
  return decoded.tools;
}

export async function saveLocalTools(
  tools: Tool[],
  userId?: string,
): Promise<void> {
  await AsyncStorage.setItem(
    storageKey(toolsKey, userId),
    JSON.stringify({ version: 1, tools }),
  );
}

export async function loadLocalProfile(
  userId: string,
): Promise<UserProfile | null> {
  const encoded = await AsyncStorage.getItem(storageKey(profileKey, userId));
  if (encoded === null) return null;
  const profile = profileFromRow(JSON.parse(encoded));
  if (!profile || profile.id !== userId) {
    throw new Error('Saved profile data has an unsupported format.');
  }
  return profile;
}

export async function saveLocalProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(
    storageKey(profileKey, profile.id),
    JSON.stringify(profile),
  );
}

export async function clearLocalProfile(userId: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(profileKey, userId));
}

export async function hasPendingCloudSync(userId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(storageKey(pendingKey, userId))) === 'true';
}

export async function markCloudSyncPending(userId: string): Promise<void> {
  await AsyncStorage.setItem(storageKey(pendingKey, userId), 'true');
}

export async function clearCloudSyncPending(userId: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(pendingKey, userId));
}
