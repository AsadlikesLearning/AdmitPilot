import '../config/env.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

export let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    console.log('[AdmitPilot Supabase] Successfully initialized client for', supabaseUrl);
  } catch (err) {
    console.warn('[AdmitPilot Supabase] Failed to initialize Supabase client:', err);
    supabase = null;
  }
} else {
  console.log('[AdmitPilot Supabase] SUPABASE_URL / key not provided. Falling back to persistent JSON storage.');
}

export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

