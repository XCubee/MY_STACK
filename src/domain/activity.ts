export type ActivityEventType =
  | 'created'
  | 'updated'
  | 'archived'
  | 'completed'
  | 'status_changed'
  | 'interaction_logged'
  | 'follow_up_scheduled'
  | 'reminder_completed';

export type ActivitySourceType =
  | 'learning_item'
  | 'learning_section'
  | 'contact'
  | 'opportunity'
  | 'referral_request'
  | 'interaction'
  | 'task'
  | 'note'
  | 'subscription'
  | 'tool';

export type ActivityEvent = {
  id: string;
  eventType: ActivityEventType;
  sourceType: ActivitySourceType;
  sourceId: string;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};
