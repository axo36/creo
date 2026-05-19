/* ══ supabase.js — connexion Supabase ══ */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const URL = "https://mpnfvrizbluhhjcfzztc.supabase.co";
const KEY = "sb_publishable_PMOkki7SEbuv11glUpmNTQ_7KTnMrEr";

const _public  = createClient(URL, KEY, { db: { schema: 'public' } });
const _auth    = createClient(URL, KEY, { db: { schema: '_Utilisateurs_Auth' } });
const _devices = createClient(URL, KEY, { db: { schema: '_Appareils_Agent' } });
const _files   = createClient(URL, KEY, { db: { schema: '_Fichiers_Transferts' } });
const _sync    = createClient(URL, KEY, { db: { schema: '_Synchronisation' } });
const _notif   = createClient(URL, KEY, { db: { schema: '_Notifications_Messagerie' } });
const _app     = createClient(URL, KEY, { db: { schema: '_Application_Analytics' } });

const SCHEMA_MAP = {
  /* _Utilisateurs_Auth */
  profiles:           _auth,
  email_verification: _auth,
  temp_codes:         _auth,
  /* _Appareils_Agent */
  devices:            _devices,
  agent_commands:     _devices,
  admin_devices_view: _devices,
  v_admin_devices:    _devices,
  /* _Fichiers_Transferts */
  files:              _files,
  shared_files:       _files,
  /* _Synchronisation */
  sync_rules:         _sync,
  sync_log:           _sync,
  /* _Notifications_Messagerie */
  notifications:      _notif,
  admin_messages:     _notif,
  /* _Application_Analytics */
  app_downloads:      _app,
  site_visits:        _app,
  site_config:        _app,
};

export const supabase = new Proxy(_public, {
  get(target, prop) {
    if (prop === 'from')    return (table) => (SCHEMA_MAP[table] ?? _public).from(table);
    if (prop === 'auth')    return _public.auth;
    if (prop === 'storage') return _public.storage;
    if (prop === 'channel') return (...a) => _public.channel(...a);
    return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
  }
});
