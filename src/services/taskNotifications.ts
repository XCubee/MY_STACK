import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import type { Task } from '../domain/task';

const channelId = 'task-reminders';
const notificationKind = 'task_reminder';

async function notificationsForOwner(userId: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.filter(
    (notification) =>
      notification.content.data?.userId === userId &&
      notification.content.data?.kind === notificationKind,
  );
}

export async function syncTaskNotifications(
  tasks: Task[],
  userId: string,
  requestPermission: boolean,
): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(channelId, {
      name: 'Task reminders',
      importance: AndroidImportance.DEFAULT,
    });
  }

  const existing = await notificationsForOwner(userId);
  await Promise.all(
    existing.map((notification) =>
      Notifications.cancelScheduledNotificationAsync(notification.identifier),
    ),
  );

  const pending = tasks.filter(
    (task): task is Task & { remindAt: string } =>
      task.reminderEnabled &&
      task.remindAt !== null &&
      (task.status === 'open' || task.status === 'in_progress') &&
      Date.parse(task.remindAt) > Date.now(),
  );
  if (pending.length === 0) return true;

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && requestPermission) {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return false;

  await Promise.all(
    pending.map((task) =>
      Notifications.scheduleNotificationAsync({
        content: {
          title: task.title,
          body: task.description || 'You have a task reminder.',
          data: {
            kind: notificationKind,
            taskId: task.id,
            userId,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(task.remindAt),
          channelId,
        },
      }),
    ),
  );
  return true;
}

export async function clearTaskNotifications(userId: string): Promise<void> {
  const existing = await notificationsForOwner(userId);
  await Promise.all(
    existing.map((notification) =>
      Notifications.cancelScheduledNotificationAsync(notification.identifier),
    ),
  );
}
