import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  OPPORTUNITY_STATUSES,
  REFERRAL_STATUSES,
  type Contact,
  type Interaction,
  type Opportunity,
  type ReferralRequest,
} from '../domain/referral';

const storageKey = 'my_stack.referrals.v1';

export type ReferralSnapshot = {
  contacts: Contact[];
  opportunities: Opportunity[];
  requests: ReferralRequest[];
  interactions: Interaction[];
  syncPending: boolean;
};

function keyForUser(userId?: string): string {
  return userId ? `${storageKey}.user.${userId}` : storageKey;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isContact(value: unknown): value is Contact {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.company === 'string' &&
    typeof value.role === 'string' &&
    typeof value.profileUrl === 'string' &&
    typeof value.contactDetails === 'string' &&
    typeof value.notes === 'string' &&
    isNullableString(value.archivedAt) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function isOpportunity(value: unknown): value is Opportunity {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.company === 'string' &&
    typeof value.role === 'string' &&
    typeof value.opportunityUrl === 'string' &&
    OPPORTUNITY_STATUSES.some((status) => status === value.status) &&
    isNullableString(value.deadline) &&
    typeof value.notes === 'string' &&
    isNullableString(value.archivedAt) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function isReferralRequest(value: unknown): value is ReferralRequest {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.contactId === 'string' &&
    typeof value.opportunityId === 'string' &&
    typeof value.requestDate === 'string' &&
    REFERRAL_STATUSES.some((status) => status === value.status) &&
    isNullableString(value.lastInteractionAt) &&
    isNullableString(value.nextFollowUpAt) &&
    typeof value.outcome === 'string' &&
    typeof value.notes === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function isInteraction(value: unknown): value is Interaction {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.contactId === 'string' &&
    isNullableString(value.referralRequestId) &&
    typeof value.interactionAt === 'string' &&
    typeof value.channel === 'string' &&
    typeof value.summary === 'string' &&
    typeof value.nextStep === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

export async function loadLocalReferrals(
  userId?: string,
): Promise<ReferralSnapshot | null> {
  const encoded = await AsyncStorage.getItem(keyForUser(userId));
  if (encoded === null) return null;

  const decoded: unknown = JSON.parse(encoded);
  if (
    !isRecord(decoded) ||
    decoded.version !== 1 ||
    !Array.isArray(decoded.contacts) ||
    !decoded.contacts.every(isContact) ||
    !Array.isArray(decoded.opportunities) ||
    !decoded.opportunities.every(isOpportunity) ||
    !Array.isArray(decoded.requests) ||
    !decoded.requests.every(isReferralRequest) ||
    !Array.isArray(decoded.interactions) ||
    !decoded.interactions.every(isInteraction) ||
    typeof decoded.syncPending !== 'boolean'
  ) {
    throw new Error('Saved referral data has an unsupported format.');
  }

  return {
    contacts: decoded.contacts,
    opportunities: decoded.opportunities,
    requests: decoded.requests,
    interactions: decoded.interactions,
    syncPending: decoded.syncPending,
  };
}

export async function saveLocalReferrals(
  snapshot: ReferralSnapshot,
  userId?: string,
): Promise<void> {
  await AsyncStorage.setItem(
    keyForUser(userId),
    JSON.stringify({ version: 1, ...snapshot }),
  );
}

function requiredString(
  row: Record<string, unknown>,
  key: string,
): string | null {
  return typeof row[key] === 'string' ? row[key] : null;
}

function nullableString(
  row: Record<string, unknown>,
  key: string,
): string | null | undefined {
  const value = row[key];
  if (value === null || typeof value === 'string') return value;
  return undefined;
}

export function contactFromRow(row: Record<string, unknown>): Contact {
  const contact: Contact = {
    id: requiredString(row, 'id') ?? '',
    name: requiredString(row, 'name') ?? '',
    company: requiredString(row, 'company') ?? '',
    role: requiredString(row, 'role') ?? '',
    profileUrl: requiredString(row, 'profile_url') ?? '',
    contactDetails: requiredString(row, 'contact_details') ?? '',
    notes: requiredString(row, 'notes') ?? '',
    archivedAt: nullableString(row, 'archived_at') ?? null,
    createdAt: requiredString(row, 'created_at') ?? '',
    updatedAt: requiredString(row, 'updated_at') ?? '',
  };
  if (!isContact(contact)) {
    throw new Error('Contact data from Supabase has an unsupported format.');
  }
  return contact;
}

export function opportunityFromRow(
  row: Record<string, unknown>,
): Opportunity {
  const opportunity: Opportunity = {
    id: requiredString(row, 'id') ?? '',
    company: requiredString(row, 'company') ?? '',
    role: requiredString(row, 'role') ?? '',
    opportunityUrl: requiredString(row, 'opportunity_url') ?? '',
    status: requiredString(row, 'status') as Opportunity['status'],
    deadline: nullableString(row, 'deadline') ?? null,
    notes: requiredString(row, 'notes') ?? '',
    archivedAt: nullableString(row, 'archived_at') ?? null,
    createdAt: requiredString(row, 'created_at') ?? '',
    updatedAt: requiredString(row, 'updated_at') ?? '',
  };
  if (!isOpportunity(opportunity)) {
    throw new Error('Opportunity data from Supabase has an unsupported format.');
  }
  return opportunity;
}

export function referralRequestFromRow(
  row: Record<string, unknown>,
): ReferralRequest {
  const request: ReferralRequest = {
    id: requiredString(row, 'id') ?? '',
    contactId: requiredString(row, 'contact_id') ?? '',
    opportunityId: requiredString(row, 'opportunity_id') ?? '',
    requestDate: requiredString(row, 'request_date') ?? '',
    status: requiredString(row, 'status') as ReferralRequest['status'],
    lastInteractionAt: nullableString(row, 'last_interaction_at') ?? null,
    nextFollowUpAt: nullableString(row, 'next_follow_up_at') ?? null,
    outcome: requiredString(row, 'outcome') ?? '',
    notes: requiredString(row, 'notes') ?? '',
    createdAt: requiredString(row, 'created_at') ?? '',
    updatedAt: requiredString(row, 'updated_at') ?? '',
  };
  if (!isReferralRequest(request)) {
    throw new Error('Referral data from Supabase has an unsupported format.');
  }
  return request;
}

export function interactionFromRow(
  row: Record<string, unknown>,
): Interaction {
  const interaction: Interaction = {
    id: requiredString(row, 'id') ?? '',
    contactId: requiredString(row, 'contact_id') ?? '',
    referralRequestId:
      nullableString(row, 'referral_request_id') ?? null,
    interactionAt: requiredString(row, 'interaction_at') ?? '',
    channel: requiredString(row, 'channel') ?? '',
    summary: requiredString(row, 'summary') ?? '',
    nextStep: requiredString(row, 'next_step') ?? '',
    createdAt: requiredString(row, 'created_at') ?? '',
    updatedAt: requiredString(row, 'updated_at') ?? '',
  };
  if (!isInteraction(interaction)) {
    throw new Error('Interaction data from Supabase has an unsupported format.');
  }
  return interaction;
}

export async function readCloudReferrals(
  client: SupabaseClient,
  userId: string,
): Promise<ReferralSnapshot> {
  const [contacts, opportunities, requests, interactions] = await Promise.all([
    client.from('contacts').select('*').eq('user_id', userId),
    client.from('opportunities').select('*').eq('user_id', userId),
    client.from('referral_requests').select('*').eq('user_id', userId),
    client.from('interactions').select('*').eq('user_id', userId),
  ]);
  if (contacts.error) throw contacts.error;
  if (opportunities.error) throw opportunities.error;
  if (requests.error) throw requests.error;
  if (interactions.error) throw interactions.error;

  return {
    contacts: (contacts.data ?? []).map((row) =>
      contactFromRow(row as Record<string, unknown>),
    ),
    opportunities: (opportunities.data ?? []).map((row) =>
      opportunityFromRow(row as Record<string, unknown>),
    ),
    requests: (requests.data ?? []).map((row) =>
      referralRequestFromRow(row as Record<string, unknown>),
    ),
    interactions: (interactions.data ?? []).map((row) =>
      interactionFromRow(row as Record<string, unknown>),
    ),
    syncPending: false,
  };
}

function toContactRow(contact: Contact, userId: string) {
  return {
    id: contact.id,
    user_id: userId,
    name: contact.name,
    company: contact.company,
    role: contact.role,
    profile_url: contact.profileUrl,
    contact_details: contact.contactDetails,
    notes: contact.notes,
    archived_at: contact.archivedAt,
    created_at: contact.createdAt,
    updated_at: contact.updatedAt,
  };
}

function toOpportunityRow(opportunity: Opportunity, userId: string) {
  return {
    id: opportunity.id,
    user_id: userId,
    company: opportunity.company,
    role: opportunity.role,
    opportunity_url: opportunity.opportunityUrl,
    status: opportunity.status,
    deadline: opportunity.deadline,
    notes: opportunity.notes,
    archived_at: opportunity.archivedAt,
    created_at: opportunity.createdAt,
    updated_at: opportunity.updatedAt,
  };
}

function toRequestRow(request: ReferralRequest, userId: string) {
  return {
    id: request.id,
    user_id: userId,
    contact_id: request.contactId,
    opportunity_id: request.opportunityId,
    request_date: request.requestDate,
    status: request.status,
    last_interaction_at: request.lastInteractionAt,
    next_follow_up_at: request.nextFollowUpAt,
    outcome: request.outcome,
    notes: request.notes,
    created_at: request.createdAt,
    updated_at: request.updatedAt,
  };
}

function toInteractionRow(interaction: Interaction, userId: string) {
  return {
    id: interaction.id,
    user_id: userId,
    contact_id: interaction.contactId,
    referral_request_id: interaction.referralRequestId,
    interaction_at: interaction.interactionAt,
    channel: interaction.channel,
    summary: interaction.summary,
    next_step: interaction.nextStep,
    created_at: interaction.createdAt,
    updated_at: interaction.updatedAt,
  };
}

async function upsertRows(
  client: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await client
    .from(table)
    .upsert(rows, { onConflict: 'user_id,id' });
  if (error) throw error;
}

export async function writeCloudReferrals(
  client: SupabaseClient,
  userId: string,
  snapshot: ReferralSnapshot,
): Promise<void> {
  await upsertRows(
    client,
    'contacts',
    snapshot.contacts.map((contact) => toContactRow(contact, userId)),
  );
  await upsertRows(
    client,
    'opportunities',
    snapshot.opportunities.map((opportunity) =>
      toOpportunityRow(opportunity, userId),
    ),
  );
  await upsertRows(
    client,
    'referral_requests',
    snapshot.requests.map((request) => toRequestRow(request, userId)),
  );
  await upsertRows(
    client,
    'interactions',
    snapshot.interactions.map((interaction) =>
      toInteractionRow(interaction, userId),
    ),
  );
}
