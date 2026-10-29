import { useMemo } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinkedTasks } from '../components/LinkedTasks';
import { ActionButton, Notice, ScreenTitle } from '../components/ui';
import type { LearningSection } from '../domain/learning';
import type { RootStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';
import { useActivity } from '../state/ActivityContext';
import { useLearning } from '../state/LearningContext';
import { useTasks } from '../state/TaskContext';

type Props = NativeStackScreenProps<RootStackParamList, 'LearningDetail'>;

function localDateString(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function LearningDetailScreen({ navigation, route }: Props) {
  const { theme } = useApp();
  const { recordActivity } = useActivity();
  const {
    items,
    sections,
    ready,
    error,
    updateItem,
    updateSection,
    archiveItem,
    deleteItem,
    deleteSection,
  } = useLearning();
  const { tasks } = useTasks();
  const item = items.find(
    (value) => value.id === route.params.learningItemId,
  );
  const itemSections = useMemo(
    () =>
      sections
        .filter((section) => section.learningItemId === item?.id)
        .sort(
          (a, b) =>
            a.position - b.position ||
            a.createdAt.localeCompare(b.createdAt),
        ),
    [item?.id, sections],
  );

  const resume = () => {
    if (!item) return;
    updateItem({
      ...item,
      status: 'in_progress',
      lastStudiedDate: localDateString(),
    });
    recordActivity({
      eventType: 'status_changed',
      sourceType: 'learning_item',
      sourceId: item.id,
      summary: `Resumed learning: ${item.title}`,
    });
  };

  const confirmArchive = () => {
    if (!item) return;
    Alert.alert(
      item.archivedAt ? 'Restore learning item?' : 'Archive learning item?',
      item.archivedAt
        ? `${item.title} will return to your active learning list.`
        : `${item.title} will leave the active list. You can show archived items and restore it later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: item.archivedAt ? 'Restore' : 'Archive',
          onPress: () => {
            if (item.archivedAt) {
              updateItem({ ...item, archivedAt: null });
              recordActivity({
                eventType: 'updated',
                sourceType: 'learning_item',
                sourceId: item.id,
                summary: `Restored learning item: ${item.title}`,
              });
            } else {
              archiveItem(item.id);
              recordActivity({
                eventType: 'archived',
                sourceType: 'learning_item',
                sourceId: item.id,
                summary: `Archived learning item: ${item.title}`,
              });
            }
            navigation.goBack();
          },
        },
      ],
    );
  };

  const confirmDelete = () => {
    if (!item) return;
    if (
      tasks.some(
        (task) =>
          task.source?.type === 'learning_item' &&
          task.source.id === item.id,
      )
    ) {
      Alert.alert(
        'Learning item has linked tasks',
        'Unlink or reassign its tasks before deleting this item. Archiving it will preserve both the item and its task history.',
      );
      return;
    }
    Alert.alert(
      'Delete learning item permanently?',
      `This removes ${item.title} and its sections from this account. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteItem(item.id)
              .then(() => navigation.goBack())
              .catch((deleteError: unknown) => {
                Alert.alert(
                  'Could not delete learning item',
                  deleteError instanceof Error
                    ? deleteError.message
                    : String(deleteError),
                );
              });
          },
        },
      ],
    );
  };

  if (!ready) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.content}>
          <ScreenTitle title="Loading learning item" onBack={navigation.goBack} />
        </View>
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.content}>
          <ScreenTitle title="Learning item not found" onBack={navigation.goBack} />
          <Text style={{ color: theme.colors.muted }}>
            It may have been deleted or is not available on this device.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const childrenByParent = new Map<string | null, LearningSection[]>();
  for (const section of itemSections) {
    const siblings = childrenByParent.get(section.parentSectionId) ?? [];
    siblings.push(section);
    childrenByParent.set(section.parentSectionId, siblings);
  }

  const renderSection = (
    section: LearningSection,
    depth: number,
    seen: Set<string>,
  ): React.ReactNode => {
    if (seen.has(section.id)) return null;
    const nextSeen = new Set(seen);
    nextSeen.add(section.id);
    return (
      <View
        key={section.id}
        style={[
          styles.sectionCard,
          {
            marginLeft: Math.min(depth, 4) * 14,
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <View style={styles.sectionRow}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: section.isCompleted }}
            accessibilityLabel={`${section.isCompleted ? 'Mark incomplete' : 'Mark complete'}: ${section.title}`}
            onPress={() => {
              const isCompleting = !section.isCompleted;
              updateSection({
                ...section,
                isCompleted: isCompleting,
                completedAt: isCompleting ? new Date().toISOString() : null,
              });
              if (isCompleting) {
                recordActivity({
                  eventType: 'completed',
                  sourceType: 'learning_section',
                  sourceId: section.id,
                  summary: `Completed learning section: ${section.title}`,
                  metadata: { learningItemId: item.id },
                });
              }
            }}
            style={styles.sectionToggle}
          >
            <Text
              style={[
                styles.sectionCheck,
                { color: theme.colors.primary },
              ]}
            >
              {section.isCompleted ? '✓' : '○'}
            </Text>
          </Pressable>
          <View style={styles.sectionText}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: section.isCompleted
                    ? theme.colors.muted
                    : theme.colors.text,
                  textDecorationLine: section.isCompleted
                    ? 'line-through'
                    : 'none',
                },
              ]}
            >
              {section.title}
            </Text>
            {section.url ? (
              <Text numberOfLines={1} style={{ color: theme.colors.muted }}>
                {section.url}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add a sub-section under ${section.title}`}
            onPress={() =>
              navigation.navigate('LearningSectionForm', {
                learningItemId: item.id,
                parentSectionId: section.id,
              })
            }
          >
            <Text style={[styles.sectionAction, { color: theme.colors.primary }]}>
              +
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete section ${section.title}`}
            onPress={() =>
              Alert.alert(
                'Delete section?',
                `This also removes any sub-sections under ${section.title}.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => deleteSection(section.id),
                  },
                ],
              )
            }
          >
            <Text style={[styles.sectionDelete, { color: theme.colors.danger }]}>
              ×
            </Text>
          </Pressable>
        </View>
        {(childrenByParent.get(section.id) ?? []).map((child) =>
          renderSection(child, depth + 1, nextSeen),
        )}
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitle
          title={item.title}
          subtitle={`${item.type}${item.provider ? ` · ${item.provider}` : ''}`}
          onBack={navigation.goBack}
        />
        {error ? <Notice warning>{error}</Notice> : null}
        {item.archivedAt ? (
          <Notice warning>This learning item is archived.</Notice>
        ) : null}
        {item.sourceUrl ? (
          <Text style={[styles.url, { color: theme.colors.primary }]}>
            {item.sourceUrl}
          </Text>
        ) : null}
        <View
          style={[
            styles.summary,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.status, { color: theme.colors.primary }]}>
            {item.status.replace('_', ' ')}
          </Text>
          {item.progress !== null ? (
            <Text style={[styles.progress, { color: theme.colors.text }]}>
              {item.progress}% complete
            </Text>
          ) : null}
          {item.currentPosition ? (
            <Text style={[styles.copy, { color: theme.colors.muted }]}>
              Current position: {item.currentPosition}
            </Text>
          ) : null}
          {item.startDate ? (
            <Text style={[styles.copy, { color: theme.colors.muted }]}>
              Started {item.startDate}
            </Text>
          ) : null}
          {item.targetDate ? (
            <Text style={[styles.copy, { color: theme.colors.muted }]}>
              Target date {item.targetDate}
            </Text>
          ) : null}
          {item.lastStudiedDate ? (
            <Text style={[styles.copy, { color: theme.colors.muted }]}>
              Last studied {item.lastStudiedDate}
            </Text>
          ) : null}
          {item.tags.length ? (
            <Text style={[styles.copy, { color: theme.colors.muted }]}>
              Tags: {item.tags.join(', ')}
            </Text>
          ) : null}
          {item.notes ? (
            <Text style={[styles.notes, { color: theme.colors.text }]}>
              {item.notes}
            </Text>
          ) : null}
        </View>
        <LinkedTasks
          source={{ type: 'learning_item', id: item.id }}
          onAddTask={() =>
            navigation.navigate('TaskForm', {
              source: { type: 'learning_item', id: item.id },
            })
          }
        />
        {!item.archivedAt && item.status !== 'completed' ? (
          <ActionButton
            label={item.status === 'in_progress' ? 'Resume learning' : 'Start learning'}
            onPress={resume}
            style={styles.button}
          />
        ) : null}
        <ActionButton
          label="Edit learning item"
          secondary
          onPress={() =>
            navigation.navigate('LearningForm', {
              learningItemId: item.id,
            })
          }
          style={styles.button}
        />
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderCopy}>
            <Text style={[styles.heading, { color: theme.colors.text }]}>
              Sections and checkpoints
            </Text>
            <Text style={[styles.copy, { color: theme.colors.muted }]}>
              {itemSections.length} {itemSections.length === 1 ? 'section' : 'sections'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              navigation.navigate('LearningSectionForm', {
                learningItemId: item.id,
              })
            }
          >
            <Text style={[styles.link, { color: theme.colors.primary }]}>
              Add section
            </Text>
          </Pressable>
        </View>
        {itemSections.length ? (
          (childrenByParent.get(null) ?? []).map((section) =>
            renderSection(section, 0, new Set()),
          )
        ) : (
          <Text style={[styles.copy, { color: theme.colors.muted }]}>
            Add lessons, chapters, or checkpoints to make the next step easy to resume.
          </Text>
        )}
        {item.archivedAt ? (
          <ActionButton
            label="Restore from archive"
            secondary
            onPress={confirmArchive}
            style={styles.button}
          />
        ) : (
          <ActionButton
            label="Archive learning item"
            secondary
            onPress={confirmArchive}
            style={styles.button}
          />
        )}
        <ActionButton
          label="Delete permanently"
          danger
          onPress={confirmDelete}
          style={styles.button}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 34 },
  url: { fontSize: 14, marginBottom: 13 },
  summary: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 8 },
  status: { fontSize: 13, fontWeight: '900', textTransform: 'capitalize' },
  progress: { fontSize: 21, fontWeight: '900' },
  copy: { fontSize: 14, lineHeight: 20 },
  notes: { fontSize: 15, lineHeight: 22, marginTop: 4 },
  button: { marginTop: 10 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 25,
    marginBottom: 10,
  },
  sectionHeaderCopy: { flex: 1, gap: 3 },
  heading: { fontSize: 18, fontWeight: '900' },
  link: { fontSize: 14, fontWeight: '900' },
  sectionCard: { borderWidth: 1, borderRadius: 14, padding: 10, marginBottom: 8 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionToggle: { minWidth: 30, minHeight: 38, justifyContent: 'center' },
  sectionCheck: { fontSize: 22, fontWeight: '900' },
  sectionText: { flex: 1, gap: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '800' },
  sectionAction: { paddingHorizontal: 7, fontSize: 24, fontWeight: '700' },
  sectionDelete: { paddingHorizontal: 7, fontSize: 24, fontWeight: '700' },
});
