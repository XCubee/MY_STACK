import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Tool } from '../domain/tool';

const toolsKey = 'my_stack.tools.v1';
const pendingKey = 'my_stack.cloud_sync_pending.v1';

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

export async function loadLocalTools(): Promise<Tool[] | null> {
  const encoded = await AsyncStorage.getItem(toolsKey);
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

export async function saveLocalTools(tools: Tool[]): Promise<void> {
  await AsyncStorage.setItem(
    toolsKey,
    JSON.stringify({ version: 1, tools }),
  );
}

export async function hasPendingCloudSync(): Promise<boolean> {
  return (await AsyncStorage.getItem(pendingKey)) === 'true';
}

export async function markCloudSyncPending(): Promise<void> {
  await AsyncStorage.setItem(pendingKey, 'true');
}

export async function clearCloudSyncPending(): Promise<void> {
  await AsyncStorage.removeItem(pendingKey);
}
