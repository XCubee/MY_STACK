import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState, useColorScheme } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { sampleTools } from '../data/sampleTools';
import {
  makeToolId,
  normalizeToolColor,
  toolFromRow,
  toolToRow,
  type Tool,
} from '../domain/tool';
import {
  profileFromRow,
  type OnboardingAnswers,
  type UserProfile,
} from '../domain/profile';
import {
  makeSubscriptionId,
  subscriptionFromRow,
  subscriptionToRow,
  type Subscription,
} from '../domain/subscription';
import {
  clearLocalProfile,
  clearCloudSyncPending,
  hasPendingCloudSync,
  loadLocalTools,
  loadLocalProfile,
  markCloudSyncPending,
  saveLocalProfile,
  saveLocalTools,
} from '../services/toolStorage';
import {
  clearSubscriptionSyncPending,
  hasPendingSubscriptionSync,
  loadLocalSubscriptions,
  markSubscriptionSyncPending,
  saveLocalSubscriptions,
} from '../services/subscriptionStorage';
import {
  clearSubscriptionNotifications,
  syncSubscriptionNotifications,
} from '../services/subscriptionNotifications';
import { createSupabaseClient } from '../services/supabase';
import {
  darkTheme,
  lightTheme,
  type AppTheme,
  type ThemeMode,
} from '../theme';

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';
export type AuthStatus =
  | 'loading'
  | 'offline'
  | 'signedOut'
  | 'onboarding'
  | 'authenticated';

type AppContextValue = {
  tools: Tool[];
  subscriptions: Subscription[];
  ready: boolean;
  fatalError: string | null;
  themeMode: ThemeMode;
  theme: AppTheme;
  cloudEnabled: boolean;
  authStatus: AuthStatus;
  currentUser: User | null;
  profile: UserProfile | null;
  syncStatus: SyncStatus;
  syncMessage: string;
  reminderMessage: string;
  setThemeMode: (mode: ThemeMode) => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<boolean>;
  signInWithProvider: (provider: 'google' | 'apple') => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: (answers: OnboardingAnswers) => Promise<void>;
  addTool: (tool: Omit<Tool, 'id'>) => Tool;
  updateTool: (tool: Tool) => void;
  deleteTool: (id: string) => void;
  toggleFavorite: (id: string) => void;
  addSubscription: (subscription: Omit<Subscription, 'id'>) => Subscription;
  updateSubscription: (subscription: Subscription) => void;
  deleteSubscription: (id: string) => void;
  retrySync: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const clientInitialization = (() => {
  try {
    return { client: createSupabaseClient(), error: null };
  } catch (error) {
    return { client: null, error: errorMessage(error) };
  }
})();

function mergeTools(local: Tool[], cloud: Tool[], localWins: boolean): Tool[] {
  const merged = new Map<string, Tool>();
  const ordered = localWins ? [...cloud, ...local] : [...local, ...cloud];
  for (const tool of ordered) merged.set(tool.id, tool);
  return [...merged.values()];
}

function mergeSubscriptions(
  local: Subscription[],
  cloud: Subscription[],
  localWins: boolean,
): Subscription[] {
  const merged = new Map<string, Subscription>();
  const ordered = localWins ? [...cloud, ...local] : [...local, ...cloud];
  for (const subscription of ordered) {
    merged.set(subscription.id, subscription);
  }
  return [...merged.values()];
}

async function replaceCloudTools(
  client: SupabaseClient,
  userId: string,
  tools: Tool[],
): Promise<void> {
  if (tools.length > 0) {
    const { error } = await client
      .from('tools')
      .upsert(tools.map((tool) => toolToRow(tool, userId)), {
        onConflict: 'user_id,id',
      });
    if (error) throw error;
  }

  const { data, error: readError } = await client
    .from('tools')
    .select('id')
    .eq('user_id', userId);
  if (readError) throw readError;

  const toolIds = new Set(tools.map((tool) => tool.id));
  const staleIds = (data ?? [])
    .map((row) => row.id)
    .filter((id): id is string => typeof id === 'string' && !toolIds.has(id));
  if (staleIds.length > 0) {
    const { error } = await client
      .from('tools')
      .delete()
      .eq('user_id', userId)
      .in('id', staleIds);
    if (error) throw error;
  }
}

async function replaceCloudSubscriptions(
  client: SupabaseClient,
  userId: string,
  subscriptions: Subscription[],
): Promise<void> {
  if (subscriptions.length > 0) {
    const { error } = await client
      .from('subscriptions')
      .upsert(
        subscriptions.map((subscription) =>
          subscriptionToRow(subscription, userId),
        ),
        { onConflict: 'user_id,id' },
      );
    if (error) throw error;
  }

  const { data, error } = await client
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId);
  if (error) throw error;
  const subscriptionIds = new Set(
    subscriptions.map((subscription) => subscription.id),
  );
  const staleIds = (data ?? [])
    .map((row) => row.id)
    .filter(
      (id): id is string =>
        typeof id === 'string' && !subscriptionIds.has(id),
    );
  if (staleIds.length > 0) {
    const { error: deleteError } = await client
      .from('subscriptions')
      .delete()
      .eq('user_id', userId)
      .in('id', staleIds);
    if (deleteError) throw deleteError;
  }
}

