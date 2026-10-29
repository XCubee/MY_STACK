import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActionButton, Notice, ScreenTitle } from '../components/ui';
import {
  LEARNING_ITEM_TYPES,
  type LearningItem,
  type LearningItemType,
  type LearningStatus,
} from '../domain/learning';
import type { RootStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';
import { useActivity } from '../state/ActivityContext';
import { useLearning } from '../state/LearningContext';
import { selectionHaptic } from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Learning'>;

const statuses: ('all' | LearningStatus)[] = [
  'all',
  'planned',
  'in_progress',
  'paused',
  'completed',
];

function localDateString(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatStatus(status: LearningStatus): string {
  return status.replace('_', ' ');
}

function formatType(type: LearningItemType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function LearningCard({
  item,
  onOpen,
  onResume,
}: {
  item: LearningItem;
  onOpen: () => void;
  onResume: () => void;
}) {
  const { theme } = useApp();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        onPress={onOpen}
        style={styles.cardMain}
      >
        <View style={styles.cardTop}>
          <Text style={[styles.type, { color: theme.colors.primary }]}>
            {formatType(item.type)}
            {item.provider ? `  ·  ${item.provider}` : ''}
          </Text>
          <Text style={[styles.status, { color: theme.colors.muted }]}>
            {formatStatus(item.status)}
          </Text>
        </View>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
          {item.title}
        </Text>
        {item.currentPosition ? (
          <Text
            numberOfLines={1}
            style={[styles.position, { color: theme.colors.muted }]}
          >
            Current position: {item.currentPosition}
          </Text>
        ) : null}
        {item.progress !== null ? (
          <View style={styles.progressRow}>
            <View
              style={[
                styles.progressTrack,
                { backgroundColor: theme.colors.surfaceRaised },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${item.progress}%`,
                    backgroundColor: theme.colors.primary,
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: theme.colors.muted }]}>
              {item.progress}%
            </Text>
          </View>
        ) : null}
        {item.targetDate ? (
          <Text style={[styles.target, { color: theme.colors.muted }]}>
            Target: {item.targetDate}
          </Text>
        ) : null}
      </Pressable>
      {item.status !== 'completed' ? (
        <ActionButton
          label={item.status === 'in_progress' ? 'Resume learning' : 'Start learning'}
          secondary
          onPress={onResume}
          style={styles.resumeButton}
        />
      ) : null}
    </View>
  );
}

export function LearningScreen({ navigation }: Props) {
  const { theme } = useApp();
  const { recordActivity } = useActivity();
  const {
    items,
    ready,
    error,
    updateItem,
    retrySync,
  } = useLearning();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LearningStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | LearningItemType>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [sortByTarget, setSortByTarget] = useState(false);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return items
      .filter((item) => showArchived || item.archivedAt === null)
      .filter((item) => statusFilter === 'all' || item.status === statusFilter)
      .filter((item) => typeFilter === 'all' || item.type === typeFilter)
      .filter(
        (item) =>
          !search ||
          [
            item.title,
            item.provider,
            item.currentPosition,
            item.notes,
            item.type,
            ...item.tags,
          ]
            .join(' ')
            .toLowerCase()
            .includes(search),
      )
      .sort((a, b) =>
        sortByTarget
          ? (a.targetDate ?? '9999-12-31').localeCompare(
              b.targetDate ?? '9999-12-31',
            )
          : b.updatedAt.localeCompare(a.updatedAt),
      );
  }, [items, query, showArchived, sortByTarget, statusFilter, typeFilter]);

  const resume = (item: LearningItem) => {
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

  if (!ready) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.content}>
          <ScreenTitle title="Loading learning" onBack={navigation.goBack} />
          <Text style={{ color: theme.colors.muted }}>
            Loading your saved items from this device and account.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <ScreenTitle
              title="Learning"
              subtitle="Keep your courses, skills, and reading moving."
              onBack={navigation.goBack}
            />
            <TextInput
              accessibilityLabel="Search learning items"
              placeholder="Search title, provider, notes, or tags"
              placeholderTextColor={theme.colors.muted}
              value={query}
              onChangeText={setQuery}
              style={[
                styles.search,
                {
                  color: theme.colors.text,
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            />
            {error ? (
              <View>
                <Notice warning>{error}</Notice>
                <ActionButton
                  label="Retry learning sync"
                  secondary
                  onPress={() => void retrySync()}
                  style={styles.retryButton}
                />
              </View>
            ) : null}
            <Text style={[styles.filterLabel, { color: theme.colors.muted }]}>
              STATUS
            </Text>
            <View style={styles.chips}>
              {statuses.map((status) => {
                const selected = statusFilter === status;
                return (
                  <Pressable
                    key={status}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      selectionHaptic();
                      setStatusFilter(status);
                    }}
                    style={[
                      styles.chip,
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
                    <Text
                      style={{
                        color: selected ? theme.colors.primary : theme.colors.text,
                        fontWeight: '700',
                      }}
                    >
                      {status === 'all' ? 'All' : formatStatus(status)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.filterLabel, { color: theme.colors.muted }]}>
              TYPE
            </Text>
            <View style={styles.chips}>
              {(['all', ...LEARNING_ITEM_TYPES] as const).map((type) => {
                const selected = typeFilter === type;
                return (
                  <Pressable
                    key={type}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      selectionHaptic();
                      setTypeFilter(type);
                    }}
                    style={[
                      styles.chip,
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
                    <Text
                      style={{
                        color: selected ? theme.colors.primary : theme.colors.text,
                        fontWeight: '700',
                      }}
                    >
                      {type === 'all' ? 'All types' : formatType(type)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.listHeading}>
              <Text style={[styles.count, { color: theme.colors.muted }]}>
                {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSortByTarget((value) => !value)}
              >
                <Text style={[styles.link, { color: theme.colors.primary }]}>
                  {sortByTarget ? 'Sort: target date' : 'Sort: recently updated'}
                </Text>
              </Pressable>
            </View>
            <View style={styles.actions}>
              <ActionButton
                label={showArchived ? 'Hide archived' : 'Show archived'}
                secondary
                onPress={() => setShowArchived((value) => !value)}
                style={styles.action}
              />
              <ActionButton
                label="Add learning item"
                onPress={() => navigation.navigate('LearningForm', undefined)}
                style={styles.action}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          <View
            style={[
              styles.empty,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              {ready ? 'No learning items here yet' : 'Loading learning'}
            </Text>
            <Text style={[styles.emptyCopy, { color: theme.colors.muted }]}>
              {ready
                ? 'Add a course, book, tutorial, or skill to start tracking your progress.'
                : 'Your saved learning items will appear here.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <LearningCard
            item={item}
            onOpen={() =>
              navigation.navigate('LearningDetail', {
                learningItemId: item.id,
              })
            }
            onResume={() => resume(item)}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28 },
  search: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    marginBottom: 14,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    minHeight: 36,
    justifyContent: 'center',
  },
  listHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  count: { fontSize: 13, fontWeight: '700' },
  link: { fontSize: 13, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  action: { flex: 1, minHeight: 46, paddingHorizontal: 8 },
  retryButton: { marginTop: -7, marginBottom: 12 },
  card: {
    borderWidth: 1,
    borderRadius: 17,
    padding: 15,
    marginBottom: 11,
  },
  cardMain: { gap: 7 },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  type: { fontSize: 12, fontWeight: '900', textTransform: 'capitalize' },
  status: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  cardTitle: { fontSize: 18, fontWeight: '900', lineHeight: 23 },
  position: { fontSize: 13 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTrack: { height: 7, borderRadius: 5, flex: 1, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5 },
  progressText: { fontSize: 12, fontWeight: '800', minWidth: 34 },
  target: { fontSize: 12 },
  resumeButton: { minHeight: 43, marginTop: 12 },
  empty: { borderWidth: 1, borderRadius: 17, padding: 18 },
  emptyTitle: { fontSize: 17, fontWeight: '900' },
  emptyCopy: { fontSize: 14, lineHeight: 20, marginTop: 6 },
});
