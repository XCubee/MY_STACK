import { useState } from 'react';
import {
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActionButton,
  FormField,
  Notice,
  ScreenTitle,
} from '../components/ui';
import {
  DEFAULT_TOOL_COLOR,
  appearanceForCategory,
  normalizeWebUrl,
  TOOL_CATEGORIES,
  type Tool,
} from '../domain/tool';
import type { RootStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';
import { lightImpactHaptic, selectionHaptic } from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'ToolForm'>;
type FieldName = 'name' | 'url' | 'description' | 'projectLinks';

export function ToolFormScreen({ navigation, route }: Props) {
  const { tools, theme, addTool, updateTool } = useApp();
  const existing = route.params?.toolId
    ? tools.find((tool) => tool.id === route.params?.toolId)
    : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [url, setUrl] = useState(existing?.url ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [category, setCategory] = useState(existing?.category ?? 'AI');
  const [tags, setTags] = useState(existing?.tags.join(', ') ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [projectLinks, setProjectLinks] = useState(
    existing?.projectLinks.join('\n') ?? '',
  );
  const [isFavorite, setIsFavorite] = useState(existing?.isFavorite ?? false);
  const [colorValue, setColorValue] = useState(
    existing?.colorValue ?? DEFAULT_TOOL_COLOR,
  );
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});

  if (route.params?.toolId && !existing) {
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

  const save = () => {
    const nextErrors: Partial<Record<FieldName, string>> = {};
    const cleanName = name.trim();
    const cleanDescription = description.trim();
    const cleanUrl = normalizeWebUrl(url);
    const normalizedLinks = projectLinks
      .split(/\r?\n/)
      .map((link) => link.trim())
      .filter(Boolean)
      .map(normalizeWebUrl);

    if (!cleanName) nextErrors.name = 'Please enter a name';
    if (!url.trim()) nextErrors.url = 'Please enter a website';
    else if (!cleanUrl) {
      nextErrors.url = 'Enter a valid http or https website';
    }
    if (!cleanDescription || cleanDescription.length > 140) {
      nextErrors.description = 'Please add a short description (max 140 characters)';
    }
    if (normalizedLinks.some((link) => link === null)) {
      nextErrors.projectLinks = 'Enter valid http or https links';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !cleanUrl) return;

    const value: Omit<Tool, 'id'> = {
      name: cleanName,
      url: cleanUrl,
      description: cleanDescription,
      category,
      tags: [...new Set(tags.split(',').map((tag) => tag.trim()).filter(Boolean))],
      notes: notes.trim(),
      projectLinks: normalizedLinks.filter(
        (link): link is string => link !== null,
      ),
      isFavorite,
      colorValue,
    };

    if (existing) {
      updateTool({ ...value, id: existing.id });
      navigation.goBack();
      return;
    }

    const created = addTool(value);
    navigation.replace('ToolDetail', { toolId: created.id });
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
            title={existing ? 'Edit tool' : 'Add a tool'}
            subtitle="Keep your developer toolkit organized."
            onBack={navigation.goBack}
          />
          <FormField
            label="Name"
            placeholder="e.g. GitHub"
            value={name}
            onChangeText={setName}
            error={errors.name}
            autoCapitalize="words"
          />
          <FormField
            label="Website"
            placeholder="https://example.com"
            value={url}
            onChangeText={setUrl}
            error={errors.url}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <FormField
            label="Description"
            placeholder="What do you use this tool for?"
            value={description}
            onChangeText={setDescription}
            error={errors.description}
            maxLength={140}
            multiline
          />
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Category
          </Text>
          <View style={styles.choices}>
            {TOOL_CATEGORIES.map((item) => {
              const selected = category === item;
              return (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    selectionHaptic();
                    setCategory(item);
                  }}
                  style={[
                    styles.choice,
                    {
                      backgroundColor: selected
                        ? appearanceForCategory(item).accent
                        : theme.colors.surface,
                      borderColor: selected
                        ? appearanceForCategory(item).accent
                        : theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: selected
                        ? appearanceForCategory(item).foreground
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
          <FormField
            label="Tags"
            placeholder="coding, frontend, design"
            value={tags}
            onChangeText={setTags}
            autoCapitalize="none"
          />
          <FormField
            label="Notes"
            placeholder="Optional notes"
            value={notes}
            onChangeText={setNotes}
            multiline
          />
          <FormField
            label="Project links"
            placeholder={'One link per line\nhttps://github.com/you/project'}
            value={projectLinks}
            onChangeText={setProjectLinks}
            error={errors.projectLinks}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
          />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isFavorite }}
            onPress={() => {
              lightImpactHaptic();
              setIsFavorite((value) => !value);
            }}
            style={styles.favoriteToggle}
          >
            <Text style={{ color: theme.colors.text, fontSize: 16 }}>
              {isFavorite ? '☑' : '□'}  Add to favorites
            </Text>
          </Pressable>
          <Notice warning>
            Do not add passwords, API keys, or tokens. This app is not encrypted
            secret storage.
          </Notice>
          <ActionButton
            label={existing ? 'Save changes' : 'Add tool'}
            onPress={save}
          />
          <View style={{ height: 22 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  keyboard: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 20 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  choice: {
    borderWidth: 1,
    borderRadius: 18,
    minHeight: 38,
    paddingHorizontal: 13,
    justifyContent: 'center',
  },
  favoriteToggle: {
    minHeight: 48,
    justifyContent: 'center',
    marginBottom: 12,
  },
});
