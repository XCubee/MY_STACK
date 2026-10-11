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
import type { SupabaseClient } from '@supabase/supabase-js';
import { sampleTools } from '../data/sampleTools';
import {
  makeToolId,
  normalizeToolColor,
  toolFromRow,
  toolToRow,
  type Tool,
} from '../domain/tool';
import {
  clearCloudSyncPending,
  hasPendingCloudSync,
  loadLocalTools,
  markCloudSyncPending,
  saveLocalTools,
} from '../services/toolStorage';
import { createSupabaseClient } from '../services/supabase';
import {
  darkTheme,
  lightTheme,
  type AppTheme,
  type ThemeMode,
} from '../theme';

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

type AppContextValue = {
  tools: Tool[];
  ready: boolean;
  fatalError: string | null;
  themeMode: ThemeMode;
  theme: AppTheme;
  cloudEnabled: boolean;
  syncStatus: SyncStatus;
  syncMessage: string;
  setThemeMode: (mode: ThemeMode) => void;
  addTool: (tool: Omit<Tool, 'id'>) => Tool;
  updateTool: (tool: Tool) => void;
  deleteTool: (id: string) => void;
  toggleFavorite: (id: string) => void;
  retrySync: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

function mergeTools(local: Tool[], cloud: Tool[], localWins: boolean): Tool[] {
  const merged = new Map<string, Tool>();
  const ordered = localWins ? [...cloud, ...local] : [...local, ...cloud];
  for (const tool of ordered) merged.set(tool.id, tool);
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

export function AppProvider({ children }: PropsWithChildren) {
  const deviceColorScheme = useColorScheme();
  const [tools, setTools] = useState<Tool[]>([]);
  const [ready, setReady] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const [syncMessage, setSyncMessage] = useState(
    'Saved on this device. Add Supabase settings to enable cloud sync.',
  );
  const toolsRef = useRef<Tool[]>([]);
  const clientRef = useRef<SupabaseClient | null>(null);
  const userIdRef = useRef<string | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const showTools = useCallback((next: Tool[]) => {
    toolsRef.current = next;
    setTools(next);
  }, []);

  const syncCurrentTools = useCallback(
    async (next: Tool[]) => {
      const client = clientRef.current;
      if (!client) {
        setSyncStatus('local');
        setSyncMessage(
          'Saved on this device. Add Supabase settings to enable cloud sync.',
        );
        return;
      }

      setSyncStatus('syncing');
      setSyncMessage('Syncing your library…');
      try {
        let userId = userIdRef.current;
        if (!userId) {
          const { data: sessionData, error: sessionError } =
            await client.auth.getSession();
          if (sessionError) throw sessionError;
          userId = sessionData.session?.user.id ?? null;
          if (!userId) {
            const { data, error } = await client.auth.signInAnonymously();
            if (error) throw error;
            userId = data.user?.id ?? null;
          }
          if (!userId) throw new Error('Anonymous session has no user ID.');
          userIdRef.current = userId;
        }
        await markCloudSyncPending();
        await replaceCloudTools(client, userId, next);
        await clearCloudSyncPending();
        setSyncStatus('synced');
        setSyncMessage('Cloud sync is up to date.');
      } catch {
        setSyncStatus('error');
        setSyncMessage(
          'Saved on this device, but cloud sync failed. Check your connection; changes will retry when you save again or reopen the app.',
        );
      }
    },
    [],
  );

  const retrySync = useCallback(async () => {
    if (!clientRef.current) {
      setSyncStatus('local');
      setSyncMessage(
        'Cloud sync is not configured. Saved changes remain on this device.',
      );
      return;
    }
    await syncCurrentTools(toolsRef.current);
  }, [syncCurrentTools]);

  useEffect(() => {
    let cancelled = false;
    const appStateSubscription = AppState.addEventListener(
      'change',
      (state) => {
        const client = clientRef.current;
        if (!client) return;
        if (state === 'active') void client.auth.startAutoRefresh();
        else void client.auth.stopAutoRefresh();
      },
    );

    const bootstrap = async () => {
      try {
        const stored = await loadLocalTools();
        const initial =
          stored?.map((tool) => ({
            ...tool,
            colorValue: normalizeToolColor(tool.colorValue),
          })) ?? sampleTools;
        showTools(initial);
        if (!stored || initial.some((tool, index) => tool.colorValue !== stored[index].colorValue)) {
          await saveLocalTools(initial);
        }
        if (!cancelled) setReady(true);

        const client = createSupabaseClient();
        clientRef.current = client;
        if (!client) {
          if (cancelled) return;
          setSyncStatus('local');
          setSyncMessage(
            'Saved on this device. Add Supabase settings to enable cloud sync.',
          );
          return;
        }
        void client.auth.startAutoRefresh();
        setCloudEnabled(true);

        if (!cancelled) {
          setSyncStatus('syncing');
          setSyncMessage('Connecting to your private cloud library…');
        }
        const { data: sessionData, error: sessionError } =
          await client.auth.getSession();
        if (sessionError) throw sessionError;
        let userId = sessionData.session?.user.id;
        if (!userId) {
          const { data, error } = await client.auth.signInAnonymously();
          if (error) throw error;
          userId = data.user?.id;
        }
        if (!userId) throw new Error('Anonymous session has no user ID.');
        userIdRef.current = userId;

        const { data: rows, error: readError } = await client
          .from('tools')
          .select('*')
          .eq('user_id', userId);
        if (readError) throw readError;

        const cloudTools = (rows ?? []).map((row) => toolFromRow(row));
        const pending = await hasPendingCloudSync();
        const merged = pending
          ? initial
          : mergeTools(initial, cloudTools, false);
        showTools(merged);
        await saveLocalTools(merged);
        await syncCurrentTools(merged);
      } catch {
        if (!cancelled) {
          setReady(true);
          setSyncStatus('error');
          setSyncMessage(
            'Your library is available locally, but cloud setup or sync failed. Check the settings and try again.',
          );
          if (toolsRef.current.length === 0) {
            setFatalError(
              'Could not read saved data. Restart the app and try again.',
            );
          }
        }
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
      appStateSubscription.remove();
      if (clientRef.current) void clientRef.current.auth.stopAutoRefresh();
    };
  }, [showTools, syncCurrentTools]);

  const queueSave = useCallback(
    (next: Tool[]) => {
      showTools(next);
      saveQueue.current = saveQueue.current.then(async () => {
        try {
          await saveLocalTools(next);
        } catch {
          setSyncStatus('error');
          setSyncMessage('Could not save changes on this device.');
          return;
        }
        await syncCurrentTools(next);
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

  const dark =
    themeMode === 'dark' ||
    (themeMode === 'system' && deviceColorScheme === 'dark');
  const value = useMemo<AppContextValue>(
    () => ({
      tools,
      ready,
      fatalError,
      themeMode,
      theme: dark ? darkTheme : lightTheme,
      cloudEnabled,
      syncStatus,
      syncMessage,
      setThemeMode,
      addTool,
      updateTool,
      deleteTool,
      toggleFavorite,
      retrySync,
    }),
    [
      tools,
      ready,
      fatalError,
      themeMode,
      dark,
      cloudEnabled,
      syncStatus,
      syncMessage,
      addTool,
      updateTool,
      deleteTool,
      toggleFavorite,
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
