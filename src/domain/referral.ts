export type Contact = {
  id: string;
  name: string;
  company: string;
  role: string;
  profileUrl: string;
  contactDetails: string;
  notes: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const OPPORTUNITY_STATUSES = [
  'open',
  'applied',
  'interviewing',
  'offer',
  'closed',
  'declined',
] as const;

export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export type Opportunity = {
  id: string;
  company: string;
  role: string;
  opportunityUrl: string;
  status: OpportunityStatus;
  deadline: string | null;
  notes: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const REFERRAL_STATUSES = [
  'to_contact',
  'requested',
  'awaiting_response',
  'in_discussion',
  'referred',
  'declined',
  'closed',
] as const;

export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

export type ReferralRequest = {
  id: string;
  contactId: string;
  opportunityId: string;
  requestDate: string;
  status: ReferralStatus;
  lastInteractionAt: string | null;
  nextFollowUpAt: string | null;
  outcome: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Interaction = {
  id: string;
  contactId: string;
  referralRequestId: string | null;
  interactionAt: string;
  channel: string;
  summary: string;
  nextStep: string;
  createdAt: string;
  updatedAt: string;
};
