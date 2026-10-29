import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Notice, ScreenTitle } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';
import { useLearning } from '../state/LearningContext';
import { useReferrals } from '../state/ReferralContext';
import { useTasks } from '../state/TaskContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;
type Result = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  searchable: string;
  open: () => void;
};

export function SearchScreen({ navigation }: Props) {
  const { theme, tools, subscriptions, ready: appReady } = useApp();
  const { items: learningItems, ready: learningReady } = useLearning();
  const {
    contacts,
    opportunities,
    requests,
    ready: referralsReady,
  } = useReferrals();
  const { tasks, ready: tasksReady } = useTasks();
  const [query, setQuery] = useState('');
  const results = useMemo<Result[]>(() => {
    const records: Result[] = [
      ...tools.map((tool) => ({
        id: `tool:${tool.id}`,
        type: 'Tool',
        title: tool.name,
        subtitle: `${tool.category} · ${tool.description}`,
        searchable: [tool.name, tool.category, tool.description, ...tool.tags]
          .join(' ')
          .toLowerCase(),
        open: () => navigation.navigate('ToolDetail', { toolId: tool.id }),
      })),
      ...subscriptions.map((subscription) => ({
        id: `subscription:${subscription.id}`,
        type: 'Subscription',
        title: subscription.name,
        subtitle: `${subscription.category} · Renews ${subscription.renewalDate}`,
        searchable: [subscription.name, subscription.category]
          .join(' ')
          .toLowerCase(),
        open: () =>
          navigation.navigate('SubscriptionForm', {
            subscriptionId: subscription.id,
          }),
      })),
      ...learningItems.map((item) => ({
        id: `learning:${item.id}`,
        type: 'Learning',
        title: item.title,
        subtitle: `${item.type.replaceAll('_', ' ')} · ${item.status.replaceAll('_', ' ')}${item.provider ? ` · ${item.provider}` : ''}`,
        searchable: [item.title, item.type, item.status, item.provider, ...item.tags]
          .join(' ')
          .toLowerCase(),
        open: () =>
          navigation.navigate('LearningDetail', {
            learningItemId: item.id,
          }),
      })),
      ...contacts.map((contact) => ({
        id: `contact:${contact.id}`,
        type: 'Contact',
        title: contact.name,
        subtitle: [contact.role, contact.company, contact.archivedAt ? 'Archived' : '']
          .filter(Boolean)
          .join(' · '),
        searchable: [contact.name, contact.role, contact.company]
          .join(' ')
          .toLowerCase(),
        open: () =>
          navigation.navigate('ReferralForm', {
            kind: 'contact',
            contactId: contact.id,
          }),
      })),
      ...opportunities.map((opportunity) => ({
        id: `opportunity:${opportunity.id}`,
        type: 'Opportunity',
        title: opportunity.role,
        subtitle: `${opportunity.company} · ${opportunity.status}`,
        searchable: [opportunity.role, opportunity.company, opportunity.status]
          .join(' ')
          .toLowerCase(),
        open: () =>
          navigation.navigate('ReferralForm', {
            kind: 'opportunity',
            opportunityId: opportunity.id,
          }),
      })),
      ...requests.map((request) => {
        const contact = contacts.find((item) => item.id === request.contactId);
        const opportunity = opportunities.find(
          (item) => item.id === request.opportunityId,
        );
        return {
          id: `referral:${request.id}`,
          type: 'Referral',
          title: contact?.name ?? 'Referral request',
          subtitle: `${opportunity?.role ?? 'Opportunity'} · ${request.status.replaceAll('_', ' ')}`,
          searchable: [
            contact?.name,
            contact?.company,
            opportunity?.role,
            opportunity?.company,
            request.status,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase(),
          open: () =>
            navigation.navigate('ReferralDetail', {
              referralRequestId: request.id,
            }),
        };
      }),
      ...tasks.map((task) => ({
        id: `task:${task.id}`,
        type: 'Task',
        title: task.title,
        subtitle: `${task.status.replaceAll('_', ' ')}${task.dueDate ? ` · Due ${task.dueDate}` : ''}`,
        searchable: [task.title, task.status, task.priority]
          .join(' ')
          .toLowerCase(),
        open: () => navigation.navigate('TaskForm', { taskId: task.id }),
      })),
    ];
    const normalizedQuery = query.trim().toLowerCase();
    return normalizedQuery
      ? records.filter((record) => record.searchable.includes(normalizedQuery))
      : [];
  }, [
    contacts,
    learningItems,
    navigation,
    opportunities,
    query,
    requests,
    subscriptions,
    tasks,
    tools,
  ]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.content}>
        <ScreenTitle
          title="Search workspace"
          subtitle="Find tools, subscriptions, learning, referrals, and tasks."
          onBack={navigation.goBack}
        />
        <TextInput
          accessibilityLabel="Search all workspace records"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Search by name, type, status, or tag"
          placeholderTextColor={theme.colors.muted}
          returnKeyType="search"
          value={query}
          onChangeText={setQuery}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        />
        <ScrollView
          contentContainerStyle={styles.results}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!appReady || !learningReady || !referralsReady || !tasksReady ? (
            <Notice>Loading workspace records…</Notice>
          ) : !query.trim() ? (
            <Notice>Enter a search term to find records across your workspace.</Notice>
          ) : results.length === 0 ? (
            <Notice>{`No records match “${query.trim()}”.`}</Notice>
          ) : (
            results.map((result) => (
              <Pressable
                key={result.id}
                accessibilityRole="button"
                onPress={result.open}
                style={[
                  styles.result,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <View style={styles.resultHeading}>
                  <Text style={[styles.type, { color: theme.colors.primary }]}>
                    {result.type}
                  </Text>
                  <Text style={[styles.arrow, { color: theme.colors.muted }]}>
                    ›
                  </Text>
                </View>
                <Text style={[styles.title, { color: theme.colors.text }]}>
                  {result.title}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[styles.subtitle, { color: theme.colors.muted }]}
                >
                  {result.subtitle}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 19, paddingTop: 8 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 12,
  },
  results: { paddingBottom: 24 },
  result: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 9 },
  resultHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  type: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  arrow: { fontSize: 24, lineHeight: 24 },
  title: { fontSize: 15, fontWeight: '800', marginTop: 4 },
  subtitle: { fontSize: 12, marginTop: 4, lineHeight: 18 },
});
