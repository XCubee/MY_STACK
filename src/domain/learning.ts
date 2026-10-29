export const LEARNING_ITEM_TYPES = [
  'course',
  'topic',
  'skill',
  'book',
  'tutorial',
  'certification',
  'roadmap',
] as const;

export type LearningItemType = (typeof LEARNING_ITEM_TYPES)[number];

export const LEARNING_STATUSES = [
  'planned',
  'in_progress',
  'paused',
  'completed',
] as const;

export type LearningStatus = (typeof LEARNING_STATUSES)[number];

export type LearningItem = {
  id: string;
  title: string;
  type: LearningItemType;
  provider: string;
  sourceUrl: string;
  status: LearningStatus;
  progress: number | null;
  currentPosition: string;
  startDate: string | null;
  targetDate: string | null;
  lastStudiedDate: string | null;
  notes: string;
  tags: string[];
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LearningSection = {
  id: string;
  learningItemId: string;
  parentSectionId: string | null;
  title: string;
  position: number;
  isCompleted: boolean;
  url: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function makeLearningItemId(): string {
  return `learning-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeLearningSectionId(): string {
  return `learning-section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
