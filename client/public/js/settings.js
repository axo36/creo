/* settings.js */
import { supabase } from './supabase.js';
import { state }    from './state.js';
import { uiToast }  from './utils.js';

/* ── Traductions ── */
const LANGS = {
  fr: {
    plan_free:'Gratuit', plan_pro:'Pro', plan_business:'Business',
    save:'✓ Enregistrer', saved:'✓ Profil sauvegardé !',
    pw_changed:'✓ Mot de passe modifié !', pw_min:'Min 6 caractères.',
    pw_mismatch:'Les mots de passe ne correspondent pas.',
    avatar_updated:'✓ Avatar mis à jour !', avatar_removed:'Avatar supprimé.',
    lang_saved:'✓ Langue sauvegardée', notif_saved:'✓ Notifications sauvegardées',
    network_saved:'✓ Réseau appliqué', cache_cleared:'✓ Cache vidé',
    code_changed:'✓ Code client changé — tous tes fichiers ont été mis à jour.',
    code_min:'Le code doit faire au moins 4 caractères.',
    code_taken:'Ce code est déjà utilisé.',
    pseudo_taken:'Pseudo déjà pris.', pseudo_min:'Pseudo trop court (min 3 car.)',
    name_required:'Prénom et nom requis.',
  },
  en: {
    plan_free:'Free', plan_pro:'Pro', plan_business:'Business',
    save:'✓ Save', saved:'✓ Profile saved!',
    pw_changed:'✓ Password changed!', pw_min:'Min 6 characters.',
    pw_mismatch:'Passwords do not match.',
    avatar_updated:'✓ Avatar updated!', avatar_removed:'Avatar removed.',
    lang_saved:'✓ Language saved', notif_saved:'✓ Notifications saved',
    network_saved:'✓ Network settings applied', cache_cleared:'✓ Cache cleared',
    code_changed:'✓ Client code changed — all your files updated.',
    code_min:'Code must be at least 4 characters.',
    code_taken:'This code is already in use.',
    pseudo_taken:'Username already taken.', pseudo_min:'Username too short (min 3 chars)',
    name_required:'First and last name required.',
  },
  es: {
    plan_free:'Gratis', plan_pro:'Pro', plan_business:'Empresa',
    save:'✓ Guardar', saved:'✓ ¡Perfil guardado!',
    pw_changed:'✓ ¡Contraseña cambiada!', pw_min:'Mín. 6 caracteres.',
    pw_mismatch:'Las contraseñas no coinciden.',
    avatar_updated:'✓ ¡Avatar actualizado!', avatar_removed:'Avatar eliminado.',
    lang_saved:'✓ Idioma guardado', notif_saved:'✓ Notificaciones guardadas',
    network_saved:'✓ Red aplicada', cache_cleared:'✓ Caché vaciada',
    code_changed:'✓ Código de cliente cambiado.',
    code_min:'El código debe tener al menos 4 caracteres.',
    code_taken:'Este código ya está en uso.',
    pseudo_taken:'Nombre de usuario ya tomado.', pseudo_min:'Demasiado corto (mín 3 car.)',
    name_required:'Nombre y apellido requeridos.',
  },
  de: {
    plan_free:'Kostenlos', plan_pro:'Pro', plan_business:'Business',
    save:'✓ Speichern', saved:'✓ Profil gespeichert!',
    pw_changed:'✓ Passwort geändert!', pw_min:'Mind. 6 Zeichen.',
    pw_mismatch:'Passwörter stimmen nicht überein.',
    avatar_updated:'✓ Avatar aktualisiert!', avatar_removed:'Avatar entfernt.',
    lang_saved:'✓ Sprache gespeichert', notif_saved:'✓ Benachrichtigungen gespeichert',
    network_saved:'✓ Netzwerk angewendet', cache_cleared:'✓ Cache geleert',
    code_changed:'✓ Kundencode geändert.',
    code_min:'Code muss mindestens 4 Zeichen haben.',
    code_taken:'Dieser Code wird bereits verwendet.',
    pseudo_taken:'Benutzername bereits vergeben.', pseudo_min:'Zu kurz (min 3 Zeichen)',
    name_required:'Vor- und Nachname erforderlich.',
  },
  pt: {
    plan_free:'Gratuito', plan_pro:'Pro', plan_business:'Empresa',
    save:'✓ Salvar', saved:'✓ Perfil salvo!',
    pw_changed:'✓ Senha alterada!', pw_min:'Mín. 6 caracteres.',
    pw_mismatch:'As senhas não coincidem.',
    avatar_updated:'✓ Avatar atualizado!', avatar_removed:'Avatar removido.',
    lang_saved:'✓ Idioma salvo', notif_saved:'✓ Notificações salvas',
    network_saved:'✓ Rede aplicada', cache_cleared:'✓ Cache limpo',
    code_changed:'✓ Código de cliente alterado.',
    code_min:'O código deve ter pelo menos 4 caracteres.',
    code_taken:'Este código já está em uso.',
    pseudo_taken:'Nome de usuário já em uso.', pseudo_min:'Muito curto (mín 3 car.)',
    name_required:'Nome e sobrenome obrigatórios.',
  },
  ja: {
    plan_free:'無料', plan_pro:'プロ', plan_business:'ビジネス',
    save:'✓ 保存', saved:'✓ プロフィール保存完了！',
    pw_changed:'✓ パスワード変更完了！', pw_min:'6文字以上必要です。',
    pw_mismatch:'パスワードが一致しません。',
    avatar_updated:'✓ アバター更新完了！', avatar_removed:'アバターを削除しました。',
    lang_saved:'✓ 言語を保存しました', notif_saved:'✓ 通知を保存しました',
    network_saved:'✓ ネットワーク設定を適用しました', cache_cleared:'✓ キャッシュを消去しました',
    code_changed:'✓ クライアントコードが変更されました。',
    code_min:'コードは4文字以上必要です。',
    code_taken:'このコードはすでに使用されています。',
    pseudo_taken:'このユーザー名は使用中です。', pseudo_min:'短すぎます（3文字以上）',
    name_required:'名前と苗字は必須です。',
  },
};

