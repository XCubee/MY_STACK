import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActionButton, Notice, ScreenTitle } from '../components/ui';
import {
  TASK_PRIORITIES,
  type Task,
  type TaskPriority,
  type TaskSource,
} from '../domain/task';
import type { RootStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';
import { useActivity } from '../state/ActivityContext';
import { useLearning } from '../state/LearningContext';
import { useReferrals } from '../state/ReferralContext';
import { useTasks } from '../state/TaskContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Tasks'>;
type Filter = 'all' | 'overdue' | 'today' | 'upcoming' | 'completed';

function localDateString(date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function priorityRank(priority: TaskPriority): number {
  return TASK_PRIORITIES.indexOf(priority);
}

function dueRank(task: Task): number {
  if (task.dueAt) return Date.parse(task.dueAt);
  if (task.dueDate) return Date.parse(`${task.dueDate}T00:00:00.000Z`);
  return Number.MAX_SAFE_INTEGER;
}

function isActive(task: Task): boolean {
  return task.status === 'open' || task.status === 'in_progress';
}

function sourceLabel(
  source: TaskSource | null,
  tools: ReturnType<typeof useApp>['tools'],
  subscriptions: ReturnType<typeof useApp>['subscriptions'],
  learningItems: ReturnType<typeof useLearning>['items'],
  contacts: ReturnType<typeof useReferrals>['contacts'],
  opportunities: ReturnType<typeof useReferrals>['opportunities'],
  requests: ReturnType<typeof useReferrals>['requests'],
): string | null {
  if (!source) return null;
  if (source.type === 'tool') {
    return `Tool · ${tools.find((item) => item.id === source.id)?.name ?? 'Unavailable'}`;
  }
  if (source.type === 'subscription') {
    return `Subscription · ${subscriptions.find((item) => item.id === source.id)?.name ?? 'Unavailable'}`;
  }
  if (source.type === 'learning_item') {
    return `Learning · ${learningItems.find((item) => item.id === source.id)?.title ?? 'Unavailable'}`;
  }
  if (source.type === 'referral_request') {
    const request = requests.find((item) => item.id === source.id);
    const contact = contacts.find((item) => item.id === request?.contactId);
    const opportunity = opportunities.find(
      (item) => item.id === request?.opportunityId,
    );
    return `Referral · ${contact?.name ?? 'Contact'} / ${opportunity?.role ?? 'Opportunity'}`;
  }
  if (source.type === 'contact') {
    return `Contact · ${contacts.find((item) => item.id === source.id)?.name ?? 'Unavailable'}`;
  }
  return `Opportunity · ${opportunities.find((item) => item.id === source.id)?.role ?? 'Unavailable'}`;
}

function TaskCard({
  task,
  source,
  onOpen,
  onComplete,
  onSnooze,
  onOpenSource,
}: {
  task: Task;
  source: string | null;
  onOpen: () => void;
  onComplete: () => void;
  onSnooze: () => void;
  onOpenSource: () => void;
}) {
  const { theme } = useApp();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <Pressable accessibilityRole="button" onPress={onOpen}>
        <View style={styles.taskHeading}>
          <Text style={[styles.taskTitle, styles.flex, { color: theme.colors.text }]}>
            {task.title}
          </Text>
          <Text style={[styles.priority, { color: theme.colors.primary }]}>
            {task.priority}
          </Text>
        </View>
        {task.description ? (
          <Text
            numberOfLines={2}
            style={[styles.description, { color: theme.colors.muted }]}
          >
            {task.description}
          </Text>
        ) : null}
        <Text style={[styles.metadata, { color: theme.colors.muted }]}>
          {task.status.replace('_', ' ')}
          {task.dueDate ? ` · Due ${task.dueDate}` : ' · No due date'}
          {task.dueAt ? ` at ${new Date(task.dueAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
        </Text>
      </Pressable>
      {source ? (
        <Pressable
          accessibilityRole="button"
          onPress={onOpenSource}
          style={styles.sourceButton}
        >
          <Text numberOfLines={1} style={{ color: theme.colors.primary, fontWeight: '700' }}>
            {source}  ›
          </Text>
        </Pressable>
      ) : null}
      {isActive(task) ? (
        <View style={styles.actions}>
          <ActionButton
            label="Complete"
            secondary
            onPress={onComplete}
            style={styles.actionButton}
          />
          {task.reminderEnabled ? (
            <ActionButton
              label="Snooze 1 day"
              secondary
              onPress={onSnooze}
              style={styles.actionButton}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function TasksScreen({ navigation }: Props) {
  const { theme, tools, subscriptions } = useApp();
  const { recordActivity } = useActivity();
  const { items: learningItems } = useLearning();
  const { contacts, opportunities, requests } = useReferrals();
  const { tasks, ready, error, reminderMessage, retrySync, retryReminders, updateTask } =
    useTasks();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const today = localDateString();
  const search = query.trim().toLowerCase();

  const counts = useMemo(() => {
    const active = tasks.filter(isActive);
    return {
      overdue: active.filter((task) => task.dueDate && task.dueDate < today).length,
      today: active.filter((task) => task.dueDate === today).length,
      upcoming: active.filter((task) => task.dueDate && task.dueDate > today).length,
    };
  }, [tasks, today]);

  const filtered = useMemo(
    () =>
      tasks
        .filter((task) => {
          if (filter === 'completed') {
            return task.status === 'completed' || task.status === 'canceled';
          }
          if (!isActive(task)) return filter === 'all';
          if (filter === 'overdue') return Boolean(task.dueDate && task.dueDate < today);
          if (filter === 'today') return task.dueDate === today;
          if (filter === 'upcoming') return Boolean(task.dueDate && task.dueDate > today);
          return true;
        })
        .filter((task) => {
          const label = sourceLabel(
            task.source,
            tools,
            subscriptions,
            learningItems,
            contacts,
            opportunities,
            requests,
          );
          return (
            !search ||
            [task.title, task.description, task.status, task.priority, label]
              .join(' ')
              .toLowerCase()
              .includes(search)
          );
        })
        .sort(
          (a, b) =>
            dueRank(a) - dueRank(b) ||
            priorityRank(b.priority) - priorityRank(a.priority) ||
            b.updatedAt.localeCompare(a.updatedAt),
        ),
    [
      contacts,
      filter,
      learningItems,
      opportunities,
      requests,
      search,
      subscriptions,
      tasks,
      today,
      tools,
    ],
  );

  const complete = (task: Task) => {
    updateTask({ ...task, status: 'completed' });
    recordActivity({
      eventType: 'completed',
      sourceType: 'task',
      sourceId: task.id,
      summary: `Completed task: ${task.title}`,
    });
  };
  const snooze = (task: Task) => {
    const now = new Date();
    const tomorrowAtNine = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      9,
      0,
      0,
      0,
    );
    updateTask({ ...task, remindAt: tomorrowAtNine.toISOString() });
    recordActivity({
      eventType: 'updated',
      sourceType: 'task',
      sourceId: task.id,
      summary: `Snoozed task reminder: ${task.title}`,
    });
  };
  const openSource = (task: Task) => {
    const source = task.source;
    if (!source) return;
    if (source.type === 'learning_item') {
      navigation.navigate('LearningDetail', { learningItemId: source.id });
    } else if (source.type === 'referral_request') {
      navigation.navigate('ReferralDetail', { referralRequestId: source.id });
    } else if (source.type === 'tool') {
      navigation.navigate('ToolDetail', { toolId: source.id });
    } else if (source.type === 'subscription') {
      navigation.navigate('SubscriptionForm', { subscriptionId: source.id });
    } else if (source.type === 'contact') {
      navigation.navigate('ReferralForm', {
        kind: 'contact',
        contactId: source.id,
      });
    } else {
      navigation.navigate('ReferralForm', {
        kind: 'opportunity',
        opportunityId: source.id,
      });
    }
  };

  const filters: Filter[] = ['all', 'overdue', 'today', 'upcoming', 'completed'];
  const header = (
    <View>
      <ScreenTitle
        title="Tasks"
        subtitle="One place for follow-ups, learning goals, and renewals."
        onBack={navigation.goBack}
      />
      <View style={styles.summaryRow}>
        <SummaryTile label="OVERDUE" value={counts.overdue} theme={theme} />
        <SummaryTile label="DUE TODAY" value={counts.today} theme={theme} />
        <SummaryTile label="UPCOMING" value={counts.upcoming} theme={theme} />
      </View>
      {error ? (
        <View>
          <Notice warning>{error}</Notice>
          <ActionButton
            label="Retry task sync"
            secondary
            onPress={() => void retrySync()}
            style={styles.retry}
          />
        </View>
      ) : null}
      {reminderMessage ? (
        <View>
          <Notice warning>{reminderMessage}</Notice>
          <ActionButton
            label="Enable or retry reminders"
            secondary
            onPress={() => void retryReminders()}
            style={styles.retry}
          />
        </View>
      ) : null}
      <TextInput
        accessibilityLabel="Search tasks"
        placeholder="Search tasks and linked records"
        placeholderTextColor={theme.colors.muted}
        value={query}
        onChangeText={setQuery}
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
        contentContainerStyle={styles.filters}
      >
        {filters.map((value) => {
          const selected = filter === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setFilter(value)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: selected
                    ? theme.colors.chip
                    : theme.colors.surface,
                  borderColor: selected
                    ? theme.colors.primary
                    : theme.colors.border,
                },
              ]}
            >
              <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
                {value === 'all' ? 'All tasks' : value}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <ActionButton
        label="Add task"
        onPress={() => navigation.navigate('TaskForm', undefined)}
        style={styles.addButton}
      />
    </View>
  );

  if (!ready) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.content}>
          <ScreenTitle title="Loading tasks" onBack={navigation.goBack} />
          <Text style={{ color: theme.colors.muted }}>
            Loading tasks saved on this device and account.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <FlatList
        data={filtered}
        keyExtractor={(task) => task.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Notice>
            {search
              ? 'No tasks match your search.'
              : filter === 'all'
                ? 'No tasks yet. Add one or schedule a follow-up.'
                : `No ${filter} tasks.`}
          </Notice>
        }
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            source={sourceLabel(
              item.source,
              tools,
              subscriptions,
              learningItems,
              contacts,
              opportunities,
              requests,
            )}
            onOpen={() => navigation.navigate('TaskForm', { taskId: item.id })}
            onComplete={() => complete(item)}
            onSnooze={() => snooze(item)}
            onOpenSource={() => openSource(item)}
          />
        )}
      />
    </SafeAreaView>
  );
}

function SummaryTile({
  label,
  value,
  theme,
}: {
  label: string;
  value: number;
  theme: ReturnType<typeof useApp>['theme'];
}) {
  return (
    <View
      style={[
        styles.summaryTile,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <Text style={[styles.summaryValue, { color: theme.colors.primary }]}>
        {value}
      </Text>
      <Text style={[styles.summaryLabel, { color: theme.colors.muted }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  summaryTile: {
    flex: 1,
    minHeight: 76,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryValue: { fontSize: 21, fontWeight: '900' },
  summaryLabel: { fontSize: 10, fontWeight: '800', marginTop: 4 },
  search: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  filters: { gap: 8, paddingBottom: 12 },
  filterChip: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  retry: { marginBottom: 12 },
  addButton: { marginBottom: 14 },
  card: { borderWidth: 1, borderRadius: 16, padding: 15, marginBottom: 11 },
  taskHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  flex: { flex: 1 },
  taskTitle: { fontSize: 16, fontWeight: '800' },
  priority: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  description: { fontSize: 14, lineHeight: 20, marginTop: 7 },
  metadata: { fontSize: 12, marginTop: 8, textTransform: 'capitalize' },
  sourceButton: { alignSelf: 'flex-start', paddingTop: 10, paddingBottom: 3 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionButton: { flex: 1, minHeight: 42, paddingHorizontal: 10 },
});
