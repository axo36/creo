/* ══ settings.js — paramètres compte ══ */
import { supabase } from './supabase.js';
import { state } from './state.js';
import { uiToast } from './utils.js';

export function renderSettings() {
  _set('settings-code', state.profile?.client_code || '—');
  _set('settings-plan', capitalize(state.profile?.type) || '—');
  _val('s-firstname', state.profile?.first_name || '');
  _val('s-lastname',  state.profile?.last_name  || '');
  _val('s-email',     state.profile?.email || state.session?.user?.email || '');
  _val('s-username',  state.profile?.username || '');
  _set('s-session-email', state.session?.user?.email || '');

  const av = state.profile?.avatar_url;
  const avEl = document.getElementById('settings-avatar');
  if (avEl) {
    if (av) avEl.innerHTML = `<img src="${av}" alt=""><div class="avatar-overlay">📷</div>`;
    else    avEl.innerHTML = `<span id="settings-avatar-initials">${initials()}</span><div class="avatar-overlay">📷</div>`;
  }
  document.querySelectorAll('.lang-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.lang === state.currentLang)
  );
}

export async function saveProfile() {
  const btn   = document.getElementById('btn-save-profile');
  const first = document.getElementById('s-firstname').value.trim();
  const last  = document.getElementById('s-lastname').value.trim();
  const uname = document.getElementById('s-username').value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!first || !last) return uiToast('warning', 'Prénom et nom requis.');
  if (uname && uname.length < 3) return uiToast('warning', 'Pseudo trop court (min 3 car.)');
  btn.classList.add('btn-loading');
  const { error } = await supabase.from('profiles').update({
    first_name: first, last_name: last, username: uname || state.profile.username,
  }).eq('id', state.session.user.id);
  btn.classList.remove('btn-loading');
  if (error) return uiToast('error', error.message.includes('username') ? 'Pseudo déjà pris.' : error.message);
  state.profile = { ...state.profile, first_name: first, last_name: last, username: uname || state.profile.username };
  uiToast('success', '✓ Profil sauvegardé !');
}

export async function changePassword() {
  const np  = document.getElementById('s-pw-new').value;
  const cp  = document.getElementById('s-pw-confirm').value;
  if (!np || np.length < 6) return uiToast('warning', 'Min 6 caractères.');
  if (np !== cp)             return uiToast('error', 'Les mots de passe ne correspondent pas.');
  const btn = document.getElementById('btn-change-pw');
  btn.classList.add('btn-loading');
  const { error } = await supabase.auth.updateUser({ password: np });
  btn.classList.remove('btn-loading');
  if (error) return uiToast('error', error.message);
  uiToast('success', '✓ Mot de passe modifié !');
  document.getElementById('s-pw-new').value    = '';
  document.getElementById('s-pw-confirm').value = '';
}

export async function uploadAvatar(file) {
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { uiToast('error', 'Max 2 MB'); return; }
  const prog = document.getElementById('avatar-prog');
  const fill = document.getElementById('avatar-prog-fill');
  if (prog) prog.style.display = 'block';
  if (fill) fill.style.width = '30%';
  const ext  = file.name.split('.').pop();
  const path = `${state.session.user.id}/avatar.${ext}`;
  await supabase.storage.from('avatars').remove([path]);
  if (fill) fill.style.width = '60%';
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
  if (error) { if (prog) prog.style.display = 'none'; return uiToast('error', error.message); }
  if (fill) fill.style.width = '90%';
  const { data: ud } = supabase.storage.from('avatars').getPublicUrl(path);
  const url = ud.publicUrl + '?t=' + Date.now();
  await supabase.from('profiles').update({ avatar_url: url }).eq('id', state.session.user.id);
  state.profile.avatar_url = url;
  if (fill) fill.style.width = '100%';
  setTimeout(() => { if (prog) prog.style.display = 'none'; if (fill) fill.style.width = '0%'; }, 600);
  uiToast('success', '✓ Avatar mis à jour !');
}

export async function removeAvatar() {
  await supabase.from('profiles').update({ avatar_url: null }).eq('id', state.session.user.id);
  state.profile.avatar_url = null;
  uiToast('success', 'Avatar supprimé.');
}

export async function setLang(lang) {
  state.currentLang = lang;
  localStorage.setItem('creo_lang', lang);
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
  await supabase.from('profiles').update({ lang }).eq('id', state.session.user.id);
  uiToast('success', '✓ Langue sauvegardée');
}

export async function saveNotifSettings() {
  state.notifSettings.done   = document.getElementById('notif-done')?.classList.contains('on')  ?? true;
  state.notifSettings.error  = document.getElementById('notif-error')?.classList.contains('on') ?? true;
  state.notifSettings.start  = document.getElementById('notif-start')?.classList.contains('on') ?? false;
  state.notifSettings.device = document.getElementById('notif-device')?.classList.contains('on') ?? true;
  await supabase.from('profiles').update({ notif_settings: JSON.stringify(state.notifSettings) }).eq('id', state.session.user.id);
  uiToast('success', '✓ Notifications sauvegardées');
}

export function applyNotifToggles() {
  ['done','error','start','device'].forEach(k => {
    const el = document.getElementById('notif-' + k);
    if (el && state.notifSettings[k]) el.classList.add('on');
    else if (el)                      el.classList.remove('on');
  });
}

export function switchSettingsTab(tabId) {
  document.querySelectorAll('.s-nav-item').forEach(i => i.classList.remove('active'));
  document.querySelectorAll('.settings-panel').forEach(p => p.style.display = 'none');
  document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');
  const p = document.getElementById(tabId);
  if (p) p.style.display = 'block';
}

// Helpers
function _set(id, v)  { const el = document.getElementById(id); if (el) el.textContent = v; }
function _val(id, v)  { const el = document.getElementById(id); if (el) el.value = v; }
function capitalize(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function initials() {
  const name = (() => {
    if (state.profile?.first_name && state.profile?.last_name)
      return `${state.profile.first_name} ${state.profile.last_name}`;
    if (state.profile?.username) return state.profile.username;
    return state.session?.user?.email?.split('@')[0] || '?';
  })();
  return name.split(' ').map(w => w[0] || '').slice(0, 2).join('').toUpperCase() || '?';
}
