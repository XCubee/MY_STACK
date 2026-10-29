export type UserProfile = {
  id: string;
  display_name: string;
  use_case: string;
  experience_level: string;
  preferred_categories: string[];
  onboarding_completed: boolean;
};

export type OnboardingAnswers = Omit<
  UserProfile,
  'id' | 'onboarding_completed'
>;

export function profileFromRow(row: unknown): UserProfile | null {
  if (typeof row !== 'object' || row === null) return null;
  const record = row as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.display_name !== 'string' ||
    typeof record.use_case !== 'string' ||
    typeof record.experience_level !== 'string' ||
    !Array.isArray(record.preferred_categories) ||
    !record.preferred_categories.every(
      (category): category is string => typeof category === 'string',
    ) ||
    typeof record.onboarding_completed !== 'boolean'
  ) {
    return null;
  }
  return {
    id: record.id,
    display_name: record.display_name,
    use_case: record.use_case,
    experience_level: record.experience_level,
    preferred_categories: record.preferred_categories,
    onboarding_completed: record.onboarding_completed,
  };
}
