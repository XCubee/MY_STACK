export const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = [
  'open',
  'in_progress',
  'completed',
  'canceled',
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export type TaskSource =
  | { type: 'learning_item'; id: string }
  | { type: 'referral_request'; id: string }
  | { type: 'subscription'; id: string }
  | { type: 'tool'; id: string }
  | { type: 'contact'; id: string }
  | { type: 'opportunity'; id: string };

export type Task = {
  id: string;
  title: string;
  description: string;
  dueDate: string | null;
  dueAt: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  reminderEnabled: boolean;
  remindAt: string | null;
  completedAt: string | null;
  source: TaskSource | null;
  createdAt: string;
  updatedAt: string;
};
