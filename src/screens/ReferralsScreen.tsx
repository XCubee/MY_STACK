import { useMemo, useState } from 'react';
import {
  Alert,
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
  REFERRAL_STATUSES,
  type Contact,
  type Opportunity,
  type ReferralStatus,
} from '../domain/referral';
import type { RootStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';
import { useActivity } from '../state/ActivityContext';
import { useReferrals } from '../state/ReferralContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Referrals'>;
type Section = 'requests' | 'contacts' | 'opportunities';

function label(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function ContactCard({
  contact,
  onEdit,
  onArchive,
}: {
  contact: Contact;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const { theme } = useApp();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <Pressable accessibilityRole="button" onPress={onEdit}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
          {contact.name}
          {contact.archivedAt ? ' · Archived' : ''}
        </Text>
        <Text style={[styles.cardSubtitle, { color: theme.colors.muted }]}>
          {[contact.role, contact.company].filter(Boolean).join(' · ') ||
            'Contact'}
        </Text>
        {contact.contactDetails ? (
          <Text style={[styles.cardBody, { color: theme.colors.muted }]}>
            {contact.contactDetails}
          </Text>
        ) : null}
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onArchive} style={styles.textAction}>
        <Text style={[styles.actionText, { color: theme.colors.primary }]}>
          {contact.archivedAt ? 'Restore' : 'Archive'}
        </Text>
      </Pressable>
    </View>
  );
}

function OpportunityCard({
  opportunity,
  onEdit,
  onArchive,
}: {
  opportunity: Opportunity;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const { theme } = useApp();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <Pressable accessibilityRole="button" onPress={onEdit}>
        <View style={styles.cardRow}>
          <Text style={[styles.cardTitle, styles.flex, { color: theme.colors.text }]}>
            {opportunity.role}
          </Text>
          <Text style={[styles.status, { color: theme.colors.primary }]}>
            {label(opportunity.status)}
          </Text>
        </View>
        <Text style={[styles.cardSubtitle, { color: theme.colors.muted }]}>
          {opportunity.company}
          {opportunity.archivedAt ? ' · Archived' : ''}
        </Text>
        {opportunity.deadline ? (
          <Text style={[styles.cardBody, { color: theme.colors.muted }]}>
            Deadline: {opportunity.deadline}
          </Text>
        ) : null}
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onArchive} style={styles.textAction}>
        <Text style={[styles.actionText, { color: theme.colors.primary }]}>
          {opportunity.archivedAt ? 'Restore' : 'Archive'}
        </Text>
      </Pressable>
    </View>
  );
}

