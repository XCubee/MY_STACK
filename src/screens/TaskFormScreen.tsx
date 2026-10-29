import { useMemo, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActionButton, FormField, Notice, ScreenTitle } from '../components/ui';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskSource,
  type TaskStatus,
} from '../domain/task';
import { isValidDateOnly } from '../domain/subscription';
import type { RootStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';
import { useActivity } from '../state/ActivityContext';
import { useLearning } from '../state/LearningContext';
import { useReferrals } from '../state/ReferralContext';
import { useTasks } from '../state/TaskContext';

type Props = NativeStackScreenProps<RootStackParamList, 'TaskForm'>;
type SourceOption = { source: TaskSource; label: string };

function localDateString(date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function localDateTimeToIso(date: string, time: string): string | null {
  if (!isValidDateOnly(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if (hour > 23 || minute > 59) return null;
  const value = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    value.getFullYear() !== year ||
    value.getMonth() !== month - 1 ||
    value.getDate() !== day ||
    value.getHours() !== hour ||
    value.getMinutes() !== minute
  ) {
    return null;
  }
  return value.toISOString();
}

function localParts(value: string | null): { date: string; time: string } {
  if (!value) return { date: '', time: '' };
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return { date: '', time: '' };
  return {
    date: localDateString(date),
    time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  };
}

function FormShell({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  children: ReactNode;
}) {
  const { theme } = useApp();
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
          <ScreenTitle title={title} subtitle={subtitle} onBack={onBack} />
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ChoiceRow<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  const { theme } = useApp();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.choices}
    >
      {options.map((value) => {
        const selectedOption = value === selected;
        return (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedOption }}
            onPress={() => onSelect(value)}
            style={[
              styles.choice,
              {
                backgroundColor: selectedOption
                  ? theme.colors.chip
                  : theme.colors.surface,
                borderColor: selectedOption
                  ? theme.colors.primary
                  : theme.colors.border,
              },
            ]}
          >
            <Text
              style={{
                color: selectedOption
                  ? theme.colors.primary
                  : theme.colors.text,
                fontWeight: '700',
              }}
            >
              {value.replace('_', ' ')}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function sourceOptions(
  tools: ReturnType<typeof useApp>['tools'],
  subscriptions: ReturnType<typeof useApp>['subscriptions'],
  learningItems: ReturnType<typeof useLearning>['items'],
  contacts: ReturnType<typeof useReferrals>['contacts'],
  opportunities: ReturnType<typeof useReferrals>['opportunities'],
  requests: ReturnType<typeof useReferrals>['requests'],
): SourceOption[] {
  return [
    ...tools.map((item) => ({
      source: { type: 'tool' as const, id: item.id },
      label: `Tool · ${item.name}`,
    })),
    ...subscriptions.map((item) => ({
      source: { type: 'subscription' as const, id: item.id },
      label: `Subscription · ${item.name}`,
    })),
    ...learningItems
      .filter((item) => item.archivedAt === null)
      .map((item) => ({
        source: { type: 'learning_item' as const, id: item.id },
        label: `Learning · ${item.title}`,
      })),
    ...requests.map((item) => ({
      source: { type: 'referral_request' as const, id: item.id },
      label: `Referral · ${contacts.find((contact) => contact.id === item.contactId)?.name ?? 'Contact'}`,
    })),
    ...contacts
      .filter((item) => item.archivedAt === null)
      .map((item) => ({
        source: { type: 'contact' as const, id: item.id },
        label: `Contact · ${item.name}`,
      })),
    ...opportunities
      .filter((item) => item.archivedAt === null)
      .map((item) => ({
        source: { type: 'opportunity' as const, id: item.id },
        label: `Opportunity · ${item.role} at ${item.company}`,
      })),
  ];
}

function TaskEditor({
  navigation,
  taskId,
  defaultSource,
}: {
  navigation: Props['navigation'];
  taskId?: string;
  defaultSource?: TaskSource;
}) {
  const { theme, tools, subscriptions } = useApp();
  const { recordActivity } = useActivity();
  const { items: learningItems } = useLearning();
  const { contacts, opportunities, requests } = useReferrals();
  const { tasks, addTask, updateTask } = useTasks();
  const existing = taskId ? tasks.find((task) => task.id === taskId) : undefined;
  const dueParts = localParts(existing?.dueAt ?? null);
  const reminderParts = localParts(existing?.remindAt ?? null);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? dueParts.date);
  const [dueTime, setDueTime] = useState(dueParts.time);
  const [priority, setPriority] = useState<TaskPriority>(
    existing?.priority ?? 'normal',
  );
  const [status, setStatus] = useState<TaskStatus>(existing?.status ?? 'open');
  const [reminderEnabled, setReminderEnabled] = useState(
    existing?.reminderEnabled ?? false,
  );
  const [reminderDate, setReminderDate] = useState(
    reminderParts.date || existing?.dueDate || '',
  );
  const [reminderTime, setReminderTime] = useState(
    reminderParts.time || dueParts.time || '09:00',
  );
  const [source, setSource] = useState<TaskSource | null>(
    existing?.source ?? defaultSource ?? null,
  );
  const [sourceSearch, setSourceSearch] = useState('');
  const [formError, setFormError] = useState('');
  const options = useMemo(
    () =>
      sourceOptions(
        tools,
        subscriptions,
        learningItems,
        contacts,
        opportunities,
        requests,
      ),
    [contacts, learningItems, opportunities, requests, subscriptions, tools],
  );
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(sourceSearch.trim().toLowerCase()),
  );
  const selectedSource = source
    ? options.find(
        (option) =>
          option.source.type === source.type &&
          option.source.id === source.id,
      )?.label ?? 'Linked record unavailable'
    : 'No linked record';

  if (taskId && !existing) {
    return (
      <FormShell
        title="Task not found"
        subtitle="This task may have been removed."
        onBack={navigation.goBack}
      >
        <Notice>The task could not be loaded, so no new task was created.</Notice>
      </FormShell>
    );
  }

  const save = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFormError('Enter a title for this task.');
      return;
    }
    if (dueDate.trim() && !isValidDateOnly(dueDate.trim())) {
      setFormError('Enter the due date as a real date in YYYY-MM-DD format.');
      return;
    }
    if (dueTime.trim() && !dueDate.trim()) {
      setFormError('Add a due date before entering a due time.');
      return;
    }
    const dueAt = dueTime.trim()
      ? localDateTimeToIso(dueDate.trim(), dueTime.trim())
      : null;
    if (dueTime.trim() && !dueAt) {
      setFormError('Enter a valid local due time in 24-hour HH:MM format.');
      return;
    }

    let remindAt: string | null = null;
    const shouldRemind =
      reminderEnabled && status !== 'completed' && status !== 'canceled';
    if (shouldRemind) {
      remindAt = localDateTimeToIso(
        reminderDate.trim(),
        reminderTime.trim(),
      );
      if (!remindAt) {
        setFormError(
          'Enter a reminder date and a valid local time in 24-hour HH:MM format.',
        );
        return;
      }
      if (Date.parse(remindAt) <= Date.now()) {
        setFormError('Choose a future time for this reminder.');
        return;
      }
    }

    try {
      const values = {
        title: cleanTitle,
        description: description.trim(),
        dueDate: dueDate.trim() || null,
        dueAt,
        priority,
        status,
        reminderEnabled: shouldRemind,
        remindAt,
        source,
      };
      if (existing) {
        updateTask({ ...existing, ...values });
        recordActivity({
          eventType:
            existing.status === status ? 'updated' : 'status_changed',
          sourceType: 'task',
          sourceId: existing.id,
          summary: `Updated task: ${cleanTitle}`,
        });
      } else {
        const created = addTask(values);
        recordActivity({
          eventType: 'created',
          sourceType: 'task',
          sourceId: created.id,
          summary: `Created task: ${cleanTitle}`,
        });
      }
      navigation.goBack();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Could not save this task.',
      );
    }
  };

  return (
    <FormShell
      title={existing ? 'Edit task' : 'Add task'}
      subtitle="Tasks can link back to learning, referrals, tools, or subscriptions."
      onBack={navigation.goBack}
    >
      {formError ? <Notice warning>{formError}</Notice> : null}
      <FormField
        label="Title"
        placeholder="What needs to get done?"
        value={title}
        onChangeText={setTitle}
        maxLength={180}
      />
      <FormField
        label="Description"
        placeholder="Add context or details"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={2000}
      />
      <FormField
        label="Due date (optional)"
        placeholder="YYYY-MM-DD"
        value={dueDate}
        onChangeText={setDueDate}
        autoCapitalize="none"
      />
      <FormField
        label="Due time (optional, local time)"
        placeholder="HH:MM"
        value={dueTime}
        onChangeText={setDueTime}
        autoCapitalize="none"
      />
      <Text style={[styles.label, { color: theme.colors.text }]}>Priority</Text>
      <ChoiceRow
        options={TASK_PRIORITIES}
        selected={priority}
        onSelect={setPriority}
      />
      <Text style={[styles.label, { color: theme.colors.text }]}>Status</Text>
      <ChoiceRow options={TASK_STATUSES} selected={status} onSelect={setStatus} />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: reminderEnabled }}
        onPress={() => {
          if (!reminderEnabled && !reminderDate.trim()) {
            setReminderDate(dueDate.trim() || localDateString());
          }
          setReminderEnabled((value) => !value);
        }}
        style={[
          styles.reminderToggle,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.toggleMark, { color: theme.colors.primary }]}>
          {reminderEnabled ? '☑' : '□'}
        </Text>
        <View style={styles.flex}>
          <Text style={[styles.toggleTitle, { color: theme.colors.text }]}>
            Schedule a local reminder
          </Text>
          <Text style={[styles.toggleHint, { color: theme.colors.muted }]}>
            Runs on this device; no email or external message is sent.
          </Text>
        </View>
      </Pressable>
      {reminderEnabled ? (
        <>
          <FormField
            label="Reminder date"
            placeholder="YYYY-MM-DD"
            value={reminderDate}
            onChangeText={setReminderDate}
            autoCapitalize="none"
          />
          <FormField
            label="Reminder time (local time)"
            placeholder="09:00"
            value={reminderTime}
            onChangeText={setReminderTime}
            autoCapitalize="none"
          />
        </>
      ) : null}
      <Text style={[styles.label, { color: theme.colors.text }]}>
        Linked record (optional)
      </Text>
      <Text style={[styles.selectedSource, { color: theme.colors.muted }]}>
        Selected: {selectedSource}
      </Text>
      <TextInput
        accessibilityLabel="Search linked records"
        placeholder="Search learning, contacts, opportunities…"
        placeholderTextColor={theme.colors.muted}
        value={sourceSearch}
        onChangeText={setSourceSearch}
        style={[
          styles.search,
          {
            color: theme.colors.text,
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.choices}
      >
        <SourceChoice
          title="No linked record"
          selected={source === null}
          onPress={() => setSource(null)}
        />
        {filteredOptions.map((option) => (
          <SourceChoice
            key={`${option.source.type}:${option.source.id}`}
            title={option.label}
            selected={
              source?.type === option.source.type &&
              source.id === option.source.id
            }
            onPress={() => setSource(option.source)}
          />
        ))}
      </ScrollView>
      <ActionButton
        label={existing ? 'Save task changes' : 'Create task'}
        onPress={save}
        style={styles.save}
      />
    </FormShell>
  );
}

