import { useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { ActionButton, Notice, ScreenTitle } from '../components/ui';
import { useApp } from '../state/AppContext';
import type { RootStackParamList } from '../navigation/types';
import type { ThemeMode } from '../theme';
import { selectionHaptic } from '../utils/haptics';

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const settingRows = [
  {
    id: 'appearance',
    icon: '◐',
    title: 'Appearance',
    subtitle: 'Dark mode, light mode, language',
  },
  {
    id: 'organization',
    icon: '⌘',
    title: 'Organization',
    subtitle: 'Categories, tags, collections',
  },
  {
    id: 'backup',
    icon: '☁',
    title: 'Data & Backup',
    subtitle: 'Cloud sync, export data',
  },
  {
    id: 'reminders',
    icon: '◷',
    title: 'Reminders',
    subtitle: 'Upcoming renewals and tasks',
  },
  {
    id: 'integrations',
    icon: '⛓',
    title: 'Integrations',
    subtitle: 'Connect other services',
  },
  {
    id: 'security',
    icon: '◇',
    title: 'Security',
    subtitle: 'App lock, security settings',
  },
  {
    id: 'about',
    icon: 'ⓘ',
    title: 'About',
    subtitle: 'Version 1.0.0',
  },
] as const;

type SettingId = (typeof settingRows)[number]['id'];

export function SettingsScreen() {
  const {
    theme,
    themeMode,
    setThemeMode,
    syncStatus,
    syncMessage,
    cloudEnabled,
    retrySync,
    currentUser,
    profile,
    signOut,
  } = useApp();
  const tabNavigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const navigation =
    tabNavigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const [expanded, setExpanded] = useState<SettingId | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);

  const toggleRow = (id: SettingId) => {
    selectionHaptic();
    if (id === 'reminders') {
      navigation?.navigate('Renewals');
      return;
    }
    setExpanded((current) => (current === id ? null : id));
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitle title="Settings" subtitle="Your account and preferences." />

        {cloudEnabled && currentUser ? (
          <View
            style={[
              styles.accountCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={[styles.accountAvatar, { backgroundColor: theme.colors.chip }]}>
              <Text style={[styles.accountInitial, { color: theme.colors.primary }]}>
                {(profile?.display_name || currentUser.email || 'U')
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>
            <View style={styles.accountInfo}>
              <Text style={[styles.accountName, { color: theme.colors.text }]}>
                {profile?.display_name || 'Your account'}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.accountEmail, { color: theme.colors.muted }]}
              >
                {currentUser.email || 'Signed in'}
              </Text>
            </View>
            <Text style={[styles.chevron, { color: theme.colors.muted }]}>›</Text>
          </View>
        ) : null}

        <View style={styles.rows}>
          {settingRows.map((item) => {
            const isExpanded = expanded === item.id;
            return (
              <View key={item.id}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isExpanded }}
                  onPress={() => toggleRow(item.id)}
                  style={[
                    styles.row,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      borderBottomLeftRadius: isExpanded ? 5 : 15,
                      borderBottomRightRadius: isExpanded ? 5 : 15,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.rowIcon,
                      { backgroundColor: theme.colors.surfaceRaised },
                    ]}
                  >
                    <Text style={[styles.rowIconText, { color: theme.colors.primary }]}>
                      {item.icon}
                    </Text>
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={[styles.rowTitle, { color: theme.colors.text }]}>
                      {item.title}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[styles.rowSubtitle, { color: theme.colors.muted }]}
                    >
                      {item.subtitle}
                    </Text>
                  </View>
                  <Text style={[styles.chevron, { color: theme.colors.muted }]}>
                    {isExpanded ? '⌄' : '›'}
                  </Text>
                </Pressable>
                {isExpanded ? (
                  <View
                    style={[
                      styles.expandedContent,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    {renderSettingContent({
                      id: item.id,
                      theme,
                      themeMode,
                      setThemeMode,
                      syncStatus,
                      syncMessage,
                      cloudEnabled,
                      retrySync,
                      profile,
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {accountError ? (
          <Text style={[styles.accountError, { color: theme.colors.danger }]}>
            {accountError}
          </Text>
        ) : null}
        {cloudEnabled && currentUser ? (
          <ActionButton
            label="Sign out"
            secondary
            danger
            style={styles.signOut}
            onPress={() => {
              setAccountError(null);
              void signOut().catch((error: unknown) => {
                setAccountError(
                  error instanceof Error
                    ? error.message
                    : 'Could not sign out. Please try again.',
                );
              });
            }}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );

  function renderSettingContent({
    id,
    theme: currentTheme,
    themeMode: currentThemeMode,
    setThemeMode: setCurrentThemeMode,
    syncStatus: currentSyncStatus,
    syncMessage: currentSyncMessage,
    cloudEnabled: isCloudEnabled,
    retrySync: retryCurrentSync,
    profile: currentProfile,
  }: {
    id: SettingId;
    theme: ReturnType<typeof useApp>['theme'];
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    syncStatus: ReturnType<typeof useApp>['syncStatus'];
    syncMessage: string;
    cloudEnabled: boolean;
    retrySync: () => Promise<void>;
    profile: ReturnType<typeof useApp>['profile'];
  }): ReactNode {
    if (id === 'appearance') {
      return (
        <View
          style={[
            styles.segment,
            { backgroundColor: currentTheme.colors.surfaceRaised },
          ]}
        >
          {themeOptions.map((option) => {
            const selected = currentThemeMode === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  selectionHaptic();
                  setCurrentThemeMode(option.value);
                }}
                style={[
                  styles.segmentOption,
                  selected ? { backgroundColor: currentTheme.colors.primary } : null,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: selected
                        ? currentTheme.colors.onPrimary
                        : currentTheme.colors.text,
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      );
    }
    if (id === 'organization') {
      return (
        <View style={styles.details}>
          <DetailLine label="Workspace" value="Personal Project" theme={currentTheme} />
          <DetailLine
            label="Focus"
            value={currentProfile?.use_case || 'Your saved tools and resources'}
            theme={currentTheme}
          />
          <DetailLine
            label="Experience"
            value={currentProfile?.experience_level || 'Not set'}
            theme={currentTheme}
          />
          <DetailLine
            label="Preferred categories"
            value={currentProfile?.preferred_categories.join(', ') || 'All categories'}
            theme={currentTheme}
          />
        </View>
      );
    }
    if (id === 'backup') {
      return (
        <View>
          <Notice warning={currentSyncStatus === 'error'}>
            {currentSyncMessage}
          </Notice>
          {!isCloudEnabled ? (
            <Text
              style={[
                styles.expandedHint,
                { color: currentTheme.colors.muted },
              ]}
            >
              Cloud sync is not configured for this build.
            </Text>
          ) : currentSyncStatus === 'error' ? (
            <ActionButton
              label="Retry cloud sync"
              secondary
              onPress={() => void retryCurrentSync()}
            />
          ) : null}
          <Text style={[styles.expandedHint, { color: currentTheme.colors.muted }]}>
            Syncs your private tools and subscriptions to your account.
          </Text>
        </View>
      );
    }
    if (id === 'integrations') {
      return (
        <Text style={[styles.expandedHint, { color: currentTheme.colors.muted }]}>
          Your sign-in providers are managed through Supabase. No external
          workspace integrations are connected yet.
        </Text>
      );
    }
    if (id === 'security') {
      return (
        <Text style={[styles.expandedHint, { color: currentTheme.colors.muted }]}>
          My Stack is not a password manager. Do not save passwords, API keys,
          or tokens in tool details. Device data is not encrypted.
        </Text>
      );
    }
    if (id === 'about') {
      return (
        <View style={styles.details}>
          <DetailLine label="Application" value="My Stack" theme={currentTheme} />
          <DetailLine label="Version" value="1.0.0" theme={currentTheme} />
          <DetailLine label="License" value="Free to use" theme={currentTheme} />
        </View>
      );
    }
    return null;
  }
}

function DetailLine({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useApp>['theme'];
}) {
  return (
    <View style={styles.detailLine}>
      <Text style={[styles.detailLabel, { color: theme.colors.muted }]}>
        {label}
      </Text>
      <Text style={[styles.detailValue, { color: theme.colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 9, paddingBottom: 24 },
  accountCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 18,
  },
  accountAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountInitial: { fontSize: 16, fontWeight: '900' },
  accountInfo: { flex: 1 },
  accountName: { fontSize: 14, fontWeight: '900' },
  accountEmail: { fontSize: 11, marginTop: 3 },
  rows: { gap: 8 },
  row: {
    minHeight: 67,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconText: { fontSize: 16, fontWeight: '900' },
  rowCopy: { flex: 1 },
  rowTitle: { fontSize: 13, fontWeight: '900' },
  rowSubtitle: { fontSize: 10, marginTop: 3 },
  chevron: { fontSize: 22, lineHeight: 25, marginHorizontal: 3 },
  expandedContent: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    paddingHorizontal: 13,
    paddingBottom: 13,
    paddingTop: 9,
    marginTop: -3,
    marginBottom: 4,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 13,
    padding: 3,
    gap: 4,
  },
  segmentOption: {
    flex: 1,
    minHeight: 39,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: { fontSize: 12, fontWeight: '800' },
  details: { gap: 10 },
  detailLine: { gap: 3 },
  detailLabel: { fontSize: 10, fontWeight: '700' },
  detailValue: { fontSize: 12, fontWeight: '700' },
  expandedHint: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  accountError: { fontSize: 12, marginTop: 10 },
  signOut: { marginTop: 18 },
});
