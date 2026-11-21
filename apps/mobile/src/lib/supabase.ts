import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/app-config';
import { chunkedSecureStore } from './secure-store-adapter';

let client: SupabaseClient | undefined;

// Created lazily so dev (mock mode) never needs Supabase settings.
export const getSupabase = (): SupabaseClient => {
  if (!client) {
    if (!config.supabaseUrl || !config.supabaseAnonKey) throw new Error('Supabase is not configured');
    client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { storage: chunkedSecureStore, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    });
  }
  return client;
};
