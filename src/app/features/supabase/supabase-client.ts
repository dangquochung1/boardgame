import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  if (!environment.supabaseUrl || !environment.supabaseAnonKey) {
    // Allow the app to compile even before keys are configured.
    // The runtime error will be clearer when you try to create/join a room.
    throw new Error(
      'Missing Supabase config. Set window.__SUPABASE_URL__ and window.__SUPABASE_ANON_KEY__.'
    );
  }

  client = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
    auth: {
      persistSession: true
    }
  });

  return client;
}

