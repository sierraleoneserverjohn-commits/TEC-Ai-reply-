// ==============================================================================
// Johnny TEC AI Reply - Supabase Client Module
// Loaded via pinned jsDelivr CDN without npm or build step.
// Handles Supabase Auth session tokens passed as Bearer tokens to backend.
// ==============================================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.48.1/+esm';
import { getActiveSupabaseUrl, getActiveSupabaseKey, isConfigured } from './config.js';

let _supabaseClient = null;

export function getSupabase() {
  if (!isConfigured()) {
    return null;
  }
  const url = getActiveSupabaseUrl();
  const key = getActiveSupabaseKey();

  if (!_supabaseClient || _supabaseClient.supabaseUrl !== url) {
    _supabaseClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }
  return _supabaseClient;
}

export async function getCurrentSession() {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.auth.getSession();
    if (error || !data) return null;
    return data.session;
  } catch (_) {
    return null;
  }
}

export async function getAccessToken() {
  const session = await getCurrentSession();
  return session ? session.access_token : null;
}

export async function signIn(email, password) {
  const client = getSupabase();
  if (!client) throw new Error("App is not configured. Check config.js");
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password: password
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const client = getSupabase();
  if (client) {
    await client.auth.signOut();
  }
}
