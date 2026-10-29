import { useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinkedTasks } from '../components/LinkedTasks';
import { ActionButton, Notice, ScreenTitle } from '../components/ui';
import { ToolLogo } from '../components/ToolLogo';
import {
  appearanceForCategory,
  normalizeWebUrl,
} from '../domain/tool';
import type { RootStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';
import { useTasks } from '../state/TaskContext';
import {
  lightImpactHaptic,
  mediumImpactHaptic,
  selectionHaptic,
} from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'ToolDetail'>;

export function ToolDetailScreen({ navigation, route }: Props) {
  const { tools, theme, toggleFavorite, deleteTool } = useApp();
  const { tasks } = useTasks();
  const tool = tools.find((item) => item.id === route.params.toolId);
  const [actionError, setActionError] = useState('');

  if (!tool) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.content}>
          <ScreenTitle title="Tool not found" onBack={navigation.goBack} />
          <Text style={{ color: theme.colors.muted }}>
            This tool may have been deleted.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const openWebsite = async (value: string) => {
    const url = normalizeWebUrl(value);
    if (!url) {
      setActionError('This link is not a valid website.');
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      setActionError('Could not open this link on your device.');
    }
  };

  const copyLink = async (value: string) => {
    const url = normalizeWebUrl(value);
    if (!url) {
      setActionError('This link is not a valid website.');
      return;
    }
    try {
      await Clipboard.setStringAsync(url);
      setActionError('Link copied to clipboard.');
    } catch {
      setActionError('Could not copy this link.');
    }
  };

  const confirmDelete = () => {
    if (
      tasks.some(
        (task) =>
          task.source?.type === 'tool' && task.source.id === tool.id,
      )
    ) {
      Alert.alert(
        'Tool has linked tasks',
        'Unlink or reassign its tasks before deleting this tool.',
      );
      return;
    }
    Alert.alert('Delete tool?', `Remove ${tool.name} from your library?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          mediumImpactHaptic();
          deleteTool(tool.id);
          navigation.goBack();
        },
      },
    ]);
  };

  const appearance = appearanceForCategory(tool.category);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle
          title="Tool details"
          subtitle={tool.category}
          onBack={navigation.goBack}
        />
        {actionError ? (
          <Notice warning={actionError.startsWith('Could not') || actionError.startsWith('This link')}>
            {actionError}
          </Notice>
        ) : null}
        <View style={styles.hero}>
          <ToolLogo
            name={tool.name}
            url={tool.url}
            size={72}
            accent={appearance.accent}
          />
          <Text style={[styles.name, { color: theme.colors.text }]}>
            {tool.name}
          </Text>
          <Text style={[styles.description, { color: theme.colors.muted }]}>
            {tool.description}
          </Text>
        </View>

        <View style={styles.actions}>
          <ActionButton
            label="Open website"
            onPress={() => void openWebsite(tool.url)}
            style={styles.action}
          />
          <ActionButton
            label={tool.isFavorite ? '★  Favorited' : '☆  Favorite'}
            secondary
            onPress={() => toggleFavorite(tool.id)}
            style={styles.action}
          />
        </View>
        <ActionButton
          label="Copy website link"
          secondary
          onPress={() => void copyLink(tool.url)}
        />

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Website
        </Text>
        <Text selectable style={[styles.value, { color: theme.colors.primary }]}>
          {tool.url}
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Tags
        </Text>
        <View style={styles.tags}>
          {tool.tags.length > 0 ? (
            tool.tags.map((tag) => (
              <View
                key={tag}
                style={[
                  styles.tag,
                  { backgroundColor: theme.colors.chip },
                ]}
              >
                <Text style={{ color: theme.colors.text }}>{tag}</Text>
              </View>
            ))
          ) : (
            <Text style={{ color: theme.colors.muted }}>No tags</Text>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Notes
        </Text>
        <Text style={[styles.value, { color: theme.colors.muted }]}>
          {tool.notes || 'No notes yet.'}
        </Text>
        <LinkedTasks
          source={{ type: 'tool', id: tool.id }}
          onAddTask={() =>
            navigation.navigate('TaskForm', {
              source: { type: 'tool', id: tool.id },
            })
          }
        />

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Project links
        </Text>
        {tool.projectLinks.length > 0 ? (
          tool.projectLinks.map((link) => (
            <View key={link} style={styles.projectLink}>
              <Pressable
                accessibilityRole="link"
                onPress={() => {
                  selectionHaptic();
                  void openWebsite(link);
                }}
                style={styles.projectLabel}
              >
                <Text
                  numberOfLines={2}
                  style={{ color: theme.colors.primary, lineHeight: 20 }}
                >
                  {link}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Copy ${link}`}
                onPress={() => {
                  lightImpactHaptic();
                  void copyLink(link);
                }}
                style={styles.copyButton}
              >
                <Text style={{ color: theme.colors.muted }}>Copy</Text>
              </Pressable>
            </View>
          ))
        ) : (
          <Text style={{ color: theme.colors.muted }}>No project links.</Text>
        )}

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Vault preview · Demo only
        </Text>
        <Notice warning>
          Demonstration panel only. Do not enter or store real passwords, API
          keys, or tokens here.
        </Notice>

        <View style={styles.actions}>
          <ActionButton
            label="Edit tool"
            secondary
            onPress={() =>
              navigation.navigate('ToolForm', { toolId: tool.id })
            }
            style={styles.action}
          />
          <ActionButton
            label="Delete"
            danger
            onPress={confirmDelete}
            style={styles.action}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 9, paddingBottom: 32 },
  hero: { alignItems: 'center', paddingVertical: 10, paddingBottom: 22 },
  name: { fontSize: 23, fontWeight: '900', textAlign: 'center' },
  description: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6,
  },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  action: { flex: 1 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 20,
    marginBottom: 9,
  },
  value: { fontSize: 15, lineHeight: 22 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderRadius: 16, paddingVertical: 6, paddingHorizontal: 11 },
  projectLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  projectLabel: { flex: 1 },
  copyButton: { paddingVertical: 10, paddingLeft: 12 },
});
