import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

export const cloudConfigured = Boolean(supabaseUrl && supabaseKey);

export function createSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl && !supabaseKey) return null;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Both Supabase URL and publishable key are required.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error('Supabase URL is invalid.');
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error('Supabase URL must use HTTPS.');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}
