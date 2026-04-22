/* ══════════════════════════════════════════
   admin.js — Creo · Panneau d'administration
   Chargé uniquement sur admin/admin.html
══════════════════════════════════════════ */
import { supabase } from './supabase.js';
import { state }    from './state.js';
import { formatBytes, uiToast, timeAgo } from './utils.js';

/* ── Constantes ── */
const ROLES  = ['free','pro','equipe','sous-admin','admin'];
const COLORS = {
  free:       'var(--t3)',
  pro:        'var(--blue2)',
  equipe:     'var(--cyan)',
  'sous-admin':'var(--amber)',
  admin:      'var(--red)',
};
const BADGE = r => `<span style="
  display:inline-block;padding:1px 8px;border-radius:99px;
  font-family:'JetBrains Mono',monospace;font-size:.58rem;
  letter-spacing:.08em;text-transform:uppercase;
  background:${COLORS[r]||'var(--t3)'}22;
  color:${COLORS[r]||'var(--t3)'};
  border:1px solid ${COLORS[r]||'var(--t3)'}44;">${r}</span>`;

/* ── State admin ── */
let allUsers   = [];
let allFiles   = [];
let adminRole  = 'free';   // rôle de l'admin connecté
let admFilter  = 'all';

/* ── Init : branché depuis app.js via window.creoAdmin ── */
export async function initAdmin() {
  if (!state.profile) return;
  adminRole = state.profile.type?.toLowerCase() || 'free';

  // Cacher le th Actions pour les sous-admin (pas de modification)
  if (adminRole === 'sous-admin') {
    const th = document.getElementById('adm-actions-th');
    if (th) th.style.display = 'none';
  }

  await Promise.all([loadAdminUsers(), loadAdminStats(), loadAdminLogs()]);
  setupAdminEvents();

  // Ajouter page-admin dans le META de app.js (pour breadcrumb)
  if (window._creoMeta) {
    window._creoMeta.admin = { title: 'ADMINISTRATION', bc: '// gestion du site', btn: '↺ Actualiser' };
  }
}

/* ══ Chargement des utilisateurs ══ */
async function loadAdminUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, email, first_name, last_name, type, created_at, avatar_url')
    .order('created_at', { ascending: false });

  if (error) { uiToast('error', 'Erreur chargement users'); return; }
  allUsers = data || [];

  // Charger les stats fichiers par user en batch
  const userIds = allUsers.map(u => u.id);
  const { data: filesData } = await supabase
    .from('files')
    .select('user_id, size_bytes')
    .in('user_id', userIds);

  allFiles = filesData || [];

  // Calculer par user
  const statsMap = {};
  for (const f of allFiles) {
    if (!statsMap[f.user_id]) statsMap[f.user_id] = { count: 0, size: 0 };
    statsMap[f.user_id].count++;
    statsMap[f.user_id].size += f.size_bytes || 0;
  }
  allUsers.forEach(u => { u._stats = statsMap[u.id] || { count: 0, size: 0 }; });

  renderAdminUsers();
}

/* ══ Stats globales ══ */
async function loadAdminStats() {
  const totalUsers = allUsers.length;
  const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const newUsers   = allUsers.filter(u => u.created_at > oneWeekAgo).length;

  // Actifs = users ayant uploadé un fichier cette semaine
  const { data: recentFiles } = await supabase
    .from('files')
    .select('user_id, size_bytes')
    .gte('created_at', oneWeekAgo);

  const activeSet = new Set((recentFiles || []).map(f => f.user_id));
  const totalFiles = allFiles.length;
  const totalSize  = allFiles.reduce((s, f) => s + (f.size_bytes || 0), 0);

  _t('adm-total-users', totalUsers.toLocaleString('fr'));
  _t('adm-new-users',   `+${newUsers} cette semaine`);
  _t('adm-total-files', totalFiles.toLocaleString('fr'));
  _t('adm-total-size',  formatBytes(totalSize));
  _t('adm-active-users', activeSet.size.toLocaleString('fr'));
  _t('adm-storage',     formatBytes(totalSize));
}

