export type NoteSource =
  | { type: 'learning_item'; id: string }
  | { type: 'contact'; id: string }
  | { type: 'opportunity'; id: string }
  | { type: 'referral_request'; id: string }
  | { type: 'subscription'; id: string }
  | { type: 'tool'; id: string };

export type Note = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  source: NoteSource | null;
  createdAt: string;
  updatedAt: string;
};
