import { CONFIG } from './config.js';

export const isSupabaseConfigured = Boolean(CONFIG.supabaseUrl && CONFIG.supabasePublishableKey);
export let supabase = null;

if (isSupabaseConfigured) {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm');
  supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
}

export async function currentUser() {
  if (!supabase) return null;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

export function isStaff(user) {
  return ['admin', 'trainer'].includes(user?.app_metadata?.role);
}

export function isAdmin(user) {
  return user?.app_metadata?.role === 'admin';
}

export function roleLabel(user) {
  const role = user?.app_metadata?.role;
  return role === 'admin' ? 'Administrador' : role === 'trainer' ? 'Entrenador' : 'Usuario';
}
