import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  REMINDER_DAY_OPTIONS,
  isValidDateOnly,
  type Subscription,
} from '../domain/subscription';

const dataKey = 'my_stack.subscriptions.v1';
const pendingKey = 'my_stack.subscriptions_sync_pending.v1';

function storageKey(key: string, userId?: string): string {
  return userId ? `${key}.user.${userId}` : key;
}

function isSubscription(value: unknown): value is Subscription {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.amount === 'number' &&
    Number.isFinite(item.amount) &&
    item.amount >= 0 &&
    typeof item.currency === 'string' &&
    /^[A-Z]{3}$/.test(item.currency) &&
    typeof item.renewalDate === 'string' &&
    isValidDateOnly(item.renewalDate) &&
    ['weekly', 'monthly', 'yearly'].includes(String(item.billingCycle)) &&
    typeof item.category === 'string' &&
    typeof item.reminderEnabled === 'boolean' &&
    typeof item.reminderDaysBefore === 'number' &&
    REMINDER_DAY_OPTIONS.includes(
      item.reminderDaysBefore as (typeof REMINDER_DAY_OPTIONS)[number],
    ) &&
    typeof item.notes === 'string'
  );
}

export async function loadLocalSubscriptions(
  userId?: string,
): Promise<Subscription[] | null> {
  const encoded = await AsyncStorage.getItem(storageKey(dataKey, userId));
  if (encoded === null) return null;
  const decoded: unknown = JSON.parse(encoded);
  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    !('version' in decoded) ||
    decoded.version !== 1 ||
    !('subscriptions' in decoded) ||
    !Array.isArray(decoded.subscriptions) ||
    !decoded.subscriptions.every(isSubscription)
  ) {
    throw new Error('Saved subscription data has an unsupported format.');
  }
  return decoded.subscriptions;
}

export async function saveLocalSubscriptions(
  subscriptions: Subscription[],
  userId?: string,
): Promise<void> {
  await AsyncStorage.setItem(
    storageKey(dataKey, userId),
    JSON.stringify({ version: 1, subscriptions }),
  );
}

export async function hasPendingSubscriptionSync(userId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(storageKey(pendingKey, userId))) === 'true';
}

export async function markSubscriptionSyncPending(userId: string): Promise<void> {
  await AsyncStorage.setItem(storageKey(pendingKey, userId), 'true');
}

export async function clearSubscriptionSyncPending(userId: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(pendingKey, userId));
}
