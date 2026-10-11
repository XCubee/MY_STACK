import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, Notice, ScreenTitle } from '../components/ui';
import { useApp } from '../state/AppContext';
import type { ThemeMode } from '../theme';
import { selectionHaptic } from '../utils/haptics';

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function SettingsScreen() {
  const {
    theme,
    themeMode,
    setThemeMode,
    syncStatus,
    syncMessage,
    cloudEnabled,
    retrySync,
  } = useApp();

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle title="Settings" subtitle="Preferences and sync status." />

        <Text style={[styles.heading, { color: theme.colors.text }]}>
          Appearance
        </Text>
        <View
          style={[
            styles.segment,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {themeOptions.map((option) => {
            const selected = themeMode === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  selectionHaptic();
                  setThemeMode(option.value);
                }}
                style={[
                  styles.segmentOption,
                  selected
                    ? { backgroundColor: theme.colors.primary }
                    : null,
                ]}
              >
                <Text
                  style={{
                    color: selected
                      ? theme.colors.onPrimary
                      : theme.colors.text,
                    fontWeight: '700',
                  }}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.heading, { color: theme.colors.text }]}>
          Cloud sync
        </Text>
        <Notice warning={syncStatus === 'error'}>{syncMessage}</Notice>
        {cloudEnabled && syncStatus === 'error' ? (
          <ActionButton
            label="Retry cloud sync"
            secondary
            onPress={() => void retrySync()}
          />
        ) : null}
        <Text style={[styles.caption, { color: theme.colors.muted }]}>
          Sync uses a private anonymous session on this device. There is no
          login or account recovery; reinstalling the app can make its cloud
          identity inaccessible.
        </Text>

        <Text style={[styles.heading, { color: theme.colors.text }]}>
          Privacy
        </Text>
        <Notice warning>
          My Stack is not a password manager. Do not save passwords, API keys,
          or tokens in tool names, links, notes, or project links. Device data
          is not encrypted.
        </Notice>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 12 },
  heading: { fontWeight: '800', fontSize: 17, marginTop: 20, marginBottom: 10 },
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segmentOption: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: { fontSize: 14, lineHeight: 21, marginTop: 1 },
});
