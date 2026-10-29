import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinkedTasks } from '../components/LinkedTasks';
import { ActionButton, Notice, ScreenTitle } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';
import { useReferrals } from '../state/ReferralContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ReferralDetail'>;

function label(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function ReferralDetailScreen({ navigation, route }: Props) {
  const { theme } = useApp();
  const { requests, contacts, opportunities, interactions, ready } =
    useReferrals();
  const request = requests.find(
    (item) => item.id === route.params.referralRequestId,
  );
  const contact = request
    ? contacts.find((item) => item.id === request.contactId)
    : undefined;
  const opportunity = request
    ? opportunities.find((item) => item.id === request.opportunityId)
    : undefined;
  const history = interactions
    .filter((item) => item.referralRequestId === request?.id)
    .sort((a, b) => b.interactionAt.localeCompare(a.interactionAt));

  if (!ready) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.content}>
          <ScreenTitle title="Loading request" onBack={navigation.goBack} />
        </View>
      </SafeAreaView>
    );
  }

  if (!request) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.content}>
          <ScreenTitle title="Request not found" onBack={navigation.goBack} />
          <Notice>This referral request may have been removed.</Notice>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle
          title={contact?.name ?? 'Referral request'}
          subtitle={opportunity
            ? `${opportunity.role} · ${opportunity.company}`
            : 'Opportunity unavailable'}
          onBack={navigation.goBack}
        />
        <View
          style={[
            styles.summary,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.status, { color: theme.colors.primary }]}>
            {label(request.status)}
          </Text>
          <Info label="Requested" value={request.requestDate} />
          <Info
            label="Last interaction"
            value={request.lastInteractionAt?.slice(0, 10) ?? 'Not recorded'}
          />
          <Info
            label="Next follow-up"
            value={request.nextFollowUpAt?.slice(0, 10) ?? 'Not scheduled'}
          />
          {request.outcome ? <Info label="Outcome" value={request.outcome} /> : null}
          {request.notes ? <Info label="Notes" value={request.notes} /> : null}
          {contact?.archivedAt ? (
            <Text style={[styles.archived, { color: theme.colors.muted }]}>
              This contact is archived; existing history is retained.
            </Text>
          ) : null}
          {opportunity?.archivedAt ? (
            <Text style={[styles.archived, { color: theme.colors.muted }]}>
              This opportunity is archived; existing history is retained.
            </Text>
          ) : null}
        </View>
        <ActionButton
          label="Update request"
          secondary
          onPress={() =>
            navigation.navigate('ReferralForm', {
              kind: 'request',
              requestId: request.id,
            })
          }
          style={styles.action}
        />
        <ActionButton
          label="Log interaction"
          onPress={() =>
            navigation.navigate('ReferralForm', {
              kind: 'interaction',
              contactId: request.contactId,
              referralRequestId: request.id,
            })
          }
          style={styles.action}
        />
        <LinkedTasks
          source={{ type: 'referral_request', id: request.id }}
          onAddTask={() =>
            navigation.navigate('TaskForm', {
              source: { type: 'referral_request', id: request.id },
            })
          }
        />
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Interaction history
        </Text>
        {history.length ? (
          history.map((interaction) => (
            <View
              key={interaction.id}
              style={[
                styles.interaction,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.interactionDate, { color: theme.colors.primary }]}>
                {new Date(interaction.interactionAt).toLocaleString()}
                {interaction.channel ? ` · ${interaction.channel}` : ''}
              </Text>
              <Text style={[styles.interactionSummary, { color: theme.colors.text }]}>
                {interaction.summary}
              </Text>
              {interaction.nextStep ? (
                <Text style={[styles.interactionNext, { color: theme.colors.muted }]}>
                  Next step: {interaction.nextStep}
                </Text>
              ) : null}
            </View>
          ))
        ) : (
          <Notice>No interactions logged yet. Your request history will appear here.</Notice>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  const { theme } = useApp();
  return (
    <View style={styles.info}>
      <Text style={[styles.infoLabel, { color: theme.colors.muted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: theme.colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  summary: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 },
  status: { fontSize: 16, fontWeight: '900', marginBottom: 12 },
  info: { marginBottom: 10 },
  infoLabel: { fontSize: 12, fontWeight: '700', marginBottom: 3 },
  infoValue: { fontSize: 15, lineHeight: 21 },
  archived: { fontSize: 13, marginTop: 8 },
  action: { marginBottom: 10 },
  sectionTitle: { fontSize: 19, fontWeight: '900', marginTop: 18, marginBottom: 10 },
  interaction: { borderWidth: 1, borderRadius: 15, padding: 14, marginBottom: 10 },
  interactionDate: { fontSize: 12, fontWeight: '800', marginBottom: 8 },
  interactionSummary: { fontSize: 15, lineHeight: 21 },
  interactionNext: { fontSize: 13, lineHeight: 19, marginTop: 8 },
});