/* ══ Logs d'activité ══ */
async function loadAdminLogs() {
  const { data } = await supabase
    .from('notifications')
    .select('created_at, user_id, text, color')
    .order('created_at', { ascending: false })
    .limit(50);

  const tbody = document.getElementById('adm-logs-tbody');
  if (!tbody) return;

  if (!data?.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="table-empty">Aucun log disponible.</td></tr>`;
    return;
  }

  // Créer une map user_id → username
  const uidMap = {};
  allUsers.forEach(u => { uidMap[u.id] = u.username || u.email?.split('@')[0] || '?'; });

  tbody.innerHTML = data.map(log => {
    const date = new Date(log.created_at).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
    const user = uidMap[log.user_id] || log.user_id?.slice(0, 8) || '—';
    const dot = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;
      background:${log.color || 'var(--t3)'};margin-right:6px;flex-shrink:0;"></span>`;
    return `<tr>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--t3);">${date}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.74rem;color:var(--blue2);">@${user}</td>
      <td><div style="display:flex;align-items:center;">${dot}<span style="font-size:.8rem;">${log.text || '—'}</span></div></td>
      <td></td>
    </tr>`;
  }).join('');
}

/* ══ Rendu table utilisateurs ══ */
function renderAdminUsers() {
  const tbody  = document.getElementById('adm-users-tbody');
  if (!tbody) return;

  const q = (document.getElementById('adm-search')?.value || '').toLowerCase();
  let users = allUsers;

  if (admFilter !== 'all') {
    users = users.filter(u => (u.type || 'free').toLowerCase() === admFilter);
  }
  if (q) {
    users = users.filter(u =>
      (u.username || '').toLowerCase().includes(q) ||
      (u.email    || '').toLowerCase().includes(q) ||
      (u.first_name || '').toLowerCase().includes(q) ||
      (u.last_name  || '').toLowerCase().includes(q)
    );
  }

  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty">Aucun utilisateur trouvé.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || `@${u.username || '?'}`;
    const role = (u.type || 'free').toLowerCase();
    const date = new Date(u.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
    const av = u.avatar_url
      ? `<img src="${u.avatar_url}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;">`
      : `<div style="width:28px;height:28px;border-radius:50%;background:var(--d4);border:1px solid var(--b2);
           display:flex;align-items:center;justify-content:center;font-size:.68rem;color:var(--t3);flex-shrink:0;">
           ${(u.first_name?.[0] || u.username?.[0] || '?').toUpperCase()}</div>`;

    // Actions : seulement admin complet (pas sous-admin)
    const canAct = adminRole === 'admin';
    const actionsHtml = canAct ? `
      <div style="display:flex;gap:4px;flex-wrap:wrap;">
        <select class="adm-role-sel" data-uid="${u.id}" style="
          background:var(--d4);border:1px solid var(--b2);border-radius:var(--r);
          padding:3px 6px;color:var(--t1);font-size:.7rem;cursor:pointer;outline:none;">
          ${ROLES.map(r => `<option value="${r}" ${r === role ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
        <button class="btn btn-ghost btn-xs adm-ban-btn" data-uid="${u.id}" data-name="${name}"
          title="Bannir / Supprimer" style="color:var(--red);border-color:rgba(255,59,92,.3);">✕</button>
      </div>` : `<span style="font-size:.72rem;color:var(--t3);">lecture seule</span>`;

    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          ${av}
          <div>
            <div style="font-size:.84rem;color:var(--t1);">${name}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:.66rem;color:var(--t3);">@${u.username || '—'}</div>
          </div>
        </div>
      </td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.72rem;color:var(--t2);">${u.email || '—'}</td>
      <td>${BADGE(role)}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.74rem;color:var(--t2);">${u._stats.count}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.74rem;color:var(--t2);">${formatBytes(u._stats.size)}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--t3);">${date}</td>
      <td${adminRole === 'sous-admin' ? ' style="display:none;"' : ''}>${actionsHtml}</td>
    </tr>`;
  }).join('');

  // Attacher les events sur les selects de rôle et boutons ban
  if (adminRole === 'admin') {
    tbody.querySelectorAll('.adm-role-sel').forEach(sel => {
      sel.addEventListener('change', async function() {
        await changeUserRole(this.dataset.uid, this.value);
      });
    });
    tbody.querySelectorAll('.adm-ban-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        banUser(this.dataset.uid, this.dataset.name);
      });
    });
  }
}

