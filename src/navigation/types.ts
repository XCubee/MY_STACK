import type { TaskSource } from '../domain/task';

export type RootStackParamList = {
  MainTabs: undefined;
  Search: undefined;
  Activity: undefined;
  ToolDetail: { toolId: string };
  ToolForm: { toolId?: string } | undefined;
  SubscriptionForm: { subscriptionId?: string } | undefined;
  Learning: undefined;
  LearningDetail: { learningItemId: string };
  LearningForm: { learningItemId?: string } | undefined;
  LearningSectionForm: {
    learningItemId: string;
    sectionId?: string;
    parentSectionId?: string;
  };
  Referrals: undefined;
  ReferralDetail: { referralRequestId: string };
  ReferralForm:
    | { kind: 'contact'; contactId?: string }
    | { kind: 'opportunity'; opportunityId?: string }
    | { kind: 'request'; requestId?: string }
    | {
        kind: 'interaction';
        contactId: string;
        referralRequestId?: string;
      };
  Tasks: undefined;
  TaskForm: { taskId?: string; source?: TaskSource } | undefined;
  Favorites: undefined;
  Renewals: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Library: undefined;
  Add: undefined;
  Projects: undefined;
  Settings: undefined;
};
