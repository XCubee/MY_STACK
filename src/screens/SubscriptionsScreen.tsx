import { useMemo } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { ActionButton, Notice } from '../components/ui';
import { StackMark } from '../components/StackMark';
import {
  daysUntilRenewal,
  formatCurrency,
  formatRenewalDate,
  type Subscription,
} from '../domain/subscription';
import type { RootStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';
import { selectionHaptic } from '../utils/haptics';

function monthlyEstimate(subscription: Subscription): number {
  if (subscription.billingCycle === 'weekly') return subscription.amount * 52 / 12;
  if (subscription.billingCycle === 'yearly') return subscription.amount / 12;
  return subscription.amount;
}

function daysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

export function SubscriptionsScreen() {
  const {
    subscriptions,
    theme,
    currentUser,
    reminderMessage,
    syncStatus,
    syncMessage,
  } = useApp();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const ordered = useMemo(
    () =>
      [...subscriptions].sort((a, b) =>
        a.renewalDate.localeCompare(b.renewalDate),
      ),
    [subscriptions],
  );
  const monthlyTotals = new Map<string, number>();
  for (const subscription of subscriptions) {
    monthlyTotals.set(
      subscription.currency,
      (monthlyTotals.get(subscription.currency) ?? 0) +
        monthlyEstimate(subscription),
    );
  }
  const monthlySpendSummary =
    [...monthlyTotals]
      .map(([currency, amount]) => formatCurrency(amount, currency))
      .join(' + ') || formatCurrency(0, 'USD');
  const nextSevenDays = subscriptions.filter((subscription) => {
    const days = daysUntilRenewal(subscription.renewalDate);
    return days >= 0 && days <= 7;
  }).length;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <FlatList
        data={ordered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={styles.topBar}>
              <StackMark size={42} />
              <View style={styles.greeting}>
                <Text style={[styles.eyebrow, { color: theme.colors.muted }]}>
                  MY STACK
                </Text>
                <Text style={[styles.title, { color: theme.colors.text }]}>
                  Subscriptions
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add subscription"
                onPress={() => {
                  selectionHaptic();
                  navigation.navigate('SubscriptionForm', undefined);
                }}
                style={[
                  styles.addIcon,
                  { backgroundColor: theme.colors.primary },
                ]}
              >
                <Text style={[styles.addGlyph, { color: theme.colors.onPrimary }]}>
                  +
                </Text>
              </Pressable>
            </View>
            <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
              Stay ahead of your next renewal.
            </Text>

            <View
              style={[
                styles.summary,
                {
                  backgroundColor: theme.dark ? '#10271B' : '#E2F4E8',
                  borderColor: theme.dark ? '#225236' : '#B9DFC5',
                },
              ]}
            >
              <View style={styles.summaryHeader}>
                <View>
                  <Text
                    style={[
                      styles.summaryLabel,
                      { color: theme.colors.muted },
                    ]}
                  >
                    ESTIMATED MONTHLY SPEND
                  </Text>
                  <Text
                    style={[styles.summaryTotal, { color: theme.colors.text }]}
                  >
                    {monthlySpendSummary}
                  </Text>
                </View>
                <View
                  style={[
                    styles.summaryBadge,
                    { backgroundColor: theme.colors.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.summaryBadgeText,
                      { color: theme.colors.onPrimary },
                    ]}
                  >
                    {subscriptions.length} ACTIVE
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.summaryDivider,
                  { backgroundColor: theme.colors.border },
                ]}
              />
              <View style={styles.summaryFooter}>
                <Text style={[styles.summaryHint, { color: theme.colors.muted }]}>
                  Weekly and yearly plans are averaged monthly
                </Text>
                <Text style={[styles.dueCount, { color: theme.colors.primary }]}>
                  {nextSevenDays} due soon
                </Text>
              </View>
            </View>

            {reminderMessage ? (
              <Notice warning>{reminderMessage}</Notice>
            ) : null}
            {syncStatus === 'error' ? <Notice warning>{syncMessage}</Notice> : null}

            <View style={styles.sectionHeading}>
              <View>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                  Upcoming renewals
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.colors.muted }]}>
                  {currentUser?.email ?? 'Your personal subscription tracker'}
                </Text>
              </View>
              <Text style={[styles.count, { color: theme.colors.muted }]}>
                {ordered.length}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={[styles.emptyIcon, { backgroundColor: theme.colors.chip }]}>
              <Text style={[styles.emptyIconText, { color: theme.colors.primary }]}>
                $
              </Text>
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              Nothing renewing yet
            </Text>
            <Text style={[styles.emptyCopy, { color: theme.colors.muted }]}>
              Add a subscription to see its next renewal and get a reminder
              before you are charged.
            </Text>
            <ActionButton
              label="Add your first subscription"
              onPress={() => navigation.navigate('SubscriptionForm', undefined)}
              style={styles.emptyButton}
            />
          </View>
        }
        renderItem={({ item, index }) => {
          const days = daysUntilRenewal(item.renewalDate);
          const soon = days >= 0 && days <= 7;
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                selectionHaptic();
                navigation.navigate('SubscriptionForm', {
                  subscriptionId: item.id,
                });
              }}
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  marginTop: index === 0 ? 0 : 10,
                },
              ]}
            >
              <View
                style={[
                  styles.serviceIcon,
                  { backgroundColor: theme.colors.chip },
                ]}
              >
                <Text style={[styles.serviceInitial, { color: theme.colors.primary }]}>
                  {item.name.trim().charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.cardDetails}>
                <View style={styles.cardTitleRow}>
                  <Text
                    numberOfLines={1}
                    style={[styles.serviceName, { color: theme.colors.text }]}
                  >
                    {item.name}
                  </Text>
                  <Text style={[styles.price, { color: theme.colors.text }]}>
                    {formatCurrency(item.amount, item.currency)}
                  </Text>
                </View>
                <View style={styles.cardMetaRow}>
                  <Text style={[styles.meta, { color: theme.colors.muted }]}>
                    {formatRenewalDate(item.renewalDate)} · {item.billingCycle}
                  </Text>
                  <Text
                    style={[
                      styles.days,
                      { color: soon ? theme.colors.primary : theme.colors.muted },
                    ]}
                  >
                    {daysLabel(days)}
                  </Text>
                </View>
                <View style={styles.cardBottom}>
                  <Text style={[styles.category, { color: theme.colors.muted }]}>
                    {item.category}
                  </Text>
                  <View
                    style={[
                      styles.reminderPill,
                      {
                        backgroundColor: item.reminderEnabled
                          ? theme.colors.chip
                          : theme.colors.surfaceRaised,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.reminderText,
                        {
                          color: item.reminderEnabled
                            ? theme.colors.primary
                            : theme.colors.muted,
                        },
                      ]}
                    >
                      {item.reminderEnabled ? '◷ Reminder on' : 'Reminder off'}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={<View style={{ height: 24 }} />}
      />
      {ordered.length > 0 ? (
        <View
          style={[
            styles.bottomAction,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <ActionButton
            label="+  Add subscription"
            onPress={() => navigation.navigate('SubscriptionForm', undefined)}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greeting: { flex: 1 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5, marginTop: 2 },
  addIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addGlyph: { fontSize: 32, fontWeight: '500', lineHeight: 36 },
  subtitle: { marginTop: 6, fontSize: 14 },
  summary: {
    borderWidth: 1,
    borderRadius: 19,
    padding: 17,
    marginTop: 20,
    marginBottom: 17,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  summaryLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.9 },
  summaryTotal: { fontSize: 30, fontWeight: '900', marginTop: 7 },
  summaryBadge: { borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8 },
  summaryBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  summaryDivider: { height: 1, marginTop: 16, marginBottom: 11 },
  summaryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryHint: { fontSize: 12, flex: 1 },
  dueCount: { fontWeight: '800', fontSize: 13 },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 21, fontWeight: '900' },
  sectionSubtitle: { fontSize: 13, marginTop: 4 },
  count: { fontWeight: '800', fontSize: 14, marginLeft: 'auto' },
  card: {
    minHeight: 116,
    borderWidth: 1,
    borderRadius: 18,
    padding: 15,
    flexDirection: 'row',
    gap: 11,
  },
  serviceIcon: {
    width: 49,
    height: 49,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceInitial: { fontWeight: '900', fontSize: 20 },
  cardDetails: { flex: 1, justifyContent: 'center' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  serviceName: { flex: 1, fontSize: 17, fontWeight: '800' },
  price: { fontSize: 15, fontWeight: '900' },
  cardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
    gap: 6,
  },
  meta: { fontSize: 12 },
  days: { fontWeight: '800', fontSize: 12 },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  category: { fontSize: 11, fontWeight: '700' },
  reminderPill: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 },
  reminderText: { fontSize: 11, fontWeight: '800' },
  emptyCard: {
    alignItems: 'center',
    padding: 22,
    borderWidth: 1,
    borderRadius: 22,
    marginTop: 12,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconText: { fontWeight: '900', fontSize: 24 },
  emptyTitle: { fontWeight: '900', fontSize: 20, marginTop: 14 },
  emptyCopy: { textAlign: 'center', fontSize: 14, lineHeight: 21, marginTop: 8 },
  emptyButton: { alignSelf: 'stretch', marginTop: 17 },
  bottomAction: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
});
