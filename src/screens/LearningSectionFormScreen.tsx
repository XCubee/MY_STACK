import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActionButton, FormField, Notice, ScreenTitle } from '../components/ui';
import { normalizeWebUrl } from '../domain/tool';
import type { RootStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';
import { useActivity } from '../state/ActivityContext';
import { useLearning } from '../state/LearningContext';

type Props = NativeStackScreenProps<RootStackParamList, 'LearningSectionForm'>;

export function LearningSectionFormScreen({ navigation, route }: Props) {
  const { theme } = useApp();
  const { recordActivity } = useActivity();
  const { items, sections, addSection, updateSection } = useLearning();
  const { learningItemId, parentSectionId, sectionId } = route.params;
  const item = items.find((value) => value.id === learningItemId);
  const existing = sectionId
    ? sections.find((section) => section.id === sectionId)
    : undefined;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [url, setUrl] = useState(existing?.url ?? '');
  const [formError, setFormError] = useState('');

  if (!item || (sectionId && !existing)) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.content}>
          <ScreenTitle title="Section not found" onBack={navigation.goBack} />
          <Text style={{ color: theme.colors.muted }}>
            Return to the learning item and try again.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const save = () => {
    const cleanTitle = title.trim();
    const normalizedUrl = url.trim() ? normalizeWebUrl(url) : '';
    if (!cleanTitle) {
      setFormError('Enter a title for this section.');
      return;
    }
    if (url.trim() && !normalizedUrl) {
      setFormError('Enter a valid http or https URL.');
      return;
    }
    setFormError('');
    const cleanUrl = normalizedUrl ?? '';

    if (existing) {
      updateSection({ ...existing, title: cleanTitle, url: cleanUrl });
      recordActivity({
        eventType: 'updated',
        sourceType: 'learning_section',
        sourceId: existing.id,
        summary: `Updated learning section: ${cleanTitle}`,
        metadata: { learningItemId },
      });
    } else {
      const created = addSection({
        learningItemId,
        parentSectionId: parentSectionId ?? null,
        title: cleanTitle,
        position: sections.filter(
          (section) =>
            section.learningItemId === learningItemId &&
            section.parentSectionId === (parentSectionId ?? null),
        ).length,
        isCompleted: false,
        url: cleanUrl,
      });
      recordActivity({
        eventType: 'created',
        sourceType: 'learning_section',
        sourceId: created.id,
        summary: `Added learning section: ${cleanTitle}`,
        metadata: { learningItemId },
      });
    }
    navigation.goBack();
  };

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
            title={existing ? 'Edit section' : 'Add section'}
            subtitle={item.title}
            onBack={navigation.goBack}
          />
          {formError ? <Notice warning>{formError}</Notice> : null}
          <FormField
            label="Section, lesson, or checkpoint"
            placeholder="e.g. Week 1: Foundations"
            value={title}
            onChangeText={setTitle}
            maxLength={160}
          />
          <FormField
            label="Optional URL"
            placeholder="https://example.com/lesson"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <ActionButton
            label={existing ? 'Save section' : 'Add section'}
            onPress={save}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  keyboard: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 22 },
});