function authRedirectUrl(): string {
  return Linking.createURL('auth/callback');
}

async function handleAuthCallback(
  client: SupabaseClient,
  callbackUrl: string,
): Promise<void> {
  const url = new URL(callbackUrl);
  const params = new URLSearchParams(url.search);
  for (const [key, value] of new URLSearchParams(url.hash.slice(1))) {
    params.set(key, value);
  }

  const callbackError =
    params.get('error_description') ?? params.get('error');
  if (callbackError) throw new Error(callbackError);

  const code = params.get('code');
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
  }
}

export function AppProvider({ children }: PropsWithChildren) {
  const deviceColorScheme = useColorScheme();
  const [tools, setTools] = useState<Tool[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [ready, setReady] = useState(Boolean(clientInitialization.error));
  const [fatalError, setFatalError] = useState<string | null>(
    clientInitialization.error
      ? `My Stack could not start: ${clientInitialization.error}`
      : null,
  );
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const [syncMessage, setSyncMessage] = useState(
    'Saved on this device. Add Supabase settings to enable cloud sync.',
  );
  const [reminderMessage, setReminderMessage] = useState('');
  const toolsRef = useRef<Tool[]>([]);
  const subscriptionsRef = useRef<Subscription[]>([]);
  const clientRef = useRef<SupabaseClient | null>(null);
  const userIdRef = useRef<string | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const subscriptionSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const processedAuthUrls = useRef(new Set<string>());

  const showTools = useCallback((next: Tool[]) => {
    toolsRef.current = next;
    setTools(next);
  }, []);

  const showSubscriptions = useCallback((next: Subscription[]) => {
    subscriptionsRef.current = next;
    setSubscriptions(next);
  }, []);

  const processAuthCallback = useCallback(
    async (client: SupabaseClient, callbackUrl: string) => {
      if (processedAuthUrls.current.has(callbackUrl)) return;
      processedAuthUrls.current.add(callbackUrl);
      try {
        await handleAuthCallback(client, callbackUrl);
      } catch (error) {
        processedAuthUrls.current.delete(callbackUrl);
        throw error;
      }
    },
    [],
  );

  const syncCurrentTools = useCallback(
    async (next: Tool[], ownerId = userIdRef.current) => {
      const client = clientRef.current;
      if (!client || !ownerId) {
        setSyncStatus('local');
        setSyncMessage(
          'Saved on this device. Add Supabase settings to enable cloud sync.',
        );
        return;
      }

      if (userIdRef.current === ownerId) {
        setSyncStatus('syncing');
        setSyncMessage('Syncing your library…');
      }
      try {
        await markCloudSyncPending(ownerId);
        await replaceCloudTools(client, ownerId, next);
        await clearCloudSyncPending(ownerId);
        if (userIdRef.current === ownerId) {
          setSyncStatus('synced');
          setSyncMessage('Cloud sync is up to date.');
        }
      } catch (error) {
        if (userIdRef.current === ownerId) {
          setSyncStatus('error');
          setSyncMessage(`Cloud sync failed: ${errorMessage(error)}`);
        }
      }
    },
    [],
  );

  const syncCurrentSubscriptions = useCallback(
    async (next: Subscription[], ownerId = userIdRef.current) => {
      const client = clientRef.current;
      if (!client || !ownerId) return;
      try {
        await markSubscriptionSyncPending(ownerId);
        await replaceCloudSubscriptions(client, ownerId, next);
        await clearSubscriptionSyncPending(ownerId);
      } catch (error) {
        if (userIdRef.current === ownerId) {
          setSyncStatus('error');
          setSyncMessage(
            `Subscription cloud sync failed: ${errorMessage(error)}`,
          );
        }
      }
    },
    [],
  );

  const retrySync = useCallback(async () => {
    if (!clientRef.current || !userIdRef.current) {
      setSyncStatus('local');
      setSyncMessage(
        'Cloud sync is not configured. Saved changes remain on this device.',
      );
      return;
    }
    const ownerId = userIdRef.current;
    await syncCurrentTools(toolsRef.current, ownerId);
    await syncCurrentSubscriptions(subscriptionsRef.current, ownerId);
  }, [syncCurrentTools, syncCurrentSubscriptions]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const client = clientRef.current;
      if (!client) throw new Error('Cloud sign-in is not configured.');
      const { error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
    },
    [],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string) => {
      const client = clientRef.current;
      if (!client) throw new Error('Cloud sign-in is not configured.');
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: authRedirectUrl() },
      });
      if (error) throw error;
      return Boolean(data.session);
    },
    [],
  );

  const signInWithProvider = useCallback(
    async (provider: 'google' | 'apple') => {
      const client = clientRef.current;
      if (!client) throw new Error('Cloud sign-in is not configured.');
      const redirectTo = authRedirectUrl();
      const { data, error } = await client.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data.url) throw new Error('The sign-in provider returned no URL.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success') {
        await processAuthCallback(client, result.url);
      }
    },
    [processAuthCallback],
  );

  const signOut = useCallback(async () => {
    const client = clientRef.current;
    if (!client) throw new Error('Cloud sign-in is not configured.');
    const ownerId = userIdRef.current;
    const { error } = await client.auth.signOut();
    if (error) throw error;
    if (ownerId) {
      try {
        await clearSubscriptionNotifications(ownerId);
      } catch (clearError) {
        setReminderMessage(
          `Could not clear reminders for the signed-out account: ${errorMessage(clearError)}`,
        );
      }
    }
  }, []);

  const completeOnboarding = useCallback(
    async (answers: OnboardingAnswers) => {
      const client = clientRef.current;
      const user = currentUser;
      if (!client || !user) {
        throw new Error('Sign in before completing your profile.');
      }
      const nextProfile: UserProfile = {
        id: user.id,
        ...answers,
        onboarding_completed: true,
      };
      const { error } = await client.from('profiles').upsert({
        ...nextProfile,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      setProfile(nextProfile);
      setAuthStatus('authenticated');
      try {
        await saveLocalProfile(nextProfile);
      } catch (cacheError) {
        setSyncStatus('error');
        setSyncMessage(
          `Your profile was saved online, but its local cache failed: ${errorMessage(cacheError)}`,
        );
      }
    },
    [currentUser],
  );

  useEffect(() => {
    let cancelled = false;
    let authEventVersion = 0;
    let unsubscribeAuth: (() => void) | undefined;
    const client = clientInitialization.client;
    clientRef.current = client;
    if (clientInitialization.error) {
      return () => {
        cancelled = true;
      };
    }
    const appStateSubscription = AppState.addEventListener(
      'change',
      (state) => {
        if (!client) return;
        if (state === 'active') void client.auth.startAutoRefresh();
        else void client.auth.stopAutoRefresh();
      },
    );
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      if (client) {
        void processAuthCallback(client, url).catch((error: unknown) => {
          if (!cancelled) setFatalError(`Sign-in callback failed: ${errorMessage(error)}`);
        });
      }
    });

    const hydrateUser = async (user: User, version: number) => {
      const previousUserId = userIdRef.current;
      if (previousUserId && previousUserId !== user.id) {
        try {
          await clearSubscriptionNotifications(previousUserId);
        } catch (error) {
          setReminderMessage(
            `Could not clear reminders for the previous account: ${errorMessage(error)}`,
          );
        }
      }
      userIdRef.current = user.id;
      setCurrentUser(user);
      setAuthStatus('loading');
      setProfile(null);
      showSubscriptions([]);

      const cachedTools = await loadLocalTools(user.id);
      const stored = cachedTools?.map((tool) => ({
        ...tool,
        colorValue: normalizeToolColor(tool.colorValue),
      })) ?? null;
      const cachedProfile = await loadLocalProfile(user.id);
      const { data: profileRow, error: profileError } = await client!
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      let loadedProfile = cachedProfile;
      let cloudReadError: string | null = null;
      if (profileError) {
        if (!cachedProfile) throw profileError;
        cloudReadError = errorMessage(profileError);
      } else {
        loadedProfile = profileFromRow(profileRow);
        if (loadedProfile) await saveLocalProfile(loadedProfile);
        else await clearLocalProfile(user.id);
      }

      let cloudTools = stored ?? [];
      if (!cloudReadError) {
        const { data: rows, error: toolsError } = await client!
          .from('tools')
          .select('*')
          .eq('user_id', user.id);
        if (toolsError) cloudReadError = errorMessage(toolsError);
        else cloudTools = (rows ?? []).map((row) => toolFromRow(row));
      }
      const pending = cloudReadError
        ? false
        : await hasPendingCloudSync(user.id);
      const merged = cloudReadError
        ? stored ?? []
        : pending && stored
          ? mergeTools(stored, cloudTools, true)
          : cloudTools;

      const cachedSubscriptions = await loadLocalSubscriptions(user.id);
      let cloudSubscriptions = cachedSubscriptions ?? [];
      const { data: subscriptionRows, error: subscriptionsError } = await client!
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id);
      const subscriptionReadError = subscriptionsError
        ? errorMessage(subscriptionsError)
        : null;
      if (!subscriptionsError) {
        cloudSubscriptions = (subscriptionRows ?? []).map((row) =>
          subscriptionFromRow(row),
        );
      }
      const subscriptionPending = subscriptionReadError
        ? false
        : await hasPendingSubscriptionSync(user.id);
      const mergedSubscriptions = subscriptionReadError
        ? cachedSubscriptions ?? []
        : subscriptionPending && cachedSubscriptions
          ? mergeSubscriptions(cachedSubscriptions, cloudSubscriptions, true)
          : cloudSubscriptions;

      if (cancelled || version !== authEventVersion) return;
      showTools(merged);
      await saveLocalTools(merged, user.id);
      showSubscriptions(mergedSubscriptions);
      await saveLocalSubscriptions(mergedSubscriptions, user.id);
      if (cloudReadError || subscriptionReadError) {
        setSyncStatus('error');
        setSyncMessage(
          `Offline: showing saved account data. ${cloudReadError ?? subscriptionReadError}`,
        );
      } else if (pending) await syncCurrentTools(merged, user.id);
      else {
        setSyncStatus('synced');
        setSyncMessage('Cloud sync is up to date.');
      }
      if (subscriptionReadError) {
        setSyncStatus('error');
        setSyncMessage(
          `Could not sync subscriptions: ${subscriptionReadError}`,
        );
      } else if (subscriptionPending) {
        await syncCurrentSubscriptions(mergedSubscriptions, user.id);
      }
      if (mergedSubscriptions.some((item) => item.reminderEnabled)) {
        try {
          const permissionGranted = await syncSubscriptionNotifications(
            mergedSubscriptions,
            user.id,
            false,
          );
          setReminderMessage(
            permissionGranted
              ? ''
              : 'Enable notifications in device settings to receive renewal reminders.',
          );
        } catch (error) {
          setReminderMessage(
            `Could not schedule reminders: ${errorMessage(error)}`,
          );
        }
      } else {
        setReminderMessage('');
      }

      setProfile(loadedProfile);
      setAuthStatus(
        loadedProfile?.onboarding_completed ? 'authenticated' : 'onboarding',
      );
    };

    if (client) {
      const authListener = client.auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION') return;
        const user = session?.user ?? null;
        if (user && !user.is_anonymous && userIdRef.current === user.id) {
          setCurrentUser(user);
          return;
        }
        const version = ++authEventVersion;
        if (!user) {
          const previousUserId = userIdRef.current;
          userIdRef.current = null;
          setCurrentUser(null);
          setProfile(null);
          showTools([]);
          showSubscriptions([]);
          if (previousUserId) {
            void clearSubscriptionNotifications(previousUserId).catch(
              (error: unknown) => {
                setReminderMessage(
                  `Could not clear reminders for the signed-out account: ${errorMessage(error)}`,
                );
              },
            );
          }
          setAuthStatus('signedOut');
          return;
        }
        if (user.is_anonymous) {
          const previousUserId = userIdRef.current;
          userIdRef.current = null;
          setCurrentUser(null);
          setProfile(null);
          showTools([]);
          showSubscriptions([]);
          if (previousUserId) {
            void clearSubscriptionNotifications(previousUserId);
          }
          setAuthStatus('signedOut');
          setTimeout(() => {
            void client.auth.signOut().then(({ error: signOutError }) => {
              if (signOutError && !cancelled) {
                setFatalError(`Could not clear the previous anonymous session: ${signOutError.message}`);
              }
            });
          }, 0);
          return;
        }
        void hydrateUser(user, version).catch((hydrateError: unknown) => {
          if (!cancelled && version === authEventVersion) {
            setFatalError(`Could not load your account: ${errorMessage(hydrateError)}`);
          }
        });
      });
      unsubscribeAuth = () => authListener.data.subscription.unsubscribe();
    }

    const bootstrap = async () => {
      try {
        if (!client) {
          const stored = await loadLocalTools();
          const storedSubscriptions = await loadLocalSubscriptions();
          const initial = (stored ?? sampleTools).map((tool) => ({
            ...tool,
            colorValue: normalizeToolColor(tool.colorValue),
          }));
          showTools(initial);
          const initialSubscriptions = storedSubscriptions ?? [];
          showSubscriptions(initialSubscriptions);
          if (
            initialSubscriptions.some(
              (subscription) => subscription.reminderEnabled,
            )
          ) {
            try {
              const permissionGranted = await syncSubscriptionNotifications(
                initialSubscriptions,
                'local-device',
                false,
              );
              if (!permissionGranted) {
                setReminderMessage(
                  'Enable notifications in device settings to receive renewal reminders.',
                );
              }
            } catch (error) {
              setReminderMessage(
                `Could not schedule reminders: ${errorMessage(error)}`,
              );
            }
          }
          if (
            !stored ||
            initial.some((tool, index) => tool.colorValue !== stored[index].colorValue)
          ) {
            await saveLocalTools(initial);
          }
          if (!cancelled) {
            setAuthStatus('offline');
            setReady(true);
          }
          return;
        }

        setCloudEnabled(true);
        void client.auth.startAutoRefresh();
        const { data, error } = await client.auth.getSession();
        if (error) throw error;

        const initialUser = data.session?.user;
        if (!initialUser || initialUser.is_anonymous) {
          if (initialUser?.is_anonymous) {
            const { error: signOutError } = await client.auth.signOut();
            if (signOutError) throw signOutError;
          }
          if (!cancelled) setAuthStatus('signedOut');
        } else {
          const version = ++authEventVersion;
          await hydrateUser(initialUser, version);
        }

        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) await processAuthCallback(client, initialUrl);
        if (!cancelled) setReady(true);
      } catch (error) {
        if (!cancelled) {
          setReady(true);
          setFatalError(`My Stack could not start: ${errorMessage(error)}`);
        }
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
      unsubscribeAuth?.();
      appStateSubscription.remove();
      linkingSubscription.remove();
      if (client) void client.auth.stopAutoRefresh();
    };
  }, [
    processAuthCallback,
    showTools,
    showSubscriptions,
    syncCurrentTools,
    syncCurrentSubscriptions,
  ]);

  const queueSave = useCallback(
    (next: Tool[]) => {
      const ownerId = userIdRef.current ?? undefined;
      showTools(next);
      saveQueue.current = saveQueue.current.then(async () => {
        try {
          await saveLocalTools(next, ownerId);
        } catch (error) {
          setSyncStatus('error');
          setSyncMessage(`Could not save changes on this device: ${errorMessage(error)}`);
          return;
        }
        await syncCurrentTools(next, ownerId);
      });
    },
    [showTools, syncCurrentTools],
  );

  const addTool = useCallback(
    (tool: Omit<Tool, 'id'>) => {
      const created = { ...tool, id: makeToolId() };
      queueSave([created, ...toolsRef.current]);
      return created;
    },
    [queueSave],
  );
  const updateTool = useCallback(
    (tool: Tool) => {
      queueSave(
        toolsRef.current.map((current) =>
          current.id === tool.id ? tool : current,
        ),
      );
    },
    [queueSave],
  );
  const deleteTool = useCallback(
    (id: string) => {
      queueSave(toolsRef.current.filter((tool) => tool.id !== id));
    },
    [queueSave],
  );
  const toggleFavorite = useCallback(
    (id: string) => {
      queueSave(
        toolsRef.current.map((tool) =>
          tool.id === id ? { ...tool, isFavorite: !tool.isFavorite } : tool,
        ),
      );
    },
    [queueSave],
  );

  const queueSubscriptionSave = useCallback(
    (next: Subscription[], requestPermission: boolean) => {
      const ownerId = userIdRef.current ?? undefined;
      const notificationOwnerId = ownerId ?? 'local-device';
      showSubscriptions(next);
      subscriptionSaveQueue.current = subscriptionSaveQueue.current.then(
        async () => {
          try {
            await saveLocalSubscriptions(next, ownerId);
          } catch (error) {
            setSyncStatus('error');
            setSyncMessage(
              `Could not save subscriptions on this device: ${errorMessage(error)}`,
            );
            return;
          }
          if (next.some((subscription) => subscription.reminderEnabled)) {
            try {
              const permissionGranted =
                await syncSubscriptionNotifications(
                  next,
                  notificationOwnerId,
                  requestPermission,
                );
              setReminderMessage(
                permissionGranted
                  ? ''
                  : 'Notifications are off. Enable them in device settings to receive renewal reminders.',
              );
            } catch (error) {
              setReminderMessage(
                `Could not schedule reminders: ${errorMessage(error)}`,
              );
            }
          } else {
            setReminderMessage('');
            try {
              await clearSubscriptionNotifications(notificationOwnerId);
            } catch (error) {
              setReminderMessage(
                `Could not cancel reminders: ${errorMessage(error)}`,
              );
            }
          }
          await syncCurrentSubscriptions(next, ownerId);
        },
      );
    },
    [showSubscriptions, syncCurrentSubscriptions],
  );

  const addSubscription = useCallback(
    (subscription: Omit<Subscription, 'id'>) => {
      const created = { ...subscription, id: makeSubscriptionId() };
      queueSubscriptionSave(
        [created, ...subscriptionsRef.current],
        subscription.reminderEnabled,
      );
      return created;
    },
    [queueSubscriptionSave],
  );
  const updateSubscription = useCallback(
    (subscription: Subscription) => {
      queueSubscriptionSave(
        subscriptionsRef.current.map((current) =>
          current.id === subscription.id ? subscription : current,
        ),
        subscription.reminderEnabled,
      );
    },
    [queueSubscriptionSave],
  );
  const deleteSubscription = useCallback(
    (id: string) => {
      queueSubscriptionSave(
        subscriptionsRef.current.filter(
          (subscription) => subscription.id !== id,
        ),
        false,
      );
    },
    [queueSubscriptionSave],
  );

  const dark =
    themeMode === 'dark' ||
    (themeMode === 'system' && deviceColorScheme === 'dark');
  const value = useMemo<AppContextValue>(
    () => ({
      tools,
      subscriptions,
      ready,
      fatalError,
      themeMode,
      theme: dark ? darkTheme : lightTheme,
      cloudEnabled,
      authStatus,
      currentUser,
      profile,
      syncStatus,
      syncMessage,
      reminderMessage,
      setThemeMode,
      signInWithEmail,
      signUpWithEmail,
      signInWithProvider,
      signOut,
      completeOnboarding,
      addTool,
      updateTool,
      deleteTool,
      toggleFavorite,
      addSubscription,
      updateSubscription,
      deleteSubscription,
      retrySync,
    }),
    [
      tools,
      subscriptions,
      ready,
      fatalError,
      themeMode,
      dark,
      cloudEnabled,
      authStatus,
      currentUser,
      profile,
      syncStatus,
      syncMessage,
      reminderMessage,
      signInWithEmail,
      signUpWithEmail,
      signInWithProvider,
      signOut,
      completeOnboarding,
      addTool,
      updateTool,
      deleteTool,
      toggleFavorite,
      addSubscription,
      updateSubscription,
      deleteSubscription,
      retrySync,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider.');
  return context;
}
