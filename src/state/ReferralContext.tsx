import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import type {
  Contact,
  Interaction,
  Opportunity,
  ReferralRequest,
} from '../domain/referral';
import { useApp } from './AppContext';
import {
  loadLocalReferrals,
  readCloudReferrals,
  saveLocalReferrals,
  writeCloudReferrals,
  type ReferralSnapshot,
} from '../services/referralStorage';
import { createSupabaseClient } from '../services/supabase';

type NewContact = Omit<
  Contact,
  'id' | 'archivedAt' | 'createdAt' | 'updatedAt'
>;
type NewOpportunity = Omit<
  Opportunity,
  'id' | 'archivedAt' | 'createdAt' | 'updatedAt'
>;
type NewReferralRequest = Omit<
  ReferralRequest,
  'id' | 'lastInteractionAt' | 'createdAt' | 'updatedAt'
>;
type NewInteraction = Omit<
  Interaction,
  'id' | 'interactionAt' | 'createdAt' | 'updatedAt'
>;

type ReferralContextValue = {
  contacts: Contact[];
  opportunities: Opportunity[];
  requests: ReferralRequest[];
  interactions: Interaction[];
  ready: boolean;
  error: string | null;
  addContact: (contact: NewContact) => Contact;
  updateContact: (contact: Contact) => void;
  setContactArchived: (id: string, archived: boolean) => void;
  addOpportunity: (opportunity: NewOpportunity) => Opportunity;
  updateOpportunity: (opportunity: Opportunity) => void;
  setOpportunityArchived: (id: string, archived: boolean) => void;
  addRequest: (request: NewReferralRequest) => ReferralRequest;
  updateRequest: (request: ReferralRequest) => void;
  addInteraction: (
    interaction: NewInteraction,
    followUpDate: string | null,
  ) => Interaction;
  retrySync: () => Promise<void>;
};

const EMPTY_SNAPSHOT: ReferralSnapshot = {
  contacts: [],
  opportunities: [],
  requests: [],
  interactions: [],
  syncPending: false,
};

const ReferralContext = createContext<ReferralContextValue | null>(null);

function mergeById<T extends { id: string }>(
  local: T[],
  cloud: T[],
): T[] {
  const merged = new Map<string, T>();
  for (const value of [...cloud, ...local]) merged.set(value.id, value);
  return [...merged.values()];
}

