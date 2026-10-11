import {
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { ToolCard } from '../components/ToolCard';
import { ScreenTitle } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';

export function FavoritesScreen() {
  const { tools, theme, toggleFavorite } = useApp();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const favorites = tools.filter((tool) => tool.isFavorite);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <FlatList
        data={favorites}
        keyExtractor={(tool) => tool.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <ScreenTitle
            title="Favorites"
            subtitle="Your go-to tools, all in one place."
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              No favorites yet
            </Text>
            <Text style={[styles.emptyCopy, { color: theme.colors.muted }]}>
              Tap the star on a tool to keep it close.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ToolCard
            tool={item}
            onPress={() =>
              navigation.navigate('ToolDetail', { toolId: item.id })
            }
            onToggleFavorite={() => toggleFavorite(item.id)}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },
  empty: { paddingVertical: 48, alignItems: 'center' },
  emptyTitle: { fontWeight: '800', fontSize: 18 },
  emptyCopy: { textAlign: 'center', fontSize: 14, marginTop: 8 },
});