/* ══ Changer le rôle d'un utilisateur ══ */
async function changeUserRole(userId, newRole) {
  if (userId === state.session?.user?.id) {
    uiToast('error', 'Tu ne peux pas changer ton propre rôle.');
    renderAdminUsers(); // reset le select
    return;
  }
  const { error } = await supabase
    .from('profiles')
    .update({ type: newRole })
    .eq('id', userId);

  if (error) { uiToast('error', 'Erreur modification rôle'); return; }

  // Mettre à jour localement
  const u = allUsers.find(x => x.id === userId);
  if (u) u.type = newRole;
  uiToast('success', `✓ Rôle changé → ${newRole}`);
  renderAdminUsers();

  // Logger l'action
  await logAdminAction(`Rôle changé → ${newRole}`, `user: ${u?.username || userId}`);
}

/* ══ Bannir / supprimer un utilisateur ══ */
async function banUser(userId, name) {
  if (userId === state.session?.user?.id) {
    uiToast('error', 'Tu ne peux pas te bannir toi-même.');
    return;
  }
  if (!confirm(`Supprimer le compte de "${name}" ?\nSes fichiers seront aussi supprimés. Cette action est irréversible.`)) return;

  // Supprimer les fichiers de l'utilisateur
  const { data: userFiles } = await supabase
    .from('files').select('storage_path').eq('user_id', userId);

  for (const f of (userFiles || [])) {
    if (f.storage_path) await supabase.storage.from('creo-files').remove([f.storage_path]);
  }
  await supabase.from('files').delete().eq('user_id', userId);
  await supabase.from('devices').delete().eq('user_id', userId);
  await supabase.from('profiles').delete().eq('id', userId);

  allUsers = allUsers.filter(u => u.id !== userId);
  uiToast('success', `✓ Compte "${name}" supprimé`);
  renderAdminUsers();
  loadAdminStats();
  await logAdminAction(`Compte supprimé`, `user: ${name}`);
}

/* ══ Logger une action admin ══ */
async function logAdminAction(action, detail = '') {
  await supabase.from('notifications').insert({
    user_id: state.session.user.id,
    text: `[ADMIN] ${action}${detail ? ' — ' + detail : ''}`,
    color: 'var(--red)',
    read: false,
  });
}

/* ══ Events ══ */
function setupAdminEvents() {
  // Filtres
  document.querySelectorAll('.adm-filter').forEach(chip => {
    chip.addEventListener('click', function() {
      document.querySelectorAll('.adm-filter').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      admFilter = this.dataset.filter;
      renderAdminUsers();
    });
  });

  // Recherche
  document.getElementById('adm-search')?.addEventListener('input', () => renderAdminUsers());

  // Actualiser logs
  document.getElementById('adm-refresh-logs')?.addEventListener('click', async () => {
    await loadAdminLogs();
    uiToast('info', 'Logs actualisés');
  });

  // Brancher la page admin dans showPage
  _hookShowPage();
}

/* ══ Hook showPage pour déclencher init à l'affichage ══ */
let _adminInited = false;
function _hookShowPage() {
  const orig = window.showPage;
  window.showPage = function(id, el) {
    orig(id, el);
    if (id === 'admin' && !_adminInited) {
      _adminInited = true;
      initAdmin();
    } else if (id === 'admin') {
      loadAdminStats();
      renderAdminUsers();
    }
  };
}

/* ── Helpers ── */
function _t(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }

/* ══ Auto-init : déclencher quand app.js a fini ══ */
// On attend que state.profile soit disponible via un poll léger
let _waitCount = 0;
const _waitProfile = setInterval(() => {
  _waitCount++;
  if (state.profile) {
    clearInterval(_waitProfile);
    _hookShowPage();
  }
  if (_waitCount > 40) clearInterval(_waitProfile); // timeout 4s
}, 100);