function t(key) {
  const lang = state.currentLang || 'fr';
  return (LANGS[lang] || LANGS.fr)[key] || LANGS.fr[key] || key;
}

/* ── Forfaits ── */
const PLANS = {
  free:     { label:'Gratuit / Free',   storage:1,  color:'var(--green)',  price:'0€' },
  pro:      { label:'Pro',              storage:50, color:'var(--blue2)',  price:'4.99€/mois' },
  business: { label:'Business',         storage:500,color:'var(--amber)',  price:'19.99€/mois' },
};

export function renderSettings() {
  _set('settings-code', state.profile?.client_code || '—');
  const plan = PLANS[state.profile?.type] || PLANS.free;
  const planEl = document.getElementById('settings-plan');
  if (planEl) { planEl.textContent = plan.label; planEl.style.color = plan.color; }

  _val('s-firstname', state.profile?.first_name || '');
  _val('s-lastname',  state.profile?.last_name  || '');
  _val('s-email',     state.profile?.email || state.session?.user?.email || '');
  _val('s-username',  state.profile?.username || '');
  _set('s-session-email', state.session?.user?.email || '');

  // Stockage max selon forfait
  const maxGB = PLANS[state.profile?.type]?.storage || 1;
  const usedB = state.files.filter(f=>f.status==='done').reduce((s,f)=>s+(f.size_bytes||0),0);
  const usedGB = (usedB/1e9).toFixed(3);
  const usedPct = Math.min(100, Math.round(usedB/(maxGB*1e9)*100));
  const storEl = document.getElementById('storage-bar-section');
  if (storEl) {
    const color = usedPct>=90?'var(--red)':usedPct>=70?'var(--amber)':'var(--green)';
    storEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:.8rem;">
        <span style="color:var(--t2);">Stockage utilisé</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:.72rem;color:${color};">${usedGB} GB / ${maxGB} GB (${usedPct}%)</span>
      </div>
      <div style="height:6px;background:var(--d5);border-radius:99px;overflow:hidden;">
        <div style="width:${usedPct}%;height:100%;background:${color};border-radius:99px;transition:width .5s;"></div>
      </div>
      ${usedPct>=90?`<div style="font-size:.75rem;color:var(--red);margin-top:5px;">⚠ Stockage presque plein — <a href="#" onclick="window.creo.openUpgrade()" style="color:var(--blue2);">Passer à Pro</a></div>`:''}`;
  }

  // Avatar
  const av = state.profile?.avatar_url;
  const avEl = document.getElementById('settings-avatar');
  if (avEl) {
    if (av) avEl.innerHTML = `<img src="${av}" alt=""><div class="avatar-overlay">📷</div>`;
    else    avEl.innerHTML = `<span id="settings-avatar-initials">${initials()}</span><div class="avatar-overlay">📷</div>`;
  }

  // Lang buttons
  document.querySelectorAll('.lang-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.lang === state.currentLang)
  );

  // Bouton save
  const saveBtn = document.getElementById('btn-save-profile');
  if (saveBtn) saveBtn.textContent = t('save');

  // Plan section upgrade
  renderPlanSection();
}

function renderPlanSection() {
  const planSection = document.getElementById('plan-upgrade-section');
  if (!planSection) return;
  const current = state.profile?.type || 'free';
  const currentPlan = PLANS[current] || PLANS.free;

  planSection.innerHTML = `
    <div style="margin-bottom:1.2rem;">
      <div style="font-size:.82rem;color:var(--t2);margin-bottom:.8rem;">
        Forfait actuel : <strong style="color:${currentPlan.color};">${currentPlan.label}</strong>
        · Stockage : ${currentPlan.storage} GB
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;" id="plan-cards-grid">
      ${Object.entries(PLANS).map(([key, p]) => {
        const isCurrent = key === current;
        return `<div style="background:${isCurrent?'rgba(26,111,255,.08)':'var(--d3)'};border:1px solid ${isCurrent?'rgba(26,111,255,.3)':'var(--b2)'};border-radius:var(--r-xl);padding:1.2rem;text-align:center;">
          <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--t3);text-transform:uppercase;margin-bottom:.4rem;">${p.label}</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.8rem;color:${p.color};line-height:1;margin-bottom:.3rem;">${p.storage} GB</div>
          <div style="font-size:.75rem;color:var(--t3);margin-bottom:.8rem;">${p.price}</div>
          ${isCurrent
            ? `<span style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:${p.color};border:1px solid ${p.color};padding:3px 10px;border-radius:99px;">Actuel</span>`
            : `<button class="btn btn-primary btn-sm" onclick="window.creo.upgradePlan('${key}')">Choisir</button>`}
        </div>`;
      }).join('')}
    </div>
    <div style="font-size:.74rem;color:var(--t3);margin-top:.8rem;text-align:center;">Toutes les données sont stockées sur Supabase. Le forfait Free est entièrement fonctionnel.</div>`;
}

export async function upgradePlan(planKey) {
  if (!PLANS[planKey]) return;
  const plan = PLANS[planKey];
  if (!confirm(`Passer au forfait ${plan.label} (${plan.price}) ?`)) return;
  const { error } = await supabase.from('profiles').update({ type: planKey }).eq('id', state.session.user.id);
  if (error) { uiToast('error', error.message); return; }
  state.profile.type = planKey;
  renderSettings();
  uiToast('success', `✓ Forfait ${plan.label} activé !`);
}

export async function saveProfile() {
  const btn   = document.getElementById('btn-save-profile');
  const first = document.getElementById('s-firstname').value.trim();
  const last  = document.getElementById('s-lastname').value.trim();
  const uname = document.getElementById('s-username').value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!first || !last) return uiToast('warning', t('name_required'));
  if (uname && uname.length < 3) return uiToast('warning', t('pseudo_min'));
  btn.classList.add('btn-loading');
  const { error } = await supabase.from('profiles').update({
    first_name: first, last_name: last, username: uname || state.profile.username,
  }).eq('id', state.session.user.id);
  btn.classList.remove('btn-loading');
  if (error) return uiToast('error', error.message.includes('username') ? t('pseudo_taken') : error.message);
  state.profile = { ...state.profile, first_name: first, last_name: last, username: uname || state.profile.username };
  uiToast('success', t('saved'));
}

/* ── Changer le code client — migre tous les fichiers ── */
export async function changeClientCode() {
  const input = document.getElementById('s-new-code');
  const newCode = (input?.value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (newCode.length < 4) { uiToast('warning', t('code_min')); return; }
  if (newCode === state.profile.client_code) { uiToast('info', 'Même code, rien à changer.'); return; }

  // Vérifier unicité
  const { data: existing } = await supabase.from('profiles').select('id').eq('client_code', newCode).maybeSingle();
  if (existing) { uiToast('error', t('code_taken')); return; }

  const btn = document.getElementById('btn-change-code');
  btn?.classList.add('btn-loading');

  // Mettre à jour le profil
  const { error } = await supabase.from('profiles').update({ client_code: newCode }).eq('id', state.session.user.id);
  if (error) { btn?.classList.remove('btn-loading'); uiToast('error', error.message); return; }

  // Mettre à jour les share_codes de tous les fichiers qui utilisaient l'ancien code
  // (On ne migre pas les codes individuels, on met juste à jour le code profil)
  state.profile.client_code = newCode;
  btn?.classList.remove('btn-loading');
  if (input) input.value = '';
  renderSettings();
  uiToast('success', t('code_changed'));
}

export async function changePassword() {
  const np  = document.getElementById('s-pw-new').value;
  const cp  = document.getElementById('s-pw-confirm').value;
  if (!np || np.length < 6) return uiToast('warning', t('pw_min'));
  if (np !== cp)             return uiToast('error', t('pw_mismatch'));
  const btn = document.getElementById('btn-change-pw');
  btn.classList.add('btn-loading');
  const { error } = await supabase.auth.updateUser({ password: np });
  btn.classList.remove('btn-loading');
  if (error) return uiToast('error', error.message);
  uiToast('success', t('pw_changed'));
  document.getElementById('s-pw-new').value = '';
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
  if (error) { if (prog) prog.style.display = 'none'; uiToast('error', error.message); return; }
  if (fill) fill.style.width = '90%';
  const { data: ud } = supabase.storage.from('avatars').getPublicUrl(path);
  const url = ud.publicUrl + '?t=' + Date.now();
  await supabase.from('profiles').update({ avatar_url: url }).eq('id', state.session.user.id);
  state.profile.avatar_url = url;
  if (fill) { fill.style.width = '100%'; setTimeout(() => { prog.style.display = 'none'; fill.style.width = '0%'; }, 600); }
  uiToast('success', t('avatar_updated'));
}

export async function removeAvatar() {
  await supabase.from('profiles').update({ avatar_url: null }).eq('id', state.session.user.id);
  state.profile.avatar_url = null;
  uiToast('success', t('avatar_removed'));
}

export async function setLang(lang) {
  state.currentLang = lang;
  localStorage.setItem('creo_lang', lang);
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
  await supabase.from('profiles').update({ lang }).eq('id', state.session.user.id);
  uiToast('success', t('lang_saved'));
  // Re-render pour appliquer les traductions
  renderSettings();
}

export async function saveNotifSettings() {
  state.notifSettings.done   = document.getElementById('notif-done')?.classList.contains('on')  ?? true;
  state.notifSettings.error  = document.getElementById('notif-error')?.classList.contains('on') ?? true;
  state.notifSettings.start  = document.getElementById('notif-start')?.classList.contains('on') ?? false;
  state.notifSettings.device = document.getElementById('notif-device')?.classList.contains('on') ?? true;
  await supabase.from('profiles').update({ notif_settings: JSON.stringify(state.notifSettings) }).eq('id', state.session.user.id);
  uiToast('success', t('notif_saved'));
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

function _set(id, v)  { const el = document.getElementById(id); if (el) el.textContent = v; }
function _val(id, v)  { const el = document.getElementById(id); if (el) el.value = v; }
function capitalize(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function initials() {
  const name = state.profile?.first_name && state.profile?.last_name
    ? `${state.profile.first_name} ${state.profile.last_name}`
    : state.profile?.username || state.session?.user?.email?.split('@')[0] || '?';
  return name.split(' ').map(w => w[0] || '').slice(0, 2).join('').toUpperCase() || '?';
}
