import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  'https://mock-tamspeak.supabase.co';

const SUPABASE_ANON_KEY = (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  'mock-anon-key-tamspeak-2026';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const isSupabaseConfigured = (): boolean => {
  return (
    SUPABASE_URL !== 'https://mock-tamspeak.supabase.co' &&
    !SUPABASE_URL.includes('mock-tamspeak') &&
    SUPABASE_ANON_KEY !== 'mock-anon-key-tamspeak-2026' &&
    SUPABASE_ANON_KEY.length > 20
  );
};

