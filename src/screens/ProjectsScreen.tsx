import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { ToolCard } from '../components/ToolCard';
import { TOOL_CATEGORIES } from '../domain/tool';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';
import { selectionHaptic } from '../utils/haptics';

type ProjectFilter = 'Tools' | 'Notes' | 'Links' | 'Favorites';

export function ProjectsScreen() {
  const { tools, theme, toggleFavorite, currentUser, profile } = useApp();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const stackNavigation =
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const [filter, setFilter] = useState<ProjectFilter>('Tools');
  const [category, setCategory] = useState<string | null>(null);

  const visibleTools = useMemo(() => {
    const matched = tools.filter((tool) => {
      if (filter === 'Notes' && !tool.notes.trim()) return false;
      if (filter === 'Links' && tool.projectLinks.length === 0) return false;
      if (filter === 'Favorites' && !tool.isFavorite) return false;
      return !category || tool.category === category;
    });
    return matched;
  }, [category, filter, tools]);
  const filters: { label: ProjectFilter; count: number }[] = [
    { label: 'Tools', count: tools.length },
    { label: 'Notes', count: tools.filter((tool) => tool.notes.trim()).length },
    {
      label: 'Links',
      count: tools.filter((tool) => tool.projectLinks.length).length,
    },
    { label: 'Favorites', count: tools.filter((tool) => tool.isFavorite).length },
  ];
  const initial =
    profile?.display_name?.charAt(0).toUpperCase() ??
    currentUser?.email?.charAt(0).toUpperCase() ??
    'P';

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topline}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go to dashboard"
            onPress={() => navigation.navigate('Dashboard')}
            style={[styles.back, { backgroundColor: theme.colors.surface }]}
          >
            <Text style={[styles.backText, { color: theme.colors.text }]}>‹</Text>
          </Pressable>
          <Text style={[styles.toplineLabel, { color: theme.colors.muted }]}>
            PERSONAL WORKSPACE
          </Text>
          <Text style={[styles.more, { color: theme.colors.muted }]}>•••</Text>
        </View>

        <View style={styles.projectHero}>
          <View style={[styles.projectIcon, { backgroundColor: theme.colors.chip }]}>
            <Text style={[styles.projectIconText, { color: theme.colors.primary }]}>
              ▣
            </Text>
          </View>
          <Text style={[styles.projectTitle, { color: theme.colors.text }]}>
            Personal Project
          </Text>
          <Text style={[styles.projectSubtitle, { color: theme.colors.muted }]}>
            Your tools, notes and resources in one workspace
          </Text>
        </View>

        <View style={styles.stats}>
          <ProjectStat label="Tools" value={tools.length} theme={theme} />
          <ProjectStat
            label="Notes"
            value={tools.filter((tool) => tool.notes.trim()).length}
            theme={theme}
          />
          <ProjectStat
            label="Links"
            value={tools.reduce((sum, tool) => sum + tool.projectLinks.length, 0)}
            theme={theme}
          />
          <ProjectStat
            label="Members"
            value={currentUser ? 1 : 0}
            theme={theme}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {filters.map((item) => {
            const selected = filter === item.label;
            return (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  selectionHaptic();
                  setFilter(item.label);
                }}
                style={[
                  styles.filterChip,
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
                  style={[
                    styles.filterText,
                    {
                      color: selected
                        ? theme.colors.onPrimary
                        : theme.colors.text,
                    },
                  ]}
                >
                  {item.label}
                </Text>
                <Text
                  style={[
                    styles.filterCount,
                    {
                      color: selected
                        ? theme.colors.onPrimary
                        : theme.colors.muted,
                    },
                  ]}
                >
                  {item.count}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            {filter} ({visibleTools.length})
          </Text>
          <View style={[styles.ownerBadge, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.ownerInitial, { color: theme.colors.primary }]}>
              {initial}
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
        >
          {['All', ...TOOL_CATEGORIES].map((item) => {
            const selected =
              item === 'All' ? category === null : category === item;
            return (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  selectionHaptic();
                  setCategory(item === 'All' ? null : item);
                }}
                style={[
                  styles.categoryChip,
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
                  style={[
                    styles.categoryText,
                    {
                      color: selected
                        ? theme.colors.onPrimary
                        : theme.colors.text,
                    },
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {visibleTools.length ? (
          visibleTools.map((tool, index) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              animationIndex={index}
              onPress={() =>
                stackNavigation?.navigate('ToolDetail', { toolId: tool.id })
              }
              onToggleFavorite={() => toggleFavorite(tool.id)}
            />
          ))
        ) : (
          <View
            style={[
              styles.empty,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              Nothing here yet
            </Text>
            <Text style={[styles.emptyText, { color: theme.colors.muted }]}>
              Tools, notes and resource links you save will appear in this
              workspace.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ProjectStat({
  label,
  value,
  theme,
}: {
  label: string;
  value: number;
  theme: ReturnType<typeof useApp>['theme'];
}) {
  return (
    <View
      style={[
        styles.stat,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Text style={[styles.statNumber, { color: theme.colors.text }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: theme.colors.muted }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24 },
  topline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {
    width: 37,
    height: 37,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontSize: 25, lineHeight: 27 },
  toplineLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  more: { fontSize: 17, fontWeight: '900', paddingHorizontal: 5 },
  projectHero: { alignItems: 'center', marginTop: 14, marginBottom: 16 },
  projectIcon: {
    width: 53,
    height: 53,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectIconText: { fontSize: 24, fontWeight: '900' },
  projectTitle: { fontSize: 19, fontWeight: '900', marginTop: 8 },
  projectSubtitle: { fontSize: 12, marginTop: 4, textAlign: 'center' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
  },
  statNumber: { fontSize: 16, fontWeight: '900' },
  statLabel: { fontSize: 10, marginTop: 3 },
  filterRow: { gap: 7, paddingTop: 14, paddingBottom: 12 },
  filterChip: {
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  filterText: { fontSize: 11, fontWeight: '800' },
  filterCount: { fontSize: 10 },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '900' },
  ownerBadge: {
    width: 25,
    height: 25,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerInitial: { fontSize: 11, fontWeight: '900' },
  categories: { gap: 7, paddingBottom: 12 },
  categoryChip: {
    minHeight: 31,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderRadius: 11,
    justifyContent: 'center',
  },
  categoryText: { fontSize: 10, fontWeight: '800' },
  empty: { borderWidth: 1, borderRadius: 16, padding: 16 },
  emptyTitle: { fontSize: 14, fontWeight: '900' },
  emptyText: { fontSize: 12, lineHeight: 18, marginTop: 5 },
});
