import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import {
  daysUntilRenewal,
  formatCurrency,
  type Subscription,
} from '../domain/subscription';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function notificationDate(subscription: Subscription): Date {
  const reminderDate = new Date(`${subscription.renewalDate}T09:00:00`);
  reminderDate.setDate(
    reminderDate.getDate() - subscription.reminderDaysBefore,
  );
  if (
    daysUntilRenewal(subscription.renewalDate) === 0 &&
    reminderDate.getTime() <= Date.now()
  ) {
    return new Date(Date.now() + 60_000);
  }
  return reminderDate;
}

export async function syncSubscriptionNotifications(
  subscriptions: Subscription[],
  userId: string,
  requestPermission: boolean,
): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('subscription-reminders', {
      name: 'Subscription reminders',
      importance: AndroidImportance.DEFAULT,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && requestPermission) {
    ({ status } = await Notifications.requestPermissionsAsync());
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const existing = scheduled.filter(
      (notification) =>
        notification.content.data?.userId === userId &&
        (notification.content.data?.kind === 'subscription_reminder' ||
          typeof notification.content.data?.subscriptionId === 'string'),
  );
  await Promise.all(
    existing.map((notification) =>
      Notifications.cancelScheduledNotificationAsync(
        notification.identifier,
      ),
    ),
  );

  if (status !== 'granted') return false;

  const now = Date.now();
  const toSchedule = subscriptions.filter(
    (subscription) =>
      subscription.reminderEnabled &&
      notificationDate(subscription).getTime() > now,
  );
  await Promise.all(
    toSchedule.map((subscription) => {
      const leadTime =
        subscription.reminderDaysBefore === 0
          ? 'today'
          : `in ${subscription.reminderDaysBefore} ${
              subscription.reminderDaysBefore === 1 ? 'day' : 'days'
            }`;
      return Notifications.scheduleNotificationAsync({
        content: {
          title: `${subscription.name} renews soon`,
          body: `${formatCurrency(subscription.amount, subscription.currency)} renews ${leadTime}.`,
          data: {
            kind: 'subscription_reminder',
            subscriptionId: subscription.id,
            userId,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: notificationDate(subscription),
          channelId: 'subscription-reminders',
        },
      });
    }),
  );
  return true;
}

export async function clearSubscriptionNotifications(
  userId: string,
): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((notification) => notification.content.data?.userId === userId)
      .filter(
        (notification) =>
          notification.content.data?.kind === 'subscription_reminder' ||
          typeof notification.content.data?.subscriptionId === 'string',
      )
      .map((notification) =>
        Notifications.cancelScheduledNotificationAsync(
          notification.identifier,
        ),
      ),
  );
}
