import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActionButton, Notice, ScreenTitle } from '../components/ui';
import type { ActivityEvent } from '../domain/activity';
import type { RootStackParamList } from '../navigation/types';
import { useActivity } from '../state/ActivityContext';
import { useApp } from '../state/AppContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Activity'>;

function metadataString(event: ActivityEvent, key: string): string | null {
  const value = event.metadata[key];
  return typeof value === 'string' ? value : null;
}

function sourceLabel(sourceType: ActivityEvent['sourceType']): string {
  return sourceType
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function ActivityScreen({ navigation }: Props) {
  const { theme } = useApp();
  const { events, ready, error, retrySync } = useActivity();

  const openEvent = (event: ActivityEvent) => {
    if (event.sourceType === 'learning_item') {
      navigation.navigate('LearningDetail', {
        learningItemId: event.sourceId,
      });
    } else if (event.sourceType === 'learning_section') {
      const learningItemId = metadataString(event, 'learningItemId');
      if (learningItemId) {
        navigation.navigate('LearningDetail', { learningItemId });
      }
    } else if (event.sourceType === 'contact') {
      navigation.navigate('ReferralForm', {
        kind: 'contact',
        contactId: event.sourceId,
      });
    } else if (event.sourceType === 'opportunity') {
      navigation.navigate('ReferralForm', {
        kind: 'opportunity',
        opportunityId: event.sourceId,
      });
    } else if (event.sourceType === 'referral_request') {
      navigation.navigate('ReferralDetail', {
        referralRequestId: event.sourceId,
      });
    } else if (event.sourceType === 'interaction') {
      const referralRequestId = metadataString(event, 'referralRequestId');
      const contactId = metadataString(event, 'contactId');
      if (referralRequestId) {
        navigation.navigate('ReferralDetail', { referralRequestId });
      } else if (contactId) {
        navigation.navigate('ReferralForm', { kind: 'contact', contactId });
      }
    } else if (event.sourceType === 'task') {
      navigation.navigate('TaskForm', { taskId: event.sourceId });
    } else if (event.sourceType === 'tool') {
      navigation.navigate('ToolDetail', { toolId: event.sourceId });
    } else if (event.sourceType === 'subscription') {
      navigation.navigate('SubscriptionForm', {
        subscriptionId: event.sourceId,
      });
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle
          title="Activity"
          subtitle="A history of changes across your workspace."
          onBack={navigation.goBack}
        />
        {error ? (
          <Notice warning>
            {`Activity is saved on this device, but sync needs attention: ${error}`}
          </Notice>
        ) : null}
        {!ready ? (
          <Notice>Loading your activity history…</Notice>
        ) : events.length === 0 ? (
          <View
            style={[
              styles.empty,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              No activity yet
            </Text>
            <Text style={[styles.muted, { color: theme.colors.muted }]}>
              New records and updates will appear here.
            </Text>
          </View>
        ) : (
          events.map((event) => (
            <Pressable
              key={event.id}
              accessibilityRole="button"
              onPress={() => openEvent(event)}
              style={[
                styles.event,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View style={styles.eventHeader}>
                <Text style={[styles.source, { color: theme.colors.primary }]}>
                  {sourceLabel(event.sourceType)}
                </Text>
                <Text style={[styles.date, { color: theme.colors.muted }]}>
                  {new Date(event.createdAt).toLocaleString()}
                </Text>
              </View>
              <Text style={[styles.summary, { color: theme.colors.text }]}>
                {event.summary}
              </Text>
            </Pressable>
          ))
        )}
        {error ? (
          <ActionButton
            label="Retry activity sync"
            secondary
            onPress={() => void retrySync()}
            style={styles.retry}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 19, paddingTop: 8, paddingBottom: 28 },
  empty: { borderWidth: 1, borderRadius: 16, padding: 18, marginTop: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '900' },
  muted: { marginTop: 6, lineHeight: 20 },
  event: { borderWidth: 1, borderRadius: 15, padding: 15, marginTop: 10 },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  source: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  date: { fontSize: 10 },
  summary: { fontSize: 14, fontWeight: '700', lineHeight: 20, marginTop: 8 },
  retry: { marginTop: 14 },
});
