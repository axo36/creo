/* ══ data.js — chargement données Supabase ══ */
import { supabase } from './supabase.js';
import { state } from './state.js';

export async function loadFiles() {
  const { data } = await supabase
    .from('files').select('*')
    .eq('user_id', state.session.user.id)
    .order('created_at', { ascending: false });
  state.files = data || [];
}

export async function loadDevices() {
  const { data } = await supabase
    .from('devices').select('*')
    .eq('user_id', state.session.user.id)
    .order('last_seen', { ascending: false });
  state.devices = data || [];
}

export async function loadSyncRules() {
  const { data } = await supabase
    .from('sync_rules').select('*')
    .eq('user_id', state.session.user.id)
    .order('created_at', { ascending: false });
  state.syncRules = data || [];
}

export async function loadSyncLog() {
  const { data } = await supabase
    .from('sync_log').select('*')
    .eq('user_id', state.session.user.id)
    .order('created_at', { ascending: false })
    .limit(20);
  state.syncLog = data || [];
}

export function setupRealtime(onFilesChange, onDevicesChange) {
  supabase.channel('rt-files')
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'files',
      filter: `user_id=eq.${state.session.user.id}`
    }, async () => { await loadFiles(); onFilesChange(); })
    .subscribe();

  supabase.channel('rt-devices')
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'devices',
      filter: `user_id=eq.${state.session.user.id}`
    }, async () => { await loadDevices(); onDevicesChange(); })
    .subscribe();
}