function mergeSnapshots(
  local: ReferralSnapshot,
  cloud: ReferralSnapshot,
): ReferralSnapshot {
  return {
    contacts: mergeById(local.contacts, cloud.contacts),
    opportunities: mergeById(local.opportunities, cloud.opportunities),
    requests: mergeById(local.requests, cloud.requests),
    interactions: mergeById(local.interactions, cloud.interactions),
    syncPending: true,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ReferralProvider({ children }: PropsWithChildren) {
  const { authStatus, currentUser } = useApp();
  const ownerId =
    authStatus === 'authenticated' || authStatus === 'onboarding'
      ? currentUser?.id
      : undefined;
  const identity =
    ownerId ?? (authStatus === 'offline' ? 'local' : `session:${authStatus}`);
  const [snapshot, setSnapshot] =
    useState<ReferralSnapshot>(EMPTY_SNAPSHOT);
  const [loadedIdentity, setLoadedIdentity] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<{
    identity: string;
    message: string;
  } | null>(null);
  const snapshotRef = useRef(snapshot);
  const ownerIdRef = useRef<string | undefined>(undefined);
  const identityRef = useRef('local');
  const saveRevision = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const ready = loadedIdentity === identity;
  const canAccessSnapshot = ready && (authStatus === 'offline' || Boolean(ownerId));
  const error =
    errorState?.identity === identity ? errorState.message : null;

  const showSnapshot = useCallback((next: ReferralSnapshot) => {
    snapshotRef.current = next;
    setSnapshot(next);
  }, []);
  const setReferralError = useCallback((message: string | null) => {
    setErrorState(
      message === null
        ? null
        : { identity: identityRef.current, message },
    );
  }, []);
  const syncSnapshot = useCallback(
    async (
      next: ReferralSnapshot,
      userId: string,
    ): Promise<ReferralSnapshot> => {
      const client = createSupabaseClient();
      if (!client) throw new Error('Supabase is not configured.');
      await writeCloudReferrals(client, userId, next);
      return { ...next, syncPending: false };
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    ownerIdRef.current = ownerId;
    identityRef.current = identity;

    const hydrate = async () => {
      try {
        if (authStatus === 'loading') return;
        if (authStatus !== 'offline' && !ownerId) return;

        const local = (await loadLocalReferrals(ownerId)) ?? EMPTY_SNAPSHOT;
        if (authStatus === 'offline') {
          if (!cancelled) showSnapshot(local);
          return;
        }

        const client = createSupabaseClient();
        if (!client || !ownerId) {
          if (!cancelled) {
            showSnapshot(local);
            setReferralError(
              'Referral data is available locally; cloud sync is not configured.',
            );
          }
          return;
        }

        let cloud: ReferralSnapshot;
        try {
          cloud = await readCloudReferrals(client, ownerId);
        } catch (readError) {
          if (!cancelled) {
            showSnapshot(local);
            setReferralError(
              `Could not load referral data from Supabase: ${readError instanceof Error ? readError.message : String(readError)}`,
            );
          }
          return;
        }

        const next = local.syncPending
          ? mergeSnapshots(local, cloud)
          : cloud;
        if (cancelled) return;
        showSnapshot(next);
        await saveLocalReferrals(next, ownerId);
        if (next.syncPending) {
          try {
            const synced = await syncSnapshot(next, ownerId);
            await saveLocalReferrals(synced, ownerId);
            if (!cancelled) showSnapshot(synced);
          } catch (syncError) {
            if (!cancelled) {
              setReferralError(
                `Referral cloud sync failed: ${syncError instanceof Error ? syncError.message : String(syncError)}`,
              );
            }
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setReferralError(
            `Could not load saved referral data: ${loadError instanceof Error ? loadError.message : String(loadError)}`,
          );
        }
      } finally {
        if (!cancelled) setLoadedIdentity(identity);
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [
    authStatus,
    currentUser?.id,
    identity,
    ownerId,
    setReferralError,
    showSnapshot,
    syncSnapshot,
  ]);

  const queueSave = useCallback(
    (next: ReferralSnapshot) => {
      const userId = ownerIdRef.current;
      const revision = ++saveRevision.current;
      const pending = { ...next, syncPending: Boolean(userId) };
      showSnapshot(pending);
      saveQueue.current = saveQueue.current.then(async () => {
        try {
          await saveLocalReferrals(pending, userId);
          if (!userId || ownerIdRef.current !== userId) return;
          const synced = await syncSnapshot(pending, userId);
          await saveLocalReferrals(synced, userId);
          if (
            ownerIdRef.current === userId &&
            revision === saveRevision.current
          ) {
            showSnapshot(synced);
            setReferralError(null);
          }
        } catch (saveError) {
          if (
            ownerIdRef.current === userId &&
            revision === saveRevision.current
          ) {
            setReferralError(
              `Referral data is saved on this device, but cloud sync failed: ${saveError instanceof Error ? saveError.message : String(saveError)}`,
            );
          }
        }
      });
    },
    [setReferralError, showSnapshot, syncSnapshot],
  );

  const addContact = useCallback(
    (values: NewContact) => {
      const timestamp = nowIso();
      const contact: Contact = {
        ...values,
        id: makeId('contact'),
        archivedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      queueSave({
        ...snapshotRef.current,
        contacts: [contact, ...snapshotRef.current.contacts],
      });
      return contact;
    },
    [queueSave],
  );

  const updateContact = useCallback(
    (contact: Contact) => {
      if (!snapshotRef.current.contacts.some((item) => item.id === contact.id)) {
        throw new Error('This contact no longer exists.');
      }
      queueSave({
        ...snapshotRef.current,
        contacts: snapshotRef.current.contacts.map((item) =>
          item.id === contact.id ? { ...contact, updatedAt: nowIso() } : item,
        ),
      });
    },
    [queueSave],
  );

  const setContactArchived = useCallback(
    (id: string, archived: boolean) => {
      const contact = snapshotRef.current.contacts.find((item) => item.id === id);
      if (!contact) throw new Error('This contact no longer exists.');
      updateContact({
        ...contact,
        archivedAt: archived ? contact.archivedAt ?? nowIso() : null,
      });
    },
    [updateContact],
  );

  const addOpportunity = useCallback(
    (values: NewOpportunity) => {
      const timestamp = nowIso();
      const opportunity: Opportunity = {
        ...values,
        id: makeId('opportunity'),
        archivedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      queueSave({
        ...snapshotRef.current,
        opportunities: [opportunity, ...snapshotRef.current.opportunities],
      });
      return opportunity;
    },
    [queueSave],
  );

  const updateOpportunity = useCallback(
    (opportunity: Opportunity) => {
      if (
        !snapshotRef.current.opportunities.some(
          (item) => item.id === opportunity.id,
        )
      ) {
        throw new Error('This opportunity no longer exists.');
      }
      queueSave({
        ...snapshotRef.current,
        opportunities: snapshotRef.current.opportunities.map((item) =>
          item.id === opportunity.id
            ? { ...opportunity, updatedAt: nowIso() }
            : item,
        ),
      });
    },
    [queueSave],
  );

  const setOpportunityArchived = useCallback(
    (id: string, archived: boolean) => {
      const opportunity = snapshotRef.current.opportunities.find(
        (item) => item.id === id,
      );
      if (!opportunity) throw new Error('This opportunity no longer exists.');
      updateOpportunity({
        ...opportunity,
        archivedAt: archived ? opportunity.archivedAt ?? nowIso() : null,
      });
    },
    [updateOpportunity],
  );

  const addRequest = useCallback(
    (values: NewReferralRequest) => {
      const current = snapshotRef.current;
      if (!current.contacts.some((contact) => contact.id === values.contactId)) {
        throw new Error('Choose an existing contact for this request.');
      }
      if (
        !current.opportunities.some(
          (opportunity) => opportunity.id === values.opportunityId,
        )
      ) {
        throw new Error('Choose an existing opportunity for this request.');
      }
      if (
        current.requests.some(
          (request) =>
            request.contactId === values.contactId &&
            request.opportunityId === values.opportunityId,
        )
      ) {
        throw new Error('A referral request already exists for this pairing.');
      }
      const timestamp = nowIso();
      const request: ReferralRequest = {
        ...values,
        id: makeId('referral'),
        lastInteractionAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      queueSave({
        ...current,
        requests: [request, ...current.requests],
      });
      return request;
    },
    [queueSave],
  );

  const updateRequest = useCallback(
    (request: ReferralRequest) => {
      const current = snapshotRef.current;
      if (!current.requests.some((item) => item.id === request.id)) {
        throw new Error('This referral request no longer exists.');
      }
      if (
        !current.contacts.some((contact) => contact.id === request.contactId) ||
        !current.opportunities.some(
          (opportunity) => opportunity.id === request.opportunityId,
        )
      ) {
        throw new Error('Keep this request linked to an existing contact and opportunity.');
      }
      if (
        current.requests.some(
          (item) =>
            item.id !== request.id &&
            item.contactId === request.contactId &&
            item.opportunityId === request.opportunityId,
        )
      ) {
        throw new Error('A referral request already exists for this pairing.');
      }
      queueSave({
        ...current,
        requests: current.requests.map((item) =>
          item.id === request.id ? { ...request, updatedAt: nowIso() } : item,
        ),
      });
    },
    [queueSave],
  );

  const addInteraction = useCallback(
    (values: NewInteraction, followUpDate: string | null) => {
      const current = snapshotRef.current;
      const contact = current.contacts.find(
        (item) => item.id === values.contactId,
      );
      if (!contact) throw new Error('Choose an existing contact.');
      const request = values.referralRequestId
        ? current.requests.find(
            (item) =>
              item.id === values.referralRequestId &&
              item.contactId === values.contactId,
          )
        : undefined;
      if (values.referralRequestId && !request) {
        throw new Error('This referral request is not linked to the contact.');
      }
      const timestamp = nowIso();
      const interaction: Interaction = {
        ...values,
        id: makeId('interaction'),
        interactionAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const requests = request
        ? current.requests.map((item) =>
            item.id === request.id
              ? {
                  ...item,
                  lastInteractionAt: timestamp,
                  nextFollowUpAt: followUpDate
                    ? `${followUpDate}T12:00:00.000Z`
                    : item.nextFollowUpAt,
                  updatedAt: timestamp,
                }
              : item,
          )
        : current.requests;
      queueSave({
        ...current,
        requests,
        interactions: [interaction, ...current.interactions],
      });
      return interaction;
    },
    [queueSave],
  );

  const retrySync = useCallback(async () => {
    const userId = ownerIdRef.current;
    if (!userId) return;
    await saveQueue.current;
    const revision = saveRevision.current;
    const current = snapshotRef.current;
    try {
      const client = createSupabaseClient();
      if (!client) throw new Error('Supabase is not configured.');
      const synced = current.syncPending
        ? await syncSnapshot(current, userId)
        : await readCloudReferrals(client, userId);
      await saveLocalReferrals(synced, userId);
      if (
        ownerIdRef.current === userId &&
        revision === saveRevision.current
      ) {
        showSnapshot(synced);
        setReferralError(null);
      }
    } catch (syncError) {
      if (ownerIdRef.current === userId) {
        setReferralError(
          `Referral cloud sync failed: ${syncError instanceof Error ? syncError.message : String(syncError)}`,
        );
      }
    }
  }, [setReferralError, showSnapshot, syncSnapshot]);

  const value = useMemo<ReferralContextValue>(
    () => ({
      contacts: canAccessSnapshot ? snapshot.contacts : [],
      opportunities: canAccessSnapshot ? snapshot.opportunities : [],
      requests: canAccessSnapshot ? snapshot.requests : [],
      interactions: canAccessSnapshot ? snapshot.interactions : [],
      ready,
      error,
      addContact,
      updateContact,
      setContactArchived,
      addOpportunity,
      updateOpportunity,
      setOpportunityArchived,
      addRequest,
      updateRequest,
      addInteraction,
      retrySync,
    }),
    [
      snapshot,
      canAccessSnapshot,
      ready,
      error,
      addContact,
      updateContact,
      setContactArchived,
      addOpportunity,
      updateOpportunity,
      setOpportunityArchived,
      addRequest,
      updateRequest,
      addInteraction,
      retrySync,
    ],
  );

  return (
    <ReferralContext.Provider value={value}>{children}</ReferralContext.Provider>
  );
}

export function useReferrals() {
  const context = useContext(ReferralContext);
  if (!context) {
    throw new Error('useReferrals must be used within ReferralProvider.');
  }
  return context;
}
