/* ══ supabase.js — connexion Supabase avec schemas organisés ══ */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const URL  = "https://mpnfvrizbluhhjcfzztc.supabase.co";
const KEY  = "sb_publishable_PMOkki7SEbuv11glUpmNTQ_7KTnMrEr";

/* ── Un client par schema ── */
const _public  = createClient(URL, KEY, { db: { schema: 'public' } });
const _auth    = createClient(URL, KEY, { db: { schema: '-Utilisateurs_Auth' } });
const _devices = createClient(URL, KEY, { db: { schema: '-Appareils_Agent' } });
const _files   = createClient(URL, KEY, { db: { schema: '-Fichiers_Transferts' } });
const _sync    = createClient(URL, KEY, { db: { schema: '-Synchronisation' } });
const _notif   = createClient(URL, KEY, { db: { schema: '-Notifications_Messagerie' } });
const _app     = createClient(URL, KEY, { db: { schema: '-Application_Analytics' } });

/* ── Mapping table → bon client ── */
const SCHEMA_MAP = {
  // Utilisateurs & Auth
  profiles:           _auth,
  email_verification: _auth,
  temp_codes:         _auth,
  // Appareils & Agent
  devices:            _devices,
  agent_commands:     _devices,
  admin_devices_view: _devices,
  v_admin_devices:    _devices,
  // Fichiers & Transferts
  files:              _files,
  shared_files:       _files,
  // Synchronisation
  sync_rules:         _sync,
  sync_log:           _sync,
  // Notifications & Messagerie
  notifications:      _notif,
  admin_messages:     _notif,
  // Application & Analytics
  app_downloads:      _app,
  site_visits:        _app,
  site_config:        _app,
};

/* ── Proxy : supabase.from('table') trouve automatiquement le bon schema ── */
export const supabase = new Proxy(_public, {
  get(target, prop) {
    if (prop === 'from') {
      return (table) => {
        const client = SCHEMA_MAP[table] ?? _public;
        return client.from(table);
      };
    }
    if (prop === 'channel')  return (...a) => _public.channel(...a);
    if (prop === 'storage')  return _public.storage;
    if (prop === 'auth')     return _public.auth;
    if (prop === 'schema')   return (s) => _public.schema(s);
    return typeof target[prop] === 'function'
      ? target[prop].bind(target)
      : target[prop];
  }
});
