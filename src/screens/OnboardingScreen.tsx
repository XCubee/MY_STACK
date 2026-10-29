import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, FormField } from '../components/ui';
import { TOOL_CATEGORIES } from '../domain/tool';
import { useApp } from '../state/AppContext';
import { selectionHaptic } from '../utils/haptics';

const useCases = [
  'Build software',
  'Design and create',
  'Research and learn',
  'Run a business or team',
  'Personal organization',
  'Other',
];
const experienceLevels = ['Just getting started', 'Comfortable', 'Power user'];

export function OnboardingScreen() {
  const { theme, currentUser, completeOnboarding, signOut } = useApp();
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState(
    currentUser?.user_metadata?.full_name ??
      currentUser?.user_metadata?.name ??
      '',
  );
  const [useCase, setUseCase] = useState('');
  const [otherUseCase, setOtherUseCase] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [preferredCategories, setPreferredCategories] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = (value: string, selected: boolean) => {
    selectionHaptic();
    if (selected) {
      setPreferredCategories((current) => current.filter((item) => item !== value));
    } else {
      setPreferredCategories((current) => [...current, value]);
    }
  };

  const continueStep = async () => {
    setError(null);
    if (step === 0 && !displayName.trim()) {
      setError('Add a name to personalize your dashboard.');
      return;
    }
    if (step === 1 && !useCase) {
      setError('Choose what you mainly use My Stack for.');
      return;
    }
    if (step === 2 && !experienceLevel) {
      setError('Choose the experience level that fits you best.');
      return;
    }
    if (step < 3) {
      setStep((current) => current + 1);
      return;
    }
    if (preferredCategories.length === 0) {
      setError('Select at least one category to personalize your library.');
      return;
    }

    setBusy(true);
    try {
      await completeOnboarding({
        display_name: displayName.trim(),
        use_case:
          useCase === 'Other' && otherUseCase.trim()
            ? otherUseCase.trim()
            : useCase,
        experience_level: experienceLevel,
        preferred_categories: preferredCategories,
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not save your profile. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const title =
    step === 0
      ? 'What should we call you?'
      : step === 1
        ? 'What brings you here?'
        : step === 2
          ? 'How do you like to work?'
          : 'What belongs in your stack?';
  const subtitle =
    step === 0
      ? 'A few quick details will make your dashboard feel like yours.'
      : step === 1
        ? 'We’ll use this to tailor your My Stack experience.'
        : step === 2
          ? 'There is no wrong answer. You can change this later.'
          : 'Pick the tool categories you care about most.';

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topRow}>
            <Text style={[styles.eyebrow, { color: theme.colors.primary }]}>
              SETTING UP YOUR DASHBOARD
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setError(null);
                void signOut().catch((signOutError: unknown) => {
                  setError(
                    signOutError instanceof Error
                      ? signOutError.message
                      : 'Could not sign out. Please try again.',
                  );
                });
              }}
              hitSlop={10}
            >
              <Text style={{ color: theme.colors.muted }}>Sign out</Text>
            </Pressable>
          </View>
          <View style={styles.progressRow}>
            {[0, 1, 2, 3].map((item) => (
              <View
                key={item}
                style={[
                  styles.progressTrack,
                  {
                    backgroundColor:
                      item <= step ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              />
            ))}
          </View>

          <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
            {subtitle}
          </Text>

          {step === 0 ? (
            <FormField
              label="Your name"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              placeholder="Name"
            />
          ) : null}

          {step === 1 ? (
            <View style={styles.options}>
              {useCases.map((item) => {
                const selected = useCase === item;
                return (
                  <Option
                    key={item}
                    label={item}
                    selected={selected}
                    onPress={() => setUseCase(item)}
                  />
                );
              })}
              {useCase === 'Other' ? (
                <FormField
                  label="Tell us a little more"
                  value={otherUseCase}
                  onChangeText={setOtherUseCase}
                  placeholder="Your main use case"
                />
              ) : null}
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.options}>
              {experienceLevels.map((item) => (
                <Option
                  key={item}
                  label={item}
                  selected={experienceLevel === item}
                  onPress={() => setExperienceLevel(item)}
                />
              ))}
            </View>
          ) : null}

          {step === 3 ? (
            <View style={styles.chips}>
              {TOOL_CATEGORIES.map((item) => {
                const selected = preferredCategories.includes(item);
                return (
                  <Pressable
                    key={item}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    onPress={() => choose(item, selected)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected
                          ? theme.colors.primary
                          : theme.colors.surface,
                        borderColor: selected
                          ? theme.colors.primary
                          : theme.colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: selected
                          ? theme.colors.onPrimary
                          : theme.colors.text,
                        fontWeight: '700',
                      }}
                    >
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {error ? (
            <Text accessibilityRole="alert" style={[styles.error, { color: theme.colors.danger }]}>
              {error}
            </Text>
          ) : null}
          <View style={styles.actions}>
            {step > 0 ? (
              <ActionButton
                label="Back"
                secondary
                onPress={() => {
                  setError(null);
                  setStep((current) => current - 1);
                }}
                style={styles.backButton}
              />
            ) : null}
            <ActionButton
              label={busy ? 'Saving…' : step === 3 ? 'Finish setup' : 'Continue'}
              onPress={() => void continueStep()}
              style={styles.nextButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  function Option({
    label,
    selected,
    onPress,
  }: {
    label: string;
    selected: boolean;
    onPress: () => void;
  }) {
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        onPress={() => {
          selectionHaptic();
          onPress();
        }}
        style={[
          styles.option,
          {
            backgroundColor: selected
              ? theme.colors.chip
              : theme.colors.surface,
            borderColor: selected
              ? theme.colors.primary
              : theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.optionText, { color: theme.colors.text }]}>
          {label}
        </Text>
        <Text style={{ color: theme.colors.primary, fontWeight: '800' }}>
          {selected ? '✓' : ''}
        </Text>
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 28 },
  topRow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  progressRow: { flexDirection: 'row', gap: 7, marginBottom: 30 },
  progressTrack: { flex: 1, height: 4, borderRadius: 3 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 26 },
  options: { gap: 10 },
  option: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionText: { fontSize: 15, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 11,
    paddingHorizontal: 15,
  },
  error: { fontSize: 14, lineHeight: 20, marginTop: 16 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 'auto', paddingTop: 34 },
  backButton: { flex: 1 },
  nextButton: { flex: 2 },
});
