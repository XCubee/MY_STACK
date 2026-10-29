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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActionButton, FormField, Notice, ScreenTitle } from '../components/ui';
import {
  LEARNING_ITEM_TYPES,
  LEARNING_STATUSES,
  type LearningItemType,
  type LearningStatus,
} from '../domain/learning';
import { isValidDateOnly } from '../domain/subscription';
import { normalizeWebUrl } from '../domain/tool';
import type { RootStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';
import { useActivity } from '../state/ActivityContext';
import { useLearning } from '../state/LearningContext';
import { selectionHaptic } from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'LearningForm'>;

function titleCase(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function LearningFormScreen({ navigation, route }: Props) {
  const { theme } = useApp();
  const { recordActivity } = useActivity();
  const { items, addItem, updateItem } = useLearning();
  const existing = route.params?.learningItemId
    ? items.find((item) => item.id === route.params?.learningItemId)
    : undefined;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [type, setType] = useState<LearningItemType>(
    existing?.type ?? 'course',
  );
  const [provider, setProvider] = useState(existing?.provider ?? '');
  const [sourceUrl, setSourceUrl] = useState(existing?.sourceUrl ?? '');
  const [status, setStatus] = useState<LearningStatus>(
    existing?.status ?? 'planned',
  );
  const [progress, setProgress] = useState(
    existing?.progress === null || existing?.progress === undefined
      ? ''
      : String(existing.progress),
  );
  const [currentPosition, setCurrentPosition] = useState(
    existing?.currentPosition ?? '',
  );
  const [startDate, setStartDate] = useState(existing?.startDate ?? '');
  const [targetDate, setTargetDate] = useState(existing?.targetDate ?? '');
  const [lastStudiedDate, setLastStudiedDate] = useState(
    existing?.lastStudiedDate ?? '',
  );
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [tags, setTags] = useState(existing?.tags.join(', ') ?? '');
  const [formError, setFormError] = useState('');

  if (route.params?.learningItemId && !existing) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.content}>
          <ScreenTitle title="Learning item not found" onBack={navigation.goBack} />
          <Text style={{ color: theme.colors.muted }}>
            This item may have been deleted.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const save = () => {
    const cleanTitle = title.trim();
    const normalizedSourceUrl = sourceUrl.trim()
      ? normalizeWebUrl(sourceUrl)
      : '';
    const parsedProgress = progress.trim() ? Number(progress) : null;
    const dateFields = [
      ['start date', startDate],
      ['target date', targetDate],
      ['last studied date', lastStudiedDate],
    ] as const;
    const invalidDate = dateFields.find(
      ([, value]) => value.trim() !== '' && !isValidDateOnly(value.trim()),
    );

    if (!cleanTitle) {
      setFormError('Enter a title for this learning item.');
      return;
    }
    if (sourceUrl.trim() && !normalizedSourceUrl) {
      setFormError('Enter a valid http or https source URL.');
      return;
    }
    if (
      progress.trim() &&
      (!Number.isInteger(parsedProgress) ||
        parsedProgress === null ||
        parsedProgress < 0 ||
        parsedProgress > 100)
    ) {
      setFormError('Progress must be a whole number from 0 to 100.');
      return;
    }
    if (invalidDate) {
      setFormError(`Enter ${invalidDate[0]} as a real date in YYYY-MM-DD format.`);
      return;
    }

    const cleanSourceUrl = normalizedSourceUrl ?? '';
    const next = {
      title: cleanTitle,
      type,
      provider: provider.trim(),
      sourceUrl: cleanSourceUrl,
      status,
      progress: status === 'completed' ? 100 : parsedProgress,
      currentPosition: currentPosition.trim(),
      startDate: startDate.trim() || null,
      targetDate: targetDate.trim() || null,
      lastStudiedDate: lastStudiedDate.trim() || null,
      notes: notes.trim(),
      tags: [...new Set(tags.split(',').map((tag) => tag.trim()).filter(Boolean))],
    };

    setFormError('');
    if (existing) {
      updateItem({ ...existing, ...next });
      recordActivity({
        eventType:
          existing.status === status ? 'updated' : 'status_changed',
        sourceType: 'learning_item',
        sourceId: existing.id,
        summary:
          existing.status === status
            ? `Updated learning item: ${cleanTitle}`
            : `Changed ${cleanTitle} to ${status.replaceAll('_', ' ')}`,
      });
      navigation.goBack();
      return;
    }
    const created = addItem({ ...next, progress: next.progress });
    recordActivity({
      eventType: 'created',
      sourceType: 'learning_item',
      sourceId: created.id,
      summary: `Started tracking learning item: ${cleanTitle}`,
    });
    navigation.replace('LearningDetail', {
      learningItemId: created.id,
    });
  };

  const choiceStyle = (selected: boolean) => [
    styles.choice,
    {
      backgroundColor: selected ? theme.colors.chip : theme.colors.surface,
      borderColor: selected ? theme.colors.primary : theme.colors.border,
    },
  ];

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <ScreenTitle
            title={existing ? 'Edit learning item' : 'Add learning item'}
            subtitle="Save a course, book, tutorial, skill, or roadmap."
            onBack={navigation.goBack}
          />
          {formError ? <Notice warning>{formError}</Notice> : null}
          <FormField
            label="Title"
            placeholder="e.g. MIT mathematics course"
            value={title}
            onChangeText={setTitle}
            autoCapitalize="sentences"
            maxLength={160}
          />
          <Text style={[styles.label, { color: theme.colors.text }]}>Type</Text>
          <View style={styles.choices}>
            {LEARNING_ITEM_TYPES.map((value) => {
              const selected = type === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    selectionHaptic();
                    setType(value);
                  }}
                  style={choiceStyle(selected)}
                >
                  <Text
                    style={{
                      color: selected ? theme.colors.primary : theme.colors.text,
                      fontWeight: '700',
                    }}
                  >
                    {titleCase(value)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <FormField
            label="Provider"
            placeholder="e.g. MIT OpenCourseWare"
            value={provider}
            onChangeText={setProvider}
            autoCapitalize="words"
          />
          <FormField
            label="Source URL"
            placeholder="https://example.com/course"
            value={sourceUrl}
            onChangeText={setSourceUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text style={[styles.label, { color: theme.colors.text }]}>Status</Text>
          <View style={styles.choices}>
            {LEARNING_STATUSES.map((value) => {
              const selected = status === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    selectionHaptic();
                    setStatus(value);
                  }}
                  style={choiceStyle(selected)}
                >
                  <Text
                    style={{
                      color: selected ? theme.colors.primary : theme.colors.text,
                      fontWeight: '700',
                    }}
                  >
                    {titleCase(value)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <FormField
            label="Progress percentage (optional)"
            placeholder="0–100"
            value={progress}
            onChangeText={setProgress}
            keyboardType="number-pad"
            maxLength={3}
          />
          <FormField
            label="Current lesson, chapter, or position"
            placeholder="e.g. Chapter 4: Linear algebra"
            value={currentPosition}
            onChangeText={setCurrentPosition}
          />
          <FormField
            label="Start date (optional)"
            placeholder="YYYY-MM-DD"
            value={startDate}
            onChangeText={setStartDate}
            keyboardType="numbers-and-punctuation"
          />
          <FormField
            label="Target date (optional)"
            placeholder="YYYY-MM-DD"
            value={targetDate}
            onChangeText={setTargetDate}
            keyboardType="numbers-and-punctuation"
          />
          <FormField
            label="Last studied date (optional)"
            placeholder="YYYY-MM-DD"
            value={lastStudiedDate}
            onChangeText={setLastStudiedDate}
            keyboardType="numbers-and-punctuation"
          />
          <FormField
            label="Tags"
            placeholder="math, calculus, self-study"
            value={tags}
            onChangeText={setTags}
            autoCapitalize="none"
          />
          <FormField
            label="Notes"
            placeholder="What do you want to remember?"
            value={notes}
            onChangeText={setNotes}
            multiline
          />
          <ActionButton
            label={existing ? 'Save changes' : 'Create learning item'}
            onPress={save}
          />
          <View style={styles.bottomSpace} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  keyboard: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 22 },
  label: { fontSize: 13, fontWeight: '800', marginBottom: 8 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 17 },
  choice: {
    borderWidth: 1,
    borderRadius: 13,
    minHeight: 38,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  bottomSpace: { height: 18 },
});
