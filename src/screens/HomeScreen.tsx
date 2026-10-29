import { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { StackMark } from '../components/StackMark';
import { ToolCard } from '../components/ToolCard';
import { ActionButton, Notice } from '../components/ui';
import { TOOL_CATEGORIES } from '../domain/tool';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';
import { useActivity } from '../state/ActivityContext';
import { useLearning } from '../state/LearningContext';
import { useReferrals } from '../state/ReferralContext';
import { useTasks } from '../state/TaskContext';
import { selectionHaptic } from '../utils/haptics';

type HomeNavigation = BottomTabNavigationProp<MainTabParamList>;

export function HomeScreen() {
  const {
    tools,
    subscriptions,
    theme,
    currentUser,
    profile,
    syncStatus,
    syncMessage,
    toggleFavorite,
  } = useApp();
  const { items: learningItems } = useLearning();
  const { contacts, requests } = useReferrals();
  const { tasks } = useTasks();
  const { events: activityEvents } = useActivity();
  const navigation = useNavigation<HomeNavigation>();
  const stackNavigation = navigation.getParent() as
    | { navigate: (screen: keyof RootStackParamList, params?: object) => void }
    | undefined;
  const pinned = useMemo(
    () => tools.filter((tool) => tool.isFavorite).slice(0, 4),
    [tools],
  );
  const recent = tools.filter((tool) => !tool.isFavorite).slice(0, 3);
  const firstName =
    profile?.display_name?.split(/\s+/)[0] ||
    currentUser?.email?.split('@')[0] ||
    'there';
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  const activeTasks = tasks.filter(
    (task) => task.status === 'open' || task.status === 'in_progress',
  );
  const dueToday = activeTasks
    .filter((task) => task.dueDate === today)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
    .slice(0, 3);
  const followUps = requests
    .filter(
      (request) =>
        request.status !== 'closed' && request.nextFollowUpAt !== null,
    )
    .sort((a, b) =>
      (a.nextFollowUpAt ?? '').localeCompare(b.nextFollowUpAt ?? ''),
    )
    .slice(0, 3);
  const learningInProgress = learningItems
    .filter(
      (item) => item.archivedAt === null && item.status === 'in_progress',
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3);
  const upcomingRenewals = subscriptions
    .filter((subscription) => subscription.renewalDate >= today)
    .sort((a, b) => a.renewalDate.localeCompare(b.renewalDate))
    .slice(0, 3);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.identity}>
            <StackMark size={43} />
            <View>
              <Text style={[styles.brand, { color: theme.colors.text }]}>
                My Stack
              </Text>
              <Text style={[styles.greeting, { color: theme.colors.muted }]}>
               Hello There {firstName}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            onPress={() => navigation.navigate('Settings')}
            style={[
              styles.avatar,
              { backgroundColor: theme.colors.surfaceRaised },
            ]}
          >
            <Text style={[styles.avatarText, { color: theme.colors.primary }]}>
              {firstName.charAt(0).toUpperCase()}
            </Text>
          </Pressable>
        </View>

        <View style={styles.heroTitle}>
          <Text style={[styles.headline, { color: theme.colors.text }]}>
            Workspace
          </Text>
          
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            selectionHaptic();
            stackNavigation?.navigate('Search');
          }}
          style={[
            styles.searchBar,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={[styles.searchIcon, { color: theme.colors.primary }]}>
            ⌕
          </Text>
          <Text style={[styles.searchPlaceholder, { color: theme.colors.muted }]}>
            Search across your workspace…
          </Text>
          <Text style={[styles.searchShortcut, { color: theme.colors.muted }]}>
            Search
          </Text>
        </Pressable>

        {syncStatus === 'error' ? <Notice warning>{syncMessage}</Notice> : null}

        <View style={styles.statsRow}>
          <Stat
            label="TOTAL TOOLS"
            value={tools.length.toString()}
            accent={theme.colors.primary}
            theme={theme}
          />
          <Stat
            label="FAVORITES"
            value={tools.filter((tool) => tool.isFavorite).length.toString()}
            accent="#F8C746"
            theme={theme}
          />
          <Stat
            label="CATEGORIES"
            value={
              new Set(tools.map((tool) => tool.category)).size.toString()
            }
            accent="#03fafa"
            theme={theme}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => stackNavigation?.navigate('Learning')}
          style={[
            styles.learningShortcut,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={styles.learningShortcutCopy}>
            <Text style={[styles.learningShortcutTitle, { color: theme.colors.text }]}>
              Learning tracker
            </Text>
            <Text style={[styles.learningShortcutHint, { color: theme.colors.muted }]}>
              {learningItems.filter((item) => item.archivedAt === null).length}{' '}
              active · courses, skills, and reading
            </Text>
          </View>
          <Text style={[styles.learningShortcutArrow, { color: theme.colors.primary }]}>
            ›
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => stackNavigation?.navigate('Referrals')}
          style={[
            styles.learningShortcut,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={styles.learningShortcutCopy}>
            <Text style={[styles.learningShortcutTitle, { color: theme.colors.text }]}>
              Referral tracker
            </Text>
            <Text style={[styles.learningShortcutHint, { color: theme.colors.muted }]}>
              {requests.length} requests · {contacts.filter((item) => item.archivedAt === null).length}{' '}
              active contacts
            </Text>
          </View>
          <Text style={[styles.learningShortcutArrow, { color: theme.colors.primary }]}>
            ›
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => stackNavigation?.navigate('Tasks')}
          style={[
            styles.learningShortcut,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={styles.learningShortcutCopy}>
            <Text style={[styles.learningShortcutTitle, { color: theme.colors.text }]}>
              Tasks & reminders
            </Text>
            <Text style={[styles.learningShortcutHint, { color: theme.colors.muted }]}>
              {tasks.filter((task) => task.status === 'open' || task.status === 'in_progress').length}{' '}
              open · {tasks.filter((task) => task.dueDate === today).length} due today
            </Text>
          </View>
          <Text style={[styles.learningShortcutArrow, { color: theme.colors.primary }]}>
            ›
          </Text>
        </Pressable>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Learning in progress
            </Text>
            <Text style={[styles.sectionHint, { color: theme.colors.muted }]}>
              Pick up where you left off
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => stackNavigation?.navigate('Learning')}
          >
            <Text style={[styles.viewAll, { color: theme.colors.primary }]}>
              View all
            </Text>
          </Pressable>
        </View>
        {learningInProgress.length ? (
          learningInProgress.map((item) => (
            <DashboardRow
              key={item.id}
              title={item.title}
              detail={`${item.progress === null ? 'Progress not set' : `${item.progress}% complete`}${item.currentPosition ? ` · ${item.currentPosition}` : ''}`}
              theme={theme}
              onPress={() =>
                stackNavigation?.navigate('LearningDetail', {
                  learningItemId: item.id,
                })
              }
            />
          ))
        ) : (
          <DashboardEmpty
            label="No learning items in progress."
            theme={theme}
            onPress={() => stackNavigation?.navigate('Learning')}
          />
        )}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Referral follow-ups
            </Text>
            <Text style={[styles.sectionHint, { color: theme.colors.muted }]}>
              Requests that need your attention
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => stackNavigation?.navigate('Referrals')}
          >
            <Text style={[styles.viewAll, { color: theme.colors.primary }]}>
              View all
            </Text>
          </Pressable>
        </View>
        {followUps.length ? (
          followUps.map((request) => {
            const contact = contacts.find(
              (item) => item.id === request.contactId,
            );
            return (
              <DashboardRow
                key={request.id}
                title={contact?.name ?? 'Referral follow-up'}
                detail={`Follow up ${request.nextFollowUpAt?.slice(0, 10) ?? ''} · ${request.status.replaceAll('_', ' ')}`}
                theme={theme}
                onPress={() =>
                  stackNavigation?.navigate('ReferralDetail', {
                    referralRequestId: request.id,
                  })
                }
              />
            );
          })
        ) : (
          <DashboardEmpty
            label="No referral follow-ups scheduled."
            theme={theme}
            onPress={() => stackNavigation?.navigate('Referrals')}
          />
        )}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Tasks due today
            </Text>
            <Text style={[styles.sectionHint, { color: theme.colors.muted }]}>
              {activeTasks.filter((task) => task.dueDate && task.dueDate < today).length}{' '}
              overdue · {dueToday.length} due today
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => stackNavigation?.navigate('Tasks')}
          >
            <Text style={[styles.viewAll, { color: theme.colors.primary }]}>
              View all
            </Text>
          </Pressable>
        </View>
        {dueToday.length ? (
          dueToday.map((task) => (
            <DashboardRow
              key={task.id}
              title={task.title}
              detail={`${task.priority} priority${task.dueAt ? ` · ${new Date(task.dueAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}`}
              theme={theme}
              onPress={() =>
                stackNavigation?.navigate('TaskForm', { taskId: task.id })
              }
            />
          ))
        ) : (
          <DashboardEmpty
            label="No tasks due today."
            theme={theme}
            onPress={() => stackNavigation?.navigate('Tasks')}
          />
        )}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Upcoming renewals
            </Text>
            <Text style={[styles.sectionHint, { color: theme.colors.muted }]}>
              Subscriptions with future renewal dates
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => stackNavigation?.navigate('Renewals')}
          >
            <Text style={[styles.viewAll, { color: theme.colors.primary }]}>
              View all
            </Text>
          </Pressable>
        </View>
        {upcomingRenewals.length ? (
          upcomingRenewals.map((subscription) => (
            <DashboardRow
              key={subscription.id}
              title={subscription.name}
              detail={`Renews ${subscription.renewalDate}`}
              theme={theme}
              onPress={() =>
                stackNavigation?.navigate('SubscriptionForm', {
                  subscriptionId: subscription.id,
                })
              }
            />
          ))
        ) : (
          <DashboardEmpty
            label="No upcoming subscription renewals."
            theme={theme}
            onPress={() => stackNavigation?.navigate('Renewals')}
          />
        )}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Recent activity
            </Text>
            <Text style={[styles.sectionHint, { color: theme.colors.muted }]}>
              Updates from across your workspace
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => stackNavigation?.navigate('Activity')}
          >
            <Text style={[styles.viewAll, { color: theme.colors.primary }]}>
              History
            </Text>
          </Pressable>
        </View>
        {activityEvents.length ? (
          activityEvents.slice(0, 4).map((event) => (
            <DashboardRow
              key={event.id}
              title={event.summary}
              detail={new Date(event.createdAt).toLocaleDateString()}
              theme={theme}
              onPress={() => stackNavigation?.navigate('Activity')}
            />
          ))
        ) : (
          <DashboardEmpty
            label="Your recent workspace activity will appear here."
            theme={theme}
            onPress={() => stackNavigation?.navigate('Activity')}
          />
        )}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Pinned tools
            </Text>
            <Text style={[styles.sectionHint, { color: theme.colors.muted }]}>
              Your everyday essentials
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => stackNavigation?.navigate('Favorites')}
          >
            <Text style={[styles.viewAll, { color: theme.colors.primary }]}>
              See all
            </Text>
          </Pressable>
        </View>
        {pinned.length ? (
          pinned.map((tool, index) => (
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
          <Pressable
            accessibilityRole="button"
            onPress={() => stackNavigation?.navigate('Search')}
            style={[
              styles.emptyPanel,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              Pin the tools you use most
            </Text>
            <Text style={[styles.emptyCopy, { color: theme.colors.muted }]}>
              Tap the star on any tool to keep it here.
            </Text>
          </Pressable>
        )}

        <View style={[styles.sectionHeader, styles.categoryHeader]}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Browse categories
            </Text>
            <Text style={[styles.sectionHint, { color: theme.colors.muted }]}>
              Jump straight to a collection
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Library')}
          >
            <Text style={[styles.viewAll, { color: theme.colors.primary }]}>
              Explore
            </Text>
          </Pressable>
        </View>
        <View style={styles.categoryGrid}>
          {TOOL_CATEGORIES.slice(0, 6).map((category, index) => (
            <Pressable
              key={category}
              accessibilityRole="button"
              onPress={() => navigation.navigate('Library')}
              style={[
                styles.categoryCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.categoryDot,
                  { backgroundColor: categoryColors[index % categoryColors.length] },
                ]}
              />
              <Text
                numberOfLines={1}
                style={[styles.categoryName, { color: theme.colors.text }]}
              >
                {category}
              </Text>
              <Text style={[styles.categoryCount, { color: theme.colors.muted }]}>
                {tools.filter((tool) => tool.category === category).length} tools
              </Text>
              <Text style={[styles.categoryArrow, { color: theme.colors.muted }]}>
                ›
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Recently added
            </Text>
            <Text style={[styles.sectionHint, { color: theme.colors.muted }]}>
              Fresh additions to your stack
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Library')}
          >
            <Text style={[styles.viewAll, { color: theme.colors.primary }]}>
              Library
            </Text>
          </Pressable>
        </View>
        {recent.length ? (
          recent.map((tool, index) => (
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
          <View style={styles.emptyPanel}>
            <Text style={[styles.emptyCopy, { color: theme.colors.muted }]}>
              Your new tools will show up here.
            </Text>
          </View>
        )}
        <View style={styles.footerButton}>
          <ActionButton
            label="View upcoming renewals"
            secondary
            onPress={() => stackNavigation?.navigate('Renewals')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
  accent,
  theme,
}: {
  label: string;
  value: string;
  accent: string;
  theme: ReturnType<typeof useApp>['theme'];
}) {
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.colors.muted }]}>{label}</Text>
    </View>
  );
}

function DashboardRow({
  title,
  detail,
  theme,
  onPress,
}: {
  title: string;
  detail: string;
  theme: ReturnType<typeof useApp>['theme'];
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.dashboardRow,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <View style={styles.dashboardRowCopy}>
        <Text numberOfLines={1} style={[styles.dashboardRowTitle, { color: theme.colors.text }]}>
          {title}
        </Text>
        <Text numberOfLines={2} style={[styles.dashboardRowDetail, { color: theme.colors.muted }]}>
          {detail}
        </Text>
      </View>
      <Text style={[styles.dashboardArrow, { color: theme.colors.primary }]}>
        ›
      </Text>
    </Pressable>
  );
}

function DashboardEmpty({
  label,
  theme,
  onPress,
}: {
  label: string;
  theme: ReturnType<typeof useApp>['theme'];
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.dashboardEmpty,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <Text style={[styles.dashboardRowDetail, { color: theme.colors.muted }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const categoryColors = ['#37D988', '#4DC9D9', '#F4879A', '#F5BF4F', '#78A8FF', '#F08A54'];

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 19, paddingTop: 8, paddingBottom: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: { fontSize: 19, fontWeight: '900' },
  greeting: { fontSize: 12, marginTop: 3 },
  avatar: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontWeight: '900' },
  heroTitle: { marginTop: 22, marginBottom: 16 },
  headline: { fontSize: 27, fontWeight: '900', letterSpacing: -0.6 },
  headlineAccent: { fontSize: 27, fontWeight: '900', letterSpacing: -0.7, marginTop: 1 },
  intro: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  searchBar: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 14, borderRadius: 15, borderWidth: 1 },
  searchIcon: { fontSize: 26, marginRight: 9, lineHeight: 30 },
  searchPlaceholder: { flex: 1, fontSize: 14 },
  searchShortcut: { fontSize: 11, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 9, marginTop: 16 },
  statCard: { flex: 1, borderWidth: 1, borderRadius: 15, padding: 13 },
  statValue: { fontSize: 21, fontWeight: '900' },
  statLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5, marginTop: 5 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 26, marginBottom: 12 },
  categoryHeader: { marginTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  sectionHint: { fontSize: 12, marginTop: 4 },
  viewAll: { fontSize: 13, fontWeight: '800' },
  emptyPanel: { borderWidth: 1, borderRadius: 17, padding: 17, marginBottom: 9 },
  emptyTitle: { fontSize: 15, fontWeight: '800' },
  emptyCopy: { fontSize: 13, lineHeight: 19, marginTop: 5 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  categoryCard: { position: 'relative', width: '31.5%', minHeight: 98, borderWidth: 1, borderRadius: 16, padding: 11, justifyContent: 'center' },
  categoryDot: { width: 9, height: 9, borderRadius: 3, marginBottom: 10 },
  categoryName: { fontSize: 12, fontWeight: '800' },
  categoryCount: { fontSize: 11, marginTop: 4 },
  categoryArrow: { position: 'absolute', top: 8, right: 10, fontSize: 19 },
  footerButton: { marginTop: 16 },
  learningShortcut: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 22,
  },
  learningShortcutCopy: { flex: 1, gap: 4 },
  learningShortcutTitle: { fontSize: 16, fontWeight: '900' },
  learningShortcutHint: { fontSize: 12 },
  learningShortcutArrow: { fontSize: 30, fontWeight: '500' },
  dashboardRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginBottom: 8,
  },
  dashboardRowCopy: { flex: 1, gap: 4 },
  dashboardRowTitle: { fontSize: 14, fontWeight: '800' },
  dashboardRowDetail: { fontSize: 12, lineHeight: 18 },
  dashboardArrow: { fontSize: 24, marginLeft: 8 },
  dashboardEmpty: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
});
