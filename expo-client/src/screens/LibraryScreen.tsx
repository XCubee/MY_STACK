import { useMemo, useState } from 'react';
import {
  Pressable,
  SectionList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { ToolCard } from '../components/ToolCard';
import { ActionButton, Notice, ScreenTitle } from '../components/ui';
import { appearanceForCategory, TOOL_CATEGORIES } from '../domain/tool';
import type { RootStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';
import { selectionHaptic } from '../utils/haptics';

export function LibraryScreen() {
  const { tools, theme, toggleFavorite, syncStatus, syncMessage } = useApp();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return tools.filter((tool) => {
      const categoryMatches = !category || tool.category === category;
      const searchMatches =
        !search ||
        [
          tool.name,
          tool.description,
          tool.category,
          tool.url,
          ...tool.tags,
        ]
          .join(' ')
          .toLowerCase()
          .includes(search);
      return categoryMatches && searchMatches;
    });
  }, [category, query, tools]);
  const sections = useMemo(
    () =>
      TOOL_CATEGORIES.map((title) => ({
        title,
        data: filtered.filter((tool) => tool.category === title),
      })).filter((section) => section.data.length > 0),
    [filtered],
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <SectionList
        sections={sections}
        keyExtractor={(tool) => tool.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <ScreenTitle
              title="My Stack"
              subtitle={`${tools.length} ${tools.length === 1 ? 'tool' : 'tools'} in your library`}
            />
            {syncStatus === 'error' ? (
              <Notice warning>{syncMessage}</Notice>
            ) : null}
            <TextInput
              accessibilityLabel="Search tools"
              placeholder="Search tools, tags, websites…"
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
              returnKeyType="search"
            />
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
                          ? appearanceForCategory(
                              item === 'All' ? 'Hosting' : item,
                            ).accent
                          : theme.colors.surface,
                        borderColor: selected
                          ? appearanceForCategory(
                              item === 'All' ? 'Hosting' : item,
                            ).accent
                          : theme.colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: selected
                          ? appearanceForCategory(
                              item === 'All' ? 'Hosting' : item,
                            ).foreground
                          : theme.colors.text,
                        fontWeight: '700',
                      }}
                    >
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.resultsHeading}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {category ? `${category} tools` : 'Your collection'}
              </Text>
              <Text style={{ color: theme.colors.muted }}>
                {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              Nothing here yet
            </Text>
            <Text style={[styles.emptyCopy, { color: theme.colors.muted }]}>
              Try another search or add a tool to your library.
            </Text>
          </View>
        }
        renderSectionHeader={({ section }) => {
          const appearance = appearanceForCategory(section.title);
          return (
            <View style={styles.sectionHeader}>
              <LinearGradient
                colors={appearance.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sectionAccent}
              />
              <Text
                style={[styles.sectionName, { color: theme.colors.text }]}
              >
                {section.title}
              </Text>
              <Text style={[styles.sectionCount, { color: theme.colors.muted }]}>
                {section.data.length}
              </Text>
            </View>
          );
        }}
        renderItem={({ item, index }) => (
          <ToolCard
            tool={item}
            animationIndex={index}
            onPress={() =>
              navigation.navigate('ToolDetail', { toolId: item.id })
            }
            onToggleFavorite={() => toggleFavorite(item.id)}
          />
        )}
        ListFooterComponent={<View style={{ height: 96 }} />}
      />
      <View style={styles.addButton}>
        <ActionButton
          label="+  Add a tool"
          onPress={() => navigation.navigate('ToolForm', undefined)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  search: {
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 50,
    paddingHorizontal: 15,
    fontSize: 15,
    marginBottom: 13,
  },
  categories: {
    gap: 8,
    paddingBottom: 15,
  },
  categoryChip: {
    minHeight: 38,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 20,
  },
  resultsHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    marginBottom: 9,
  },
  sectionAccent: {
    width: 4,
    height: 18,
    borderRadius: 2,
    marginRight: 9,
  },
  sectionName: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
    flex: 1,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  empty: {
    paddingVertical: 42,
    alignItems: 'center',
  },
  emptyTitle: {
    fontWeight: '800',
    fontSize: 18,
  },
  emptyCopy: {
    textAlign: 'center',
    fontSize: 14,
    marginTop: 8,
  },
  addButton: {
    position: 'absolute',
    bottom: 18,
    left: 24,
    right: 24,
  },
});