export function ReferralsScreen({ navigation }: Props) {
  const { theme } = useApp();
  const { recordActivity } = useActivity();
  const {
    contacts,
    opportunities,
    requests,
    ready,
    error,
    retrySync,
    setContactArchived,
    setOpportunityArchived,
  } = useReferrals();
  const [section, setSection] = useState<Section>('requests');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ReferralStatus>('all');
  const [showArchived, setShowArchived] = useState(false);

  const search = query.trim().toLowerCase();
  const filteredRequests = useMemo(
    () =>
      requests
        .filter((request) => statusFilter === 'all' || request.status === statusFilter)
        .filter((request) => {
          const contact = contacts.find((item) => item.id === request.contactId);
          const opportunity = opportunities.find(
            (item) => item.id === request.opportunityId,
          );
          return (
            !search ||
            [
              contact?.name,
              contact?.company,
              opportunity?.company,
              opportunity?.role,
              request.status,
              request.outcome,
              request.notes,
            ]
              .join(' ')
              .toLowerCase()
              .includes(search)
          );
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [contacts, opportunities, requests, search, statusFilter],
  );
  const filteredContacts = useMemo(
    () =>
      contacts
        .filter((contact) => showArchived || contact.archivedAt === null)
        .filter(
          (contact) =>
            !search ||
            [
              contact.name,
              contact.company,
              contact.role,
              contact.contactDetails,
              contact.notes,
            ]
              .join(' ')
              .toLowerCase()
              .includes(search),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [contacts, search, showArchived],
  );
  const filteredOpportunities = useMemo(
    () =>
      opportunities
        .filter((item) => showArchived || item.archivedAt === null)
        .filter(
          (item) =>
            !search ||
            [item.company, item.role, item.status, item.notes]
              .join(' ')
              .toLowerCase()
              .includes(search),
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [opportunities, search, showArchived],
  );

  const confirmArchiveContact = (contact: Contact) => {
    if (contact.archivedAt) {
      setContactArchived(contact.id, false);
      recordActivity({
        eventType: 'updated',
        sourceType: 'contact',
        sourceId: contact.id,
        summary: `Restored contact: ${contact.name}`,
      });
      return;
    }
    Alert.alert(
      'Archive contact?',
      'Existing referral requests and interactions will be kept. This contact will no longer be offered for new requests.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          onPress: () => {
            setContactArchived(contact.id, true);
            recordActivity({
              eventType: 'archived',
              sourceType: 'contact',
              sourceId: contact.id,
              summary: `Archived contact: ${contact.name}`,
            });
          },
        },
      ],
    );
  };
  const confirmArchiveOpportunity = (opportunity: Opportunity) => {
    if (opportunity.archivedAt) {
      setOpportunityArchived(opportunity.id, false);
      recordActivity({
        eventType: 'updated',
        sourceType: 'opportunity',
        sourceId: opportunity.id,
        summary: `Restored opportunity: ${opportunity.role}`,
      });
      return;
    }
    Alert.alert(
      'Archive opportunity?',
      'Existing referral history will be kept. This opportunity will no longer be offered for new requests.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          onPress: () => {
            setOpportunityArchived(opportunity.id, true);
            recordActivity({
              eventType: 'archived',
              sourceType: 'opportunity',
              sourceId: opportunity.id,
              summary: `Archived opportunity: ${opportunity.role}`,
            });
          },
        },
      ],
    );
  };

  const listHeader = (
    <View>
      <ScreenTitle
        title="Referrals"
        subtitle="Keep contacts, opportunities, and follow-ups connected."
        onBack={navigation.goBack}
      />
      {error ? (
        <View>
          <Notice warning>{error}</Notice>
          <ActionButton
            label="Retry referral sync"
            secondary
            onPress={() => void retrySync()}
            style={styles.retry}
          />
        </View>
      ) : null}
      <View style={styles.sections}>
        {(['requests', 'contacts', 'opportunities'] as const).map((value) => {
          const selected = section === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setSection(value)}
              style={[
                styles.sectionChip,
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
              <Text
                style={{
                  color: selected ? theme.colors.primary : theme.colors.text,
                  fontWeight: '800',
                }}
              >
                {label(value)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        accessibilityLabel={`Search ${section}`}
        placeholder={`Search ${section}…`}
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
      {section === 'requests' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {(['all', ...REFERRAL_STATUSES] as const).map((status) => {
            const selected = statusFilter === status;
            return (
              <Pressable
                key={status}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setStatusFilter(status)}
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
                  {status === 'all' ? 'All statuses' : label(status)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      {section !== 'requests' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowArchived((value) => !value)}
          style={styles.archivedToggle}
        >
          <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>
            {showArchived ? 'Hide archived' : 'Show archived'}
          </Text>
        </Pressable>
      ) : null}
      {section === 'requests' ? (
        <ActionButton
          label="Add referral request"
          onPress={() => navigation.navigate('ReferralForm', { kind: 'request' })}
          style={styles.addButton}
        />
      ) : section === 'contacts' ? (
        <ActionButton
          label="Add contact"
          onPress={() => navigation.navigate('ReferralForm', { kind: 'contact' })}
          style={styles.addButton}
        />
      ) : (
        <ActionButton
          label="Add opportunity"
          onPress={() => navigation.navigate('ReferralForm', { kind: 'opportunity' })}
          style={styles.addButton}
        />
      )}
      {section === 'requests' && contacts.length === 0 ? (
        <Notice>Add a contact before creating a referral request.</Notice>
      ) : section === 'requests' && opportunities.length === 0 ? (
        <Notice>Add an opportunity before creating a referral request.</Notice>
      ) : null}
    </View>
  );

  if (!ready) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.content}>
          <ScreenTitle title="Loading referrals" onBack={navigation.goBack} />
          <Text style={{ color: theme.colors.muted }}>
            Loading your saved contacts and requests.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (section === 'contacts') {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <Notice>
              {showArchived
                ? 'No contacts match your search.'
                : 'No contacts yet. Add one to start a referral trail.'}
            </Notice>
          }
          renderItem={({ item }) => (
            <ContactCard
              contact={item}
              onEdit={() =>
                navigation.navigate('ReferralForm', {
                  kind: 'contact',
                  contactId: item.id,
                })
              }
              onArchive={() => confirmArchiveContact(item)}
            />
          )}
        />
      </SafeAreaView>
    );
  }

  if (section === 'opportunities') {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <FlatList
          data={filteredOpportunities}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <Notice>
              {showArchived
                ? 'No opportunities match your search.'
                : 'No opportunities yet. Add a role or career opportunity.'}
            </Notice>
          }
          renderItem={({ item }) => (
            <OpportunityCard
              opportunity={item}
              onEdit={() =>
                navigation.navigate('ReferralForm', {
                  kind: 'opportunity',
                  opportunityId: item.id,
                })
              }
              onArchive={() => confirmArchiveOpportunity(item)}
            />
          )}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <FlatList
        data={filteredRequests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <Notice>
            {search
              ? 'No referral requests match your search.'
              : 'No referral requests yet. Add a contact, an opportunity, and connect them here.'}
          </Notice>
        }
        renderItem={({ item }) => {
          const contact = contacts.find((value) => value.id === item.contactId);
          const opportunity = opportunities.find(
            (value) => value.id === item.opportunityId,
          );
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                navigation.navigate('ReferralDetail', {
                  referralRequestId: item.id,
                })
              }
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View style={styles.cardRow}>
                <Text style={[styles.cardTitle, styles.flex, { color: theme.colors.text }]}>
                  {contact?.name ?? 'Unknown contact'}
                </Text>
                <Text style={[styles.status, { color: theme.colors.primary }]}>
                  {label(item.status)}
                </Text>
              </View>
              <Text style={[styles.cardSubtitle, { color: theme.colors.muted }]}>
                {opportunity
                  ? `${opportunity.role} · ${opportunity.company}`
                  : 'Opportunity unavailable'}
              </Text>
              {item.nextFollowUpAt ? (
                <Text style={[styles.cardBody, { color: theme.colors.muted }]}>
                  Follow up: {item.nextFollowUpAt.slice(0, 10)}
                </Text>
              ) : null}
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  sections: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  sectionChip: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
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
  archivedToggle: { alignSelf: 'flex-start', paddingVertical: 8 },
  addButton: { marginBottom: 14 },
  retry: { marginBottom: 12 },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 15,
    marginBottom: 11,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  flex: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  cardSubtitle: { fontSize: 14, marginTop: 5 },
  cardBody: { fontSize: 13, marginTop: 8 },
  status: { fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  textAction: { alignSelf: 'flex-end', paddingVertical: 8, paddingLeft: 12 },
  actionText: { fontWeight: '800' },
});
