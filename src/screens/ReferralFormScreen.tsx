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
import { LinkedTasks } from '../components/LinkedTasks';
import {
  OPPORTUNITY_STATUSES,
  REFERRAL_STATUSES,
  type OpportunityStatus,
  type ReferralStatus,
} from '../domain/referral';
import { isValidDateOnly } from '../domain/subscription';
import { normalizeWebUrl } from '../domain/tool';
import type { RootStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';
import { useActivity } from '../state/ActivityContext';
import { useReferrals } from '../state/ReferralContext';
import { useTasks } from '../state/TaskContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ReferralForm'>;

function todayDate(): string {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function titleCase(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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
  label,
  options,
  selected,
  onSelect,
}: {
  label?: (value: T) => string;
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
        const isSelected = selected === value;
        return (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(value)}
            style={[
              styles.choice,
              {
                backgroundColor: isSelected
                  ? theme.colors.chip
                  : theme.colors.surface,
                borderColor: isSelected
                  ? theme.colors.primary
                  : theme.colors.border,
              },
            ]}
          >
            <Text
              style={{
                color: isSelected ? theme.colors.primary : theme.colors.text,
                fontWeight: '700',
              }}
            >
              {label ? label(value) : titleCase(value)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function SaveActions({
  label,
  onSave,
}: {
  label: string;
  onSave: () => void;
}) {
  return <ActionButton label={label} onPress={onSave} style={styles.save} />;
}

function ContactForm({
  navigation,
  contactId,
}: {
  navigation: Props['navigation'];
  contactId?: string;
}) {
  const { theme } = useApp();
  const { recordActivity } = useActivity();
  const { contacts, addContact, updateContact } = useReferrals();
  const existing = contactId
    ? contacts.find((contact) => contact.id === contactId)
    : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [company, setCompany] = useState(existing?.company ?? '');
  const [role, setRole] = useState(existing?.role ?? '');
  const [profileUrl, setProfileUrl] = useState(existing?.profileUrl ?? '');
  const [contactDetails, setContactDetails] = useState(
    existing?.contactDetails ?? '',
  );
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [formError, setFormError] = useState('');
  const [allowDuplicate, setAllowDuplicate] = useState(false);

  const duplicate = useMemo(() => {
    const cleanName = name.trim().toLocaleLowerCase();
    const cleanCompany = company.trim().toLocaleLowerCase();
    if (!cleanName || !cleanCompany) return undefined;
    return contacts.find(
      (contact) =>
        contact.id !== existing?.id &&
        contact.name.trim().toLocaleLowerCase() === cleanName &&
        contact.company.trim().toLocaleLowerCase() === cleanCompany,
    );
  }, [company, contacts, existing?.id, name]);

  if (contactId && !existing) {
    return (
      <FormShell
        title="Contact not found"
        subtitle="This contact may have been removed."
        onBack={navigation.goBack}
      >
        <Notice>The contact could not be loaded, so no new record was created.</Notice>
      </FormShell>
    );
  }

  const save = () => {
    const cleanName = name.trim();
    const normalizedUrl = profileUrl.trim()
      ? normalizeWebUrl(profileUrl)
      : '';
    if (!cleanName) {
      setFormError('Enter the contact name.');
      return;
    }
    if (profileUrl.trim() && !normalizedUrl) {
      setFormError('Enter a valid http or https profile URL.');
      return;
    }
    if (duplicate && !allowDuplicate) {
      setFormError(
        `A contact named ${duplicate.name} at ${duplicate.company} already exists. Open that record or explicitly save a separate contact.`,
      );
      return;
    }

    try {
      const values = {
        name: cleanName,
        company: company.trim(),
        role: role.trim(),
        profileUrl: normalizedUrl ?? '',
        contactDetails: contactDetails.trim(),
        notes: notes.trim(),
      };
      if (existing) {
        updateContact({ ...existing, ...values });
        recordActivity({
          eventType: 'updated',
          sourceType: 'contact',
          sourceId: existing.id,
          summary: `Updated contact: ${cleanName}`,
        });
      } else {
        const created = addContact(values);
        recordActivity({
          eventType: 'created',
          sourceType: 'contact',
          sourceId: created.id,
          summary: `Added contact: ${cleanName}`,
        });
      }
      navigation.goBack();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Could not save this contact.',
      );
    }
  };

  return (
    <FormShell
      title={existing ? 'Edit contact' : 'Add contact'}
      subtitle="Keep contact information separate from each referral request."
      onBack={navigation.goBack}
    >
      {formError ? <Notice warning>{formError}</Notice> : null}
      <FormField
        label="Name"
        placeholder="Full name"
        value={name}
        onChangeText={(value) => {
          setName(value);
          setAllowDuplicate(false);
        }}
        autoCapitalize="words"
        maxLength={160}
      />
      <FormField
        label="Company"
        placeholder="Company or organization"
        value={company}
        onChangeText={(value) => {
          setCompany(value);
          setAllowDuplicate(false);
        }}
        autoCapitalize="words"
        maxLength={160}
      />
      <FormField
        label="Role"
        placeholder="Role or team"
        value={role}
        onChangeText={setRole}
        autoCapitalize="sentences"
        maxLength={160}
      />
      <FormField
        label="Profile URL"
        placeholder="https://…"
        value={profileUrl}
        onChangeText={setProfileUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      <FormField
        label="Contact details"
        placeholder="Email, phone, or preferred way to reach them"
        value={contactDetails}
        onChangeText={setContactDetails}
        autoCapitalize="none"
        multiline
      />
      <FormField
        label="Notes"
        placeholder="Context you want to remember"
        value={notes}
        onChangeText={setNotes}
        multiline
      />
      {duplicate && !allowDuplicate ? (
        <View style={styles.duplicateBox}>
          <Text style={{ color: theme.colors.text, lineHeight: 20 }}>
            This looks like a duplicate of {duplicate.name}
            {duplicate.company ? ` at ${duplicate.company}` : ''}.
          </Text>
          <ActionButton
            label="Open existing contact"
            secondary
            onPress={() =>
              navigation.replace('ReferralForm', {
                kind: 'contact',
                contactId: duplicate.id,
              })
            }
            style={styles.smallAction}
          />
          <ActionButton
            label="Save as a separate contact"
            secondary
            onPress={() => {
              setAllowDuplicate(true);
              setFormError('');
            }}
            style={styles.smallAction}
          />
        </View>
      ) : null}
      {existing ? (
        <LinkedTasks
          source={{ type: 'contact', id: existing.id }}
          onAddTask={() =>
            navigation.navigate('TaskForm', {
              source: { type: 'contact', id: existing.id },
            })
          }
        />
      ) : null}
      <SaveActions
        label={existing ? 'Save contact changes' : 'Save contact'}
        onSave={save}
      />
    </FormShell>
  );
}

function OpportunityForm({
  navigation,
  opportunityId,
}: {
  navigation: Props['navigation'];
  opportunityId?: string;
}) {
  const { theme } = useApp();
  const { recordActivity } = useActivity();
  const { opportunities, addOpportunity, updateOpportunity } = useReferrals();
  const existing = opportunityId
    ? opportunities.find((item) => item.id === opportunityId)
    : undefined;
  const [company, setCompany] = useState(existing?.company ?? '');
  const [role, setRole] = useState(existing?.role ?? '');
  const [opportunityUrl, setOpportunityUrl] = useState(
    existing?.opportunityUrl ?? '',
  );
  const [status, setStatus] = useState<OpportunityStatus>(
    existing?.status ?? 'open',
  );
  const [deadline, setDeadline] = useState(existing?.deadline ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [formError, setFormError] = useState('');

  if (opportunityId && !existing) {
    return (
      <FormShell
        title="Opportunity not found"
        subtitle="This opportunity may have been removed."
        onBack={navigation.goBack}
      >
        <Notice>The opportunity could not be loaded, so no new record was created.</Notice>
      </FormShell>
    );
  }

  const save = () => {
    const cleanCompany = company.trim();
    const cleanRole = role.trim();
    const normalizedUrl = opportunityUrl.trim()
      ? normalizeWebUrl(opportunityUrl)
      : '';
    if (!cleanCompany || !cleanRole) {
      setFormError('Company and role are required.');
      return;
    }
    if (opportunityUrl.trim() && !normalizedUrl) {
      setFormError('Enter a valid http or https opportunity URL.');
      return;
    }
    if (deadline.trim() && !isValidDateOnly(deadline.trim())) {
      setFormError('Enter the deadline as a real date in YYYY-MM-DD format.');
      return;
    }

    try {
      const values = {
        company: cleanCompany,
        role: cleanRole,
        opportunityUrl: normalizedUrl ?? '',
        status,
        deadline: deadline.trim() || null,
        notes: notes.trim(),
      };
      if (existing) {
        updateOpportunity({ ...existing, ...values });
        recordActivity({
          eventType:
            existing.status === status ? 'updated' : 'status_changed',
          sourceType: 'opportunity',
          sourceId: existing.id,
          summary: `Updated opportunity: ${cleanRole} at ${cleanCompany}`,
        });
      } else {
        const created = addOpportunity({ ...values });
        recordActivity({
          eventType: 'created',
          sourceType: 'opportunity',
          sourceId: created.id,
          summary: `Added opportunity: ${cleanRole} at ${cleanCompany}`,
        });
      }
      navigation.goBack();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Could not save this opportunity.',
      );
    }
  };

  return (
    <FormShell
      title={existing ? 'Edit opportunity' : 'Add opportunity'}
      subtitle="Track roles and career opportunities independently of contacts."
      onBack={navigation.goBack}
    >
      {formError ? <Notice warning>{formError}</Notice> : null}
      <FormField
        label="Company"
        placeholder="Company or organization"
        value={company}
        onChangeText={setCompany}
        autoCapitalize="words"
      />
      <FormField
        label="Role"
        placeholder="Job title or opportunity"
        value={role}
        onChangeText={setRole}
        autoCapitalize="sentences"
      />
      <FormField
        label="Opportunity URL"
        placeholder="https://…"
        value={opportunityUrl}
        onChangeText={setOpportunityUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      <Text style={[styles.label, { color: theme.colors.text }]}>Status</Text>
      <ChoiceRow
        options={OPPORTUNITY_STATUSES}
        selected={status}
        onSelect={setStatus}
      />
      <FormField
        label="Deadline (optional)"
        placeholder="YYYY-MM-DD"
        value={deadline}
        onChangeText={setDeadline}
        autoCapitalize="none"
      />
      <FormField
        label="Notes"
        placeholder="Role details, application context, or next steps"
        value={notes}
        onChangeText={setNotes}
        multiline
      />
      {existing ? (
        <LinkedTasks
          source={{ type: 'opportunity', id: existing.id }}
          onAddTask={() =>
            navigation.navigate('TaskForm', {
              source: { type: 'opportunity', id: existing.id },
            })
          }
        />
      ) : null}
      <SaveActions
        label={existing ? 'Save opportunity changes' : 'Save opportunity'}
        onSave={save}
      />
    </FormShell>
  );
}

function ReferralRequestForm({
  navigation,
  requestId,
}: {
  navigation: Props['navigation'];
  requestId?: string;
}) {
  const { theme } = useApp();
  const { recordActivity } = useActivity();
  const {
    contacts,
    opportunities,
    requests,
    addRequest,
    updateRequest,
  } = useReferrals();
  const { syncReferralFollowUp } = useTasks();
  const existing = requestId
    ? requests.find((item) => item.id === requestId)
    : undefined;
  const [contactId, setContactId] = useState(existing?.contactId ?? '');
  const [opportunityId, setOpportunityId] = useState(
    existing?.opportunityId ?? '',
  );
  const [requestDate, setRequestDate] = useState(
    existing?.requestDate ?? todayDate(),
  );
  const [status, setStatus] = useState<ReferralStatus>(
    existing?.status ?? 'to_contact',
  );
  const [followUpDate, setFollowUpDate] = useState(
    existing?.nextFollowUpAt?.slice(0, 10) ?? '',
  );
  const [outcome, setOutcome] = useState(existing?.outcome ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [contactSearch, setContactSearch] = useState('');
  const [opportunitySearch, setOpportunitySearch] = useState('');
  const [formError, setFormError] = useState('');

  const availableContacts = useMemo(
    () =>
      contacts.filter(
        (contact) =>
          contact.archivedAt === null || contact.id === existing?.contactId,
      ),
    [contacts, existing?.contactId],
  );
  const availableOpportunities = useMemo(
    () =>
      opportunities.filter(
        (opportunity) =>
          opportunity.archivedAt === null ||
          opportunity.id === existing?.opportunityId,
      ),
    [existing?.opportunityId, opportunities],
  );
  const matchingContacts = availableContacts.filter((contact) =>
    [contact.name, contact.company, contact.role]
      .join(' ')
      .toLowerCase()
      .includes(contactSearch.trim().toLowerCase()),
  );
  const matchingOpportunities = availableOpportunities.filter((opportunity) =>
    [opportunity.company, opportunity.role]
      .join(' ')
      .toLowerCase()
      .includes(opportunitySearch.trim().toLowerCase()),
  );

  if (requestId && !existing) {
    return (
      <FormShell
        title="Request not found"
        subtitle="This referral request may have been removed."
        onBack={navigation.goBack}
      >
        <Notice>The request could not be loaded, so no new request was created.</Notice>
      </FormShell>
    );
  }

  const save = () => {
    if (!contactId || !opportunityId) {
      setFormError('Choose both a contact and an opportunity.');
      return;
    }
    if (!isValidDateOnly(requestDate.trim())) {
      setFormError('Enter the request date as a real date in YYYY-MM-DD format.');
      return;
    }
    if (followUpDate.trim() && !isValidDateOnly(followUpDate.trim())) {
      setFormError('Enter the follow-up date as a real date in YYYY-MM-DD format.');
      return;
    }
    const duplicate = requests.find(
      (item) =>
        item.id !== existing?.id &&
        item.contactId === contactId &&
        item.opportunityId === opportunityId,
    );
    if (duplicate) {
      setFormError(
        'A request already exists for this contact and opportunity. Open that request to update its status and interaction history.',
      );
      return;
    }

    try {
      const followUp =
        status !== 'closed' && followUpDate.trim()
        ? `${followUpDate.trim()}T12:00:00.000Z`
        : null;
      const values = {
        contactId,
        opportunityId,
        requestDate: requestDate.trim(),
        status,
        nextFollowUpAt: followUp,
        outcome: outcome.trim(),
        notes: notes.trim(),
      };
      if (existing) {
        const updated = { ...existing, ...values };
        updateRequest(updated);
        const followUpChanged =
          existing.nextFollowUpAt?.slice(0, 10) !==
          updated.nextFollowUpAt?.slice(0, 10);
        syncReferralFollowUp(
          updated,
          `Follow up: ${contacts.find((item) => item.id === contactId)?.name ?? 'contact'} about ${opportunities.find((item) => item.id === opportunityId)?.role ?? 'opportunity'}`,
          followUpChanged,
        );
        if (existing.status !== updated.status) {
          recordActivity({
            eventType: 'status_changed',
            sourceType: 'referral_request',
            sourceId: updated.id,
            summary: `Changed referral request status to ${updated.status.replaceAll('_', ' ')}`,
          });
        } else if (followUpChanged) {
          recordActivity({
            eventType: 'follow_up_scheduled',
            sourceType: 'referral_request',
            sourceId: updated.id,
            summary: updated.nextFollowUpAt
              ? `Scheduled referral follow-up for ${updated.nextFollowUpAt.slice(0, 10)}`
              : 'Removed referral follow-up date',
          });
        } else {
          recordActivity({
            eventType: 'updated',
            sourceType: 'referral_request',
            sourceId: updated.id,
            summary: 'Updated referral request',
          });
        }
        navigation.goBack();
      } else {
        const created = addRequest(values);
        syncReferralFollowUp(
          created,
          `Follow up: ${contacts.find((item) => item.id === contactId)?.name ?? 'contact'} about ${opportunities.find((item) => item.id === opportunityId)?.role ?? 'opportunity'}`,
          true,
        );
        recordActivity({
          eventType: 'created',
          sourceType: 'referral_request',
          sourceId: created.id,
          summary: 'Created referral request',
        });
        if (created.nextFollowUpAt) {
          recordActivity({
            eventType: 'follow_up_scheduled',
            sourceType: 'referral_request',
            sourceId: created.id,
            summary: `Scheduled referral follow-up for ${created.nextFollowUpAt.slice(0, 10)}`,
          });
        }
        navigation.replace('ReferralDetail', {
          referralRequestId: created.id,
        });
      }
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Could not save this referral request.',
      );
    }
  };

  return (
    <FormShell
      title={existing ? 'Update referral request' : 'New referral request'}
      subtitle="Keep one request for each contact and opportunity pairing."
      onBack={navigation.goBack}
    >
      {formError ? <Notice warning>{formError}</Notice> : null}
      {contacts.length === 0 || opportunities.length === 0 ? (
        <Notice>
          Add at least one contact and one opportunity first. Your current request details will remain on screen while you go back.
        </Notice>
      ) : null}
      <Text style={[styles.label, { color: theme.colors.text }]}>Contact</Text>
      <TextInput
        accessibilityLabel="Search contacts"
        placeholder="Filter contacts"
        placeholderTextColor={theme.colors.muted}
        value={contactSearch}
        onChangeText={setContactSearch}
        style={[
          styles.search,
          {
            color: theme.colors.text,
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      />
      {matchingContacts.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.choices}
        >
          {matchingContacts.map((contact) => (
            <EntityChoice
              key={contact.id}
              selected={contact.id === contactId}
              title={contact.name}
              subtitle={[contact.role, contact.company].filter(Boolean).join(' · ')}
              archived={Boolean(contact.archivedAt)}
              onPress={() => setContactId(contact.id)}
            />
          ))}
        </ScrollView>
      ) : (
        <Notice>No contacts match that search.</Notice>
      )}
      <Text style={[styles.label, { color: theme.colors.text }]}>
        Opportunity
      </Text>
      <TextInput
        accessibilityLabel="Search opportunities"
        placeholder="Filter opportunities"
        placeholderTextColor={theme.colors.muted}
        value={opportunitySearch}
        onChangeText={setOpportunitySearch}
        style={[
          styles.search,
          {
            color: theme.colors.text,
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      />
      {matchingOpportunities.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.choices}
        >
          {matchingOpportunities.map((opportunity) => (
            <EntityChoice
              key={opportunity.id}
              selected={opportunity.id === opportunityId}
              title={opportunity.role}
              subtitle={opportunity.company}
              archived={Boolean(opportunity.archivedAt)}
              onPress={() => setOpportunityId(opportunity.id)}
            />
          ))}
        </ScrollView>
      ) : (
        <Notice>No opportunities match that search.</Notice>
      )}
      <FormField
        label="Request date"
        placeholder="YYYY-MM-DD"
        value={requestDate}
        onChangeText={setRequestDate}
        autoCapitalize="none"
      />
      <Text style={[styles.label, { color: theme.colors.text }]}>Status</Text>
      <ChoiceRow
        options={REFERRAL_STATUSES}
        selected={status}
        onSelect={(value) => {
          setStatus(value);
          if (value === 'closed') setFollowUpDate('');
        }}
      />
      <FormField
        label="Next follow-up date (optional)"
        placeholder="YYYY-MM-DD"
        value={followUpDate}
        onChangeText={setFollowUpDate}
        autoCapitalize="none"
      />
      <FormField
        label="Outcome (optional)"
        placeholder="Record the result when known"
        value={outcome}
        onChangeText={setOutcome}
        multiline
      />
      <FormField
        label="Notes"
        placeholder="Context for this specific request"
        value={notes}
        onChangeText={setNotes}
        multiline
      />
      <SaveActions
        label={existing ? 'Save request changes' : 'Create referral request'}
        onSave={save}
      />
    </FormShell>
  );
}

function InteractionForm({
  navigation,
  contactId,
  referralRequestId,
}: {
  navigation: Props['navigation'];
  contactId: string;
  referralRequestId?: string;
}) {
  const { theme } = useApp();
  const { recordActivity } = useActivity();
  const { contacts, requests, opportunities, addInteraction } = useReferrals();
  const { syncReferralFollowUp } = useTasks();
  const contact = contacts.find((item) => item.id === contactId);
  const request = referralRequestId
    ? requests.find((item) => item.id === referralRequestId)
    : undefined;
  const [channel, setChannel] = useState('');
  const [summary, setSummary] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [formError, setFormError] = useState('');

  const save = () => {
    if (!summary.trim()) {
      setFormError('Add a short summary of the interaction.');
      return;
    }
    if (followUpDate.trim() && !isValidDateOnly(followUpDate.trim())) {
      setFormError('Enter the follow-up date as a real date in YYYY-MM-DD format.');
      return;
    }
    try {
      const created = addInteraction(
        {
          contactId,
          referralRequestId: referralRequestId ?? null,
          channel: channel.trim(),
          summary: summary.trim(),
          nextStep: nextStep.trim(),
        },
        request?.status === 'closed' ? null : followUpDate.trim() || null,
      );
      recordActivity({
        eventType: 'interaction_logged',
        sourceType: 'interaction',
        sourceId: created.id,
        summary: `Logged ${channel.trim() || 'an'} interaction with ${contact?.name ?? 'contact'}`,
        metadata: { contactId, referralRequestId: referralRequestId ?? '' },
      });
      if (request) {
        const nextFollowUpAt =
          request.status === 'closed'
            ? null
            : followUpDate.trim()
              ? `${followUpDate.trim()}T12:00:00.000Z`
              : request.nextFollowUpAt;
        const nextRequest = { ...request, nextFollowUpAt };
        const opportunity = opportunities.find(
          (item) => item.id === request.opportunityId,
        );
        syncReferralFollowUp(
          nextRequest,
          `Follow up: ${contact?.name ?? 'contact'} about ${opportunity?.role ?? 'opportunity'}`,
          request.nextFollowUpAt?.slice(0, 10) !==
            nextFollowUpAt?.slice(0, 10),
        );
        if (
          request.status !== 'closed' &&
          request.nextFollowUpAt?.slice(0, 10) !==
            nextFollowUpAt?.slice(0, 10) &&
          nextFollowUpAt
        ) {
          recordActivity({
            eventType: 'follow_up_scheduled',
            sourceType: 'referral_request',
            sourceId: request.id,
            summary: `Scheduled referral follow-up for ${nextFollowUpAt.slice(0, 10)}`,
          });
        }
      }
      navigation.goBack();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Could not save this interaction.',
      );
    }
  };

  if (!contact) {
    return (
      <FormShell
        title="Contact not found"
        subtitle="The contact for this interaction is unavailable."
        onBack={navigation.goBack}
      >
        <Notice>This interaction cannot be attached to a missing contact.</Notice>
      </FormShell>
    );
  }

  return (
    <FormShell
      title="Log interaction"
      subtitle={`Record your conversation with ${contact.name}.`}
      onBack={navigation.goBack}
    >
      {formError ? <Notice warning>{formError}</Notice> : null}
      <View
        style={[
          styles.contextBox,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <Text style={{ color: theme.colors.text, fontWeight: '800' }}>
          {contact.name}
        </Text>
        {contact.company ? (
          <Text style={{ color: theme.colors.muted, marginTop: 4 }}>
            {contact.company}
          </Text>
        ) : null}
      </View>
      <FormField
        label="Channel"
        placeholder="Email, phone, LinkedIn, meeting…"
        value={channel}
        onChangeText={setChannel}
        autoCapitalize="sentences"
      />
      <FormField
        label="Summary"
        placeholder="What happened?"
        value={summary}
        onChangeText={setSummary}
        multiline
        maxLength={2000}
      />
      <FormField
        label="Next step"
        placeholder="What will you or they do next?"
        value={nextStep}
        onChangeText={setNextStep}
        multiline
        maxLength={1000}
      />
      {referralRequestId && request?.status !== 'closed' ? (
        <FormField
          label="Next follow-up date (optional)"
          placeholder="YYYY-MM-DD"
          value={followUpDate}
          onChangeText={setFollowUpDate}
          autoCapitalize="none"
        />
      ) : null}
      <SaveActions label="Save interaction" onSave={save} />
    </FormShell>
  );
}

function EntityChoice({
  selected,
  title,
  subtitle,
  archived,
  onPress,
}: {
  selected: boolean;
  title: string;
  subtitle: string;
  archived: boolean;
  onPress: () => void;
}) {
  const { theme } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.entityChoice,
        {
          backgroundColor: selected ? theme.colors.chip : theme.colors.surface,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
        },
      ]}
    >
      <Text style={[styles.entityTitle, { color: theme.colors.text }]}>
        {title}
        {archived ? ' · Archived' : ''}
      </Text>
      <Text style={[styles.entitySubtitle, { color: theme.colors.muted }]}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

export function ReferralFormScreen({ navigation, route }: Props) {
  const { ready } = useReferrals();
  const { theme } = useApp();

  if (!ready) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.content}>
          <ScreenTitle title="Loading referral data" onBack={navigation.goBack} />
        </View>
      </SafeAreaView>
    );
  }

  switch (route.params.kind) {
    case 'contact':
      return (
        <ContactForm
          navigation={navigation}
          contactId={route.params.contactId}
        />
      );
    case 'opportunity':
      return (
        <OpportunityForm
          navigation={navigation}
          opportunityId={route.params.opportunityId}
        />
      );
    case 'request':
      return (
        <ReferralRequestForm
          navigation={navigation}
          requestId={route.params.requestId}
        />
      );
    case 'interaction':
      return (
        <InteractionForm
          navigation={navigation}
          contactId={route.params.contactId}
          referralRequestId={route.params.referralRequestId}
        />
      );
  }
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
  save: { marginTop: 8 },
  search: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  entityChoice: {
    minWidth: 170,
    maxWidth: 240,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  entityTitle: { fontWeight: '800', fontSize: 14 },
  entitySubtitle: { fontSize: 12, marginTop: 4 },
  contextBox: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16 },
  duplicateBox: { marginBottom: 12 },
  smallAction: { marginTop: 8 },
});