function SourceChoice({
  title,
  selected,
  onPress,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.sourceChoice,
        {
          backgroundColor: selected ? theme.colors.chip : theme.colors.surface,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
        },
      ]}
    >
      <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
        {title}
      </Text>
    </Pressable>
  );
}

export function TaskFormScreen({ navigation, route }: Props) {
  const { ready } = useTasks();
  const { theme } = useApp();
  if (!ready) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.content}>
          <ScreenTitle title="Loading task data" onBack={navigation.goBack} />
        </View>
      </SafeAreaView>
    );
  }
  return (
    <TaskEditor
      navigation={navigation}
      taskId={route.params?.taskId}
      defaultSource={route.params?.source}
    />
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  keyboard: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '800', marginBottom: 8, marginTop: 4 },
  choices: { gap: 8, paddingBottom: 12 },
  choice: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  reminderToggle: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  toggleMark: { fontSize: 22, fontWeight: '900' },
  flex: { flex: 1 },
  toggleTitle: { fontSize: 15, fontWeight: '800' },
  toggleHint: { fontSize: 12, marginTop: 4, lineHeight: 17 },
  selectedSource: { fontSize: 13, marginBottom: 8 },
  search: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  sourceChoice: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    maxWidth: 260,
  },
  save: { marginTop: 12 },
});
