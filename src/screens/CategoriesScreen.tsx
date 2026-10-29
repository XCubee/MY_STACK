import { useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { ToolCard } from '../components/ToolCard';
import { ScreenTitle } from '../components/ui';
import { appearanceForCategory, TOOL_CATEGORIES } from '../domain/tool';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';
import { selectionHaptic } from '../utils/haptics';

const categoryIcons: Record<string, string> = {
  All: '▦',
  AI: '✦',
  Code: '</>',
  Hosting: '◈',
  Database: '▤',
  Design: '◌',
  Productivity: '▣',
  API: '⌘',
  Monitoring: '◉',
  Other: '◇',
};

export function CategoriesScreen() {
  const { tools, theme, toggleFavorite } = useApp();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const stackNavigation =
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const listOffset = useRef(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const categories = ['All', ...TOOL_CATEGORIES, 'Other'];
  const selectCategory = (category: string) => {
    selectionHaptic();
    setSelectedCategory(category === 'All' ? null : category);
    scrollRef.current?.scrollTo({
      y: Math.max(0, listOffset.current - 12),
      animated: true,
    });
  };
  const filteredTools = useMemo(() => {
    const search = query.trim().toLowerCase();
    return tools.filter((tool) => {
      const matchesCategory =
        !selectedCategory ||
        selectedCategory === 'All' ||
        tool.category === selectedCategory;
      const matchesQuery =
        !search ||
        [tool.name, tool.description, tool.category, ...tool.tags]
          .join(' ')
          .toLowerCase()
          .includes(search);
      return matchesCategory && matchesQuery;
    });
  }, [query, selectedCategory, tools]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenTitle
          title="Categories"
          subtitle="Browse tools by what you use them for."
        />
        <TextInput
          accessibilityLabel="Search categories and tools"
          placeholder="Search categories or tools..."
          placeholderTextColor={theme.colors.muted}
          value={query}
          onChangeText={setQuery}
          style={[
            styles.search,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              color: theme.colors.text,
            },
          ]}
        />
        <View style={styles.grid}>
          {categories.map((category) => {
            const count =
              category === 'All'
                ? tools.length
                : tools.filter((tool) => tool.category === category).length;
            const active =
              selectedCategory === category ||
              (selectedCategory === null && category === 'All');
            const accent =
              category === 'All'
                ? theme.colors.primary
                : appearanceForCategory(category).accent;
            return (
              <Pressable
                key={category}
                accessibilityRole="button"
                accessibilityLabel={`${category === 'All' ? 'All Tools' : category}, ${count} ${count === 1 ? 'tool' : 'tools'}`}
                accessibilityHint="Filters the tools below to this category"
                accessibilityState={{ selected: active }}
                onPress={() => selectCategory(category)}
                android_ripple={{ color: `${accent}35` }}
                style={({ pressed }) => [
                  styles.categoryCard,
                  {
                    backgroundColor: active ? accent : theme.colors.surface,
                    borderColor: accent,
                    opacity: pressed ? 0.86 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
              >
                <View style={styles.categoryTop}>
                  <View
                    style={[
                      styles.iconBox,
                      {
                        backgroundColor: active
                          ? theme.colors.onPrimary
                          : `${accent}24`,
                      },
                    ]}
                  >
                    <Text style={[styles.categoryIcon, { color: accent }]}>
                      {categoryIcons[category] ?? '◇'}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.chevron,
                      {
                        color: active ? theme.colors.onPrimary : accent,
                      },
                    ]}
                  >
                    ›
                  </Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.categoryName,
                    {
                      color: active
                        ? theme.colors.onPrimary
                        : theme.colors.text,
                    },
                  ]}
                >
                  {category === 'All' ? 'All Tools' : category}
                </Text>
                <Text
                  style={[
                    styles.categoryCount,
                    {
                      color: active
                        ? theme.colors.onPrimary
                        : theme.colors.muted,
                    },
                  ]}
                >
                  {count} {count === 1 ? 'tool' : 'tools'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View
          onLayout={(event) => {
            listOffset.current = event.nativeEvent.layout.y;
          }}
          style={styles.listHeader}
        >
          <View>
            <Text style={[styles.listTitle, { color: theme.colors.text }]}>
              {selectedCategory ?? 'All'} tools
            </Text>
            <Text style={[styles.listSubtitle, { color: theme.colors.muted }]}>
              {filteredTools.length} saved in your stack
            </Text>
          </View>
          {selectedCategory ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.reset, { color: theme.colors.primary }]}>
                Clear
              </Text>
            </Pressable>
          ) : null}
        </View>
        {filteredTools.length ? (
          filteredTools.map((tool, index) => (
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
            <Text style={[styles.emptyText, { color: theme.colors.muted }]}>
              No tools found in this category yet.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 9, paddingBottom: 24 },
  search: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 15,
    fontSize: 14,
    marginBottom: 14,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  categoryCard: {
    width: '48.5%',
    minHeight: 114,
    borderWidth: 1,
    borderRadius: 17,
    padding: 13,
  },
  categoryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIcon: { fontWeight: '900', fontSize: 16 },
  chevron: { fontSize: 22, lineHeight: 24 },
  categoryName: { fontSize: 14, fontWeight: '900' },
  categoryCount: { fontSize: 12, marginTop: 3 },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 23,
    marginBottom: 12,
  },
  listTitle: { fontSize: 19, fontWeight: '900' },
  listSubtitle: { fontSize: 12, marginTop: 3 },
  reset: { fontSize: 13, fontWeight: '800' },
  empty: { borderWidth: 1, borderRadius: 16, padding: 18 },
  emptyText: { fontSize: 13 },
});
