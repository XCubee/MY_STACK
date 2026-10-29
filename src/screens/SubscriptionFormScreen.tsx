import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActionButton, FormField, Notice, ScreenTitle } from '../components/ui';
import { LinkedTasks } from '../components/LinkedTasks';
import {
  REMINDER_DAY_OPTIONS,
  isValidDateOnly,
  type BillingCycle,
  type Subscription,
} from '../domain/subscription';
import type { RootStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';
import { useActivity } from '../state/ActivityContext';
import { useTasks } from '../state/TaskContext';
import { selectionHaptic } from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'SubscriptionForm'>;
const CATEGORIES = ['Entertainment', 'Work', 'Storage', 'Health', 'Other'];
const CYCLES: BillingCycle[] = ['weekly', 'monthly', 'yearly'];

function dateValueIsValid(value: string): boolean {
  if (!isValidDateOnly(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getTime() >= new Date(new Date().toDateString()).getTime()
  );
}

export function SubscriptionFormScreen({ navigation, route }: Props) {
  const {
    subscriptions,
    theme,
    addSubscription,
    updateSubscription,
    deleteSubscription,
  } = useApp();
  const { recordActivity } = useActivity();
  const { tasks } = useTasks();
  const existing = route.params?.subscriptionId
    ? subscriptions.find(
        (item) => item.id === route.params?.subscriptionId,
      )
    : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [amount, setAmount] = useState(
    existing ? String(existing.amount) : '',
  );
  const [currency, setCurrency] = useState(existing?.currency ?? 'USD');
  const [renewalDate, setRenewalDate] = useState(
    existing?.renewalDate ?? '',
  );
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    existing?.billingCycle ?? 'monthly',
  );
  const [category, setCategory] = useState(
    existing?.category ?? 'Entertainment',
  );
  const [reminderEnabled, setReminderEnabled] = useState(
    existing?.reminderEnabled ?? true,
  );
  const [reminderDaysBefore, setReminderDaysBefore] = useState(
    existing?.reminderDaysBefore ?? 1,
  );
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [formError, setFormError] = useState('');

  if (route.params?.subscriptionId && !existing) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.content}>
          <ScreenTitle title="Subscription not found" onBack={navigation.goBack} />
          <Text style={{ color: theme.colors.muted }}>
            This subscription may have been deleted.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const save = () => {
    const cleanName = name.trim();
    const numericAmount = Number(amount);
    const normalizedCurrency = currency.trim().toUpperCase();
    if (!cleanName) {
      setFormError('Enter the subscription or service name.');
      return;
    }
    if (!amount.trim() || !Number.isFinite(numericAmount) || numericAmount < 0) {
      setFormError('Enter a valid amount.');
      return;
    }
    if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
      setFormError('Use a three-letter currency code, such as USD or INR.');
      return;
    }
    if (!dateValueIsValid(renewalDate)) {
      setFormError('Enter a valid future date in YYYY-MM-DD format.');
      return;
    }

    const values: Omit<Subscription, 'id'> = {
      name: cleanName,
      amount: numericAmount,
      currency: normalizedCurrency,
      renewalDate,
      billingCycle,
      category,
      reminderEnabled,
      reminderDaysBefore,
      notes: notes.trim(),
    };
    setFormError('');
    if (existing) {
      updateSubscription({ ...values, id: existing.id });
      recordActivity({
        eventType: 'updated',
        sourceType: 'subscription',
        sourceId: existing.id,
        summary: `Updated subscription: ${cleanName}`,
      });
      navigation.goBack();
    } else {
      const created = addSubscription(values);
      recordActivity({
        eventType: 'created',
        sourceType: 'subscription',
        sourceId: created.id,
        summary: `Added subscription: ${cleanName}`,
      });
      navigation.goBack();
    }
  };

  const confirmDelete = () => {
    if (!existing) return;
    if (
      tasks.some(
        (task) =>
          task.source?.type === 'subscription' &&
          task.source.id === existing.id,
      )
    ) {
      Alert.alert(
        'Subscription has linked tasks',
        'Unlink or reassign its tasks before deleting this subscription.',
      );
      return;
    }
    Alert.alert(
      'Delete subscription?',
      `Remove ${existing.name} and cancel its scheduled reminder?`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteSubscription(existing.id);
            navigation.goBack();
          },
        },
      ],
    );
  };

  const choiceStyle = (selected: boolean) => [
    styles.choice,
    {
      backgroundColor: selected ? theme.colors.chip : theme.colors.surface,
      borderColor: selected ? theme.colors.primary : theme.colors.border,
    },
  ];

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <ScreenTitle
            title={existing ? 'Edit subscription' : 'Add subscription'}
            subtitle="Track the next charge and set a heads-up."
            onBack={navigation.goBack}
          />
          <FormField
            label="Service name"
            placeholder="e.g. Spotify"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          <View style={styles.amountRow}>
            <View style={styles.amountField}>
              <FormField
                label="Price"
                placeholder="9.99"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.currencyField}>
              <FormField
                label="Currency"
                placeholder="USD"
                value={currency}
                onChangeText={setCurrency}
                autoCapitalize="characters"
                maxLength={3}
              />
            </View>
          </View>
          <FormField
            label="Next renewal date"
            placeholder="YYYY-MM-DD, e.g. 2026-12-31"
            value={renewalDate}
            onChangeText={setRenewalDate}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
          />

          <Text style={[styles.label, { color: theme.colors.text }]}>
            Billing cycle
          </Text>
          <View style={styles.choices}>
            {CYCLES.map((cycle) => {
              const selected = billingCycle === cycle;
              return (
                <Pressable
                  key={cycle}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    selectionHaptic();
                    setBillingCycle(cycle);
                  }}
                  style={choiceStyle(selected)}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      { color: selected ? theme.colors.primary : theme.colors.text },
                    ]}
                  >
                    {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: theme.colors.text }]}>
            Category
          </Text>
          <View style={styles.choices}>
            {CATEGORIES.map((item) => {
              const selected = category === item;
              return (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    selectionHaptic();
                    setCategory(item);
                  }}
                  style={choiceStyle(selected)}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      { color: selected ? theme.colors.primary : theme.colors.text },
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.reminderHeading}>
            <View style={styles.reminderCopy}>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                Renewal reminder
              </Text>
              <Text style={[styles.hint, { color: theme.colors.muted }]}>
                {reminderEnabled
                  ? 'Get a device notification before renewal.'
                  : 'No notification will be scheduled.'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: reminderEnabled }}
              accessibilityLabel="Renewal reminder"
              onPress={() => {
                selectionHaptic();
                setReminderEnabled(!reminderEnabled);
              }}
              style={[
                styles.switch,
                {
                  backgroundColor: reminderEnabled
                    ? theme.colors.primary
                    : theme.colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.switchThumb,
                  reminderEnabled ? styles.switchOn : styles.switchOff,
                  { backgroundColor: theme.colors.surface },
                ]}
              />
            </Pressable>
          </View>
          {reminderEnabled ? (
            <>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                Remind me
              </Text>
              <View style={styles.choices}>
                {REMINDER_DAY_OPTIONS.map((days) => {
                  const selected = reminderDaysBefore === days;
                  const label =
                    days === 0 ? 'On the day' : `${days} ${days === 1 ? 'day' : 'days'} before`;
                  return (
                    <Pressable
                      key={days}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => {
                        selectionHaptic();
                        setReminderDaysBefore(days);
                      }}
                      style={choiceStyle(selected)}
                    >
                      <Text
                        style={[
                          styles.choiceText,
                          { color: selected ? theme.colors.primary : theme.colors.text },
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
          <FormField
            label="Notes (optional)"
            placeholder="Anything to remember before it renews?"
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={400}
          />
          <Notice>
            Reminders are scheduled on this device. Keep notifications enabled
            and cancel the subscription with the service provider yourself.
          </Notice>
          {existing ? (
            <LinkedTasks
              source={{ type: 'subscription', id: existing.id }}
              onAddTask={() =>
                navigation.navigate('TaskForm', {
                  source: { type: 'subscription', id: existing.id },
                })
              }
            />
          ) : null}
          {formError ? <Notice warning>{formError}</Notice> : null}
          <ActionButton
            label={existing ? 'Save changes' : 'Add subscription'}
            onPress={save}
            style={styles.saveButton}
          />
          {existing ? (
            <ActionButton
              label="Delete subscription"
              onPress={confirmDelete}
              secondary
              danger
              style={styles.deleteButton}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  keyboard: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 28 },
  amountRow: { flexDirection: 'row', gap: 12 },
  amountField: { flex: 1 },
  currencyField: { width: 95 },
  label: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 17,
  },
  choice: {
    minHeight: 39,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  choiceText: { fontSize: 12, fontWeight: '800' },
  reminderHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    marginBottom: 16,
  },
  reminderCopy: { flex: 1 },
  hint: { fontSize: 12, marginTop: -4 },
  switch: {
    width: 48,
    height: 28,
    borderRadius: 15,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  switchThumb: { width: 22, height: 22, borderRadius: 12 },
  switchOn: { alignSelf: 'flex-end' },
  switchOff: { alignSelf: 'flex-start' },
  saveButton: { marginTop: 2 },
  deleteButton: { marginTop: 9 },
});
