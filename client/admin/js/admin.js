/* ══════════════════════════════════════════
   admin.js — Creo · Panneau d'administration
   Chargé uniquement sur admin/admin.html
══════════════════════════════════════════ */
import { supabase } from './supabase.js';
import { state }    from './state.js';
import { formatBytes, uiToast, timeAgo } from './utils.js';

const ROLES  = ['free','pro','equipe','sous-admin','admin'];
const COLORS = { free:'var(--t3)', pro:'var(--blue2)', equipe:'var(--cyan)', 'sous-admin':'var(--amber)', admin:'var(--red)' };
const BADGE  = r => `<span style="display:inline-block;padding:1px 9px;border-radius:99px;
  font-family:'JetBrains Mono',monospace;font-size:.58rem;letter-spacing:.06em;text-transform:uppercase;
  background:${COLORS[r]||'var(--t3)'}22;color:${COLORS[r]||'var(--t3)'};
  border:1px solid ${COLORS[r]||'var(--t3)'}44;">${r}</span>`;

let allUsers=[], allFiles=[], allDevices=[];
let adminRole='free', admFilter='all', admTab='users';

/* ══ INIT ══ */
export async function initAdmin() {
  if (!state.profile) return;
  adminRole = state.profile.type?.toLowerCase()||'free';
  if (window._creoMeta) window._creoMeta.admin={title:'ADMINISTRATION',bc:'// contrôle total du site',btn:'↺ Actualiser'};
  renderAdminShell();
  await Promise.all([loadAllUsers(), loadAdminStats()]);
  renderAdminUsers();
  loadAdminLogs();
  setupAdminEvents();
}

/* ══ SHELL HTML ══ */
function renderAdminShell() {
  const page = document.getElementById('page-admin'); if (!page) return;
  page.innerHTML = `
    <div style="display:flex;gap:6px;margin-bottom:1.6rem;flex-wrap:wrap;">
      <button class="adm-tab active" data-tab="users"     style="padding:.45rem 1rem;border-radius:var(--r-lg);border:1px solid var(--b2);background:var(--d3);color:var(--t1);font-size:.8rem;cursor:pointer;transition:all .18s;">👤 Comptes</button>
      <button class="adm-tab"        data-tab="files"     style="padding:.45rem 1rem;border-radius:var(--r-lg);border:1px solid var(--b2);background:var(--d4);color:var(--t2);font-size:.8rem;cursor:pointer;transition:all .18s;">📂 Fichiers</button>
      <button class="adm-tab"        data-tab="transfers" style="padding:.45rem 1rem;border-radius:var(--r-lg);border:1px solid var(--b2);background:var(--d4);color:var(--t2);font-size:.8rem;cursor:pointer;transition:all .18s;">⚡ Transferts</button>
      <button class="adm-tab"        data-tab="stats"     style="padding:.45rem 1rem;border-radius:var(--r-lg);border:1px solid var(--b2);background:var(--d4);color:var(--t2);font-size:.8rem;cursor:pointer;transition:all .18s;">📊 Statistiques</button>
      <button class="adm-tab"        data-tab="visits"    style="padding:.45rem 1rem;border-radius:var(--r-lg);border:1px solid var(--b2);background:var(--d4);color:var(--t2);font-size:.8rem;cursor:pointer;transition:all .18s;">🌐 Vues du site</button>
      <button class="adm-tab"        data-tab="messages"  style="padding:.45rem 1rem;border-radius:var(--r-lg);border:1px solid var(--b2);background:var(--d4);color:var(--t2);font-size:.8rem;cursor:pointer;transition:all .18s;">📣 Messages</button>
      <button class="adm-tab"        data-tab="logs"      style="padding:.45rem 1rem;border-radius:var(--r-lg);border:1px solid var(--b2);background:var(--d4);color:var(--t2);font-size:.8rem;cursor:pointer;transition:all .18s;">🗒 Logs</button>
    </div>
    <div class="stat-grid stat-grid-4" style="margin-bottom:1.8rem;" id="adm-kpi-row">
      <div class="stat-card"><div class="stat-label">Utilisateurs</div><div class="stat-val" id="adm-total-users">—</div><div class="stat-sub" id="adm-new-users">chargement…</div></div>
      <div class="stat-card"><div class="stat-label">Fichiers sur le site</div><div class="stat-val" id="adm-total-files">—</div><div class="stat-sub" id="adm-total-size">—</div></div>
      <div class="stat-card"><div class="stat-label">Actifs (7 jours)</div><div class="stat-val" id="adm-active-users">—</div><div class="stat-sub">ont uploadé cette semaine</div></div>
      <div class="stat-card"><div class="stat-label">Vues du site (7j)</div><div class="stat-val" id="adm-page-views">—</div><div class="stat-sub" id="adm-unique-visitors">visiteurs uniques…</div></div>
    </div>

    <!-- Comptes -->
    <div id="adm-panel-users">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:1rem;">
        <div class="filter-chip adm-filter active" data-filter="all">Tous</div>
        <div class="filter-chip adm-filter" data-filter="free">Free</div>
        <div class="filter-chip adm-filter" data-filter="pro">Pro</div>
        <div class="filter-chip adm-filter" data-filter="equipe">Équipe</div>
        <div class="filter-chip adm-filter" data-filter="admin">Admin</div>
        <div class="filter-chip adm-filter" data-filter="sous-admin">Sous-admin</div>
        <input type="text" id="adm-search" placeholder="Rechercher pseudo / email…"
          style="background:var(--d3);border:1px solid var(--b2);border-radius:var(--r-lg);padding:.4rem .8rem;color:var(--t1);font-size:.8rem;outline:none;width:230px;transition:border-color .2s;"
          onfocus="this.style.borderColor='var(--blue)'" onblur="this.style.borderColor='var(--b2)'">
        <span id="adm-users-count" style="font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--t3);"></span>
      </div>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th>Utilisateur</th><th>Email</th><th>Rôle</th><th>Fichiers</th><th>Stockage</th><th>Inscrit</th><th>Actions</th></tr></thead>
          <tbody id="adm-users-tbody"><tr><td colspan="7" class="table-empty">Chargement…</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- Fichiers -->
    <div id="adm-panel-files" style="display:none;">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:1rem;flex-wrap:wrap;">
        <input type="text" id="adm-files-search" placeholder="Rechercher un fichier…"
          style="background:var(--d3);border:1px solid var(--b2);border-radius:var(--r-lg);padding:.4rem .8rem;color:var(--t1);font-size:.8rem;outline:none;width:250px;">
        <button class="btn btn-ghost btn-sm" id="adm-load-files">⬇ Charger tous les fichiers</button>
      </div>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th>Fichier</th><th>Propriétaire</th><th>Taille</th><th>Type</th><th>Date</th><th>Action</th></tr></thead>
          <tbody id="adm-files-tbody"><tr><td colspan="6" class="table-empty">Clique sur "Charger" pour afficher tous les fichiers.</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- Transferts -->
    <div id="adm-panel-transfers" style="display:none;">
      <div style="margin-bottom:1rem;">
        <button class="btn btn-ghost btn-sm" id="adm-load-transfers">⬇ Charger les transferts récents (100)</button>
      </div>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th>Fichier</th><th>Propriétaire</th><th>Destination</th><th>Statut</th><th>Date</th><th>Action</th></tr></thead>
          <tbody id="adm-transfers-tbody"><tr><td colspan="6" class="table-empty">Clique sur "Charger".</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- Statistiques -->
    <div id="adm-panel-stats" style="display:none;">
      <div class="two-col">
        <div class="chart-card">
          <div class="section-header" style="margin-bottom:0;"><div class="section-title">Répartition des forfaits</div></div>
          <div id="adm-plan-chart" style="margin-top:1.2rem;display:flex;flex-direction:column;gap:10px;"></div>
        </div>
        <div class="chart-card">
          <div class="section-header" style="margin-bottom:0;"><div class="section-title">Types de fichiers (site)</div></div>
          <div id="adm-types-chart" style="margin-top:1.2rem;display:flex;flex-direction:column;gap:10px;"></div>
        </div>
      </div>
      <div class="chart-card" style="margin-top:1.2rem;">
        <div class="section-header" style="margin-bottom:.5rem;"><div class="section-title">Top 10 par stockage</div></div>
        <table class="data-table"><thead><tr><th>Utilisateur</th><th>Rôle</th><th>Fichiers</th><th>Stockage</th><th>% du total</th></tr></thead>
        <tbody id="adm-top-users"></tbody></table>
      </div>
    </div>

    <!-- Vues du site -->
    <div id="adm-panel-visits" style="display:none;">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:1.2rem;flex-wrap:wrap;">
        <button class="btn btn-ghost btn-sm" id="adm-refresh-visits">↺ Actualiser</button>
        <select id="adm-visits-range" style="background:var(--d3);border:1px solid var(--b2);border-radius:var(--r);padding:.38rem .7rem;color:var(--t1);font-size:.78rem;outline:none;">
          <option value="7">7 derniers jours</option>
          <option value="30">30 derniers jours</option>
          <option value="90">90 derniers jours</option>
        </select>
      </div>
      <div class="stat-grid stat-grid-4" style="margin-bottom:1.5rem;">
        <div class="stat-card"><div class="stat-label">Vues totales</div><div class="stat-val" id="v-total">—</div></div>
        <div class="stat-card"><div class="stat-label">Visiteurs uniques</div><div class="stat-val" id="v-unique">—</div></div>
        <div class="stat-card"><div class="stat-label">Inscrits via menu</div><div class="stat-val" id="v-signups">—</div></div>
        <div class="stat-card"><div class="stat-label">Page la + vue</div><div class="stat-val" id="v-top-page" style="font-size:1rem;">—</div></div>
      </div>
      <div class="chart-card">
        <div class="section-header" style="margin-bottom:.5rem;"><div class="section-title">Pages les plus visitées</div></div>
        <div id="adm-pages-chart" style="display:flex;flex-direction:column;gap:9px;margin-top:.8rem;"></div>
      </div>
      <div class="chart-card" style="margin-top:1.2rem;">
        <div class="section-header" style="margin-bottom:.5rem;"><div class="section-title">Dernières visites (50)</div></div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr><th>Date</th><th>Page</th><th>Visiteur (fingerprint)</th><th>Pays / Lang</th><th>Référent</th></tr></thead>
            <tbody id="adm-visits-tbody"><tr><td colspan="5" class="table-empty">Chargement…</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Messages pop-up aux utilisateurs -->
    <div id="adm-panel-messages" style="display:none;">
      ${adminRole==='admin'?`
      <div class="chart-card" style="margin-bottom:1.2rem;">
        <div class="section-title" style="margin-bottom:1rem;">📣 Envoyer un message à tous les utilisateurs</div>
        <div style="display:flex;flex-direction:column;gap:.8rem;">
          <input type="text" id="msg-title" placeholder="Titre du message (ex: Maintenance prévue)" maxlength="80"
            style="background:var(--d4);border:1px solid var(--b2);border-radius:var(--r-lg);padding:.6rem .9rem;color:var(--t1);font-size:.85rem;outline:none;width:100%;transition:border-color .2s;"
            onfocus="this.style.borderColor='var(--blue)'" onblur="this.style.borderColor='var(--b2)'">
          <textarea id="msg-body" placeholder="Contenu du message…" rows="4" maxlength="500"
            style="background:var(--d4);border:1px solid var(--b2);border-radius:var(--r-lg);padding:.6rem .9rem;color:var(--t1);font-size:.83rem;outline:none;width:100%;resize:vertical;font-family:inherit;transition:border-color .2s;"
            onfocus="this.style.borderColor='var(--blue)'" onblur="this.style.borderColor='var(--b2)'"></textarea>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <select id="msg-color" style="background:var(--d4);border:1px solid var(--b2);border-radius:var(--r);padding:.38rem .7rem;color:var(--t1);font-size:.78rem;outline:none;">
              <option value="var(--blue)">🔵 Info</option>
              <option value="var(--green)">🟢 Succès</option>
              <option value="var(--amber)">🟡 Avertissement</option>
              <option value="var(--red)">🔴 Urgent</option>
            </select>
            <select id="msg-target" style="background:var(--d4);border:1px solid var(--b2);border-radius:var(--r);padding:.38rem .7rem;color:var(--t1);font-size:.78rem;outline:none;">
              <option value="all">Tous les utilisateurs</option>
              <option value="free">Forfait Free seulement</option>
              <option value="pro">Forfait Pro seulement</option>
              <option value="equipe">Forfait Équipe seulement</option>
            </select>
            <button class="btn btn-primary btn-sm" id="adm-send-msg">📣 Envoyer à tous</button>
          </div>
        </div>
      </div>
      `:'<div class="chart-card"><div style="color:var(--t3);font-size:.82rem;">Accès réservé à l\'admin complet.</div></div>'}

      <!-- Pop-up bannière globale -->
      ${adminRole==='admin'?`
      <div class="chart-card" style="margin-bottom:1.2rem;">
        <div class="section-title" style="margin-bottom:1rem;">🚨 Bannière globale sur le client</div>
        <div style="display:flex;flex-direction:column;gap:.8rem;">
          <input type="text" id="banner-text" placeholder="Texte de la bannière (ex: Maintenance le 12/07 à 3h)" maxlength="120"
            style="background:var(--d4);border:1px solid var(--b2);border-radius:var(--r-lg);padding:.6rem .9rem;color:var(--t1);font-size:.85rem;outline:none;width:100%;">
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <select id="banner-color" style="background:var(--d4);border:1px solid var(--b2);border-radius:var(--r);padding:.38rem .7rem;color:var(--t1);font-size:.78rem;outline:none;">
              <option value="var(--blue)">🔵 Info</option>
              <option value="var(--amber)">🟡 Avertissement</option>
              <option value="var(--red)">🔴 Urgent</option>
            </select>
            <button class="btn btn-primary btn-sm" id="adm-set-banner">🚨 Activer la bannière</button>
            <button class="btn btn-ghost btn-sm" id="adm-clear-banner" style="color:var(--red);">✕ Désactiver</button>
          </div>
          <div id="banner-preview" style="display:none;padding:.7rem 1rem;border-radius:var(--r-lg);font-size:.82rem;margin-top:.3rem;"></div>
        </div>
      </div>

      <!-- Historique des messages -->
      <div class="chart-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
          <div class="section-title">Historique des messages envoyés</div>
          <button class="btn btn-ghost btn-xs" id="adm-refresh-msgs">↺</button>
        </div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr><th>Date</th><th>Titre</th><th>Cible</th><th>Destinataires</th><th>Action</th></tr></thead>
            <tbody id="adm-msgs-tbody"><tr><td colspan="5" class="table-empty">Chargement…</td></tr></tbody>
          </table>
        </div>
      </div>`:''}
    </div>

    <!-- Logs -->
    <div id="adm-panel-logs" style="display:none;">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:1rem;">
        <select id="adm-logs-limit" style="background:var(--d3);border:1px solid var(--b2);border-radius:var(--r);padding:.38rem .7rem;color:var(--t1);font-size:.78rem;outline:none;">
          <option value="50">50 dernières</option><option value="100">100 dernières</option><option value="200">200 dernières</option>
        </select>
        <button class="btn btn-ghost btn-sm" id="adm-refresh-logs">↺ Actualiser</button>
      </div>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th></tr></thead>
          <tbody id="adm-logs-tbody"><tr><td colspan="3" class="table-empty">Chargement…</td></tr></tbody>
        </table>
      </div>
    </div>
  `;
}
async function loadAllUsers() {
  let users = null;

  // Essai RPC
  const { data: rpcData, error: rpcErr } = await supabase.rpc('get_all_profiles');
  if (!rpcErr && Array.isArray(rpcData)) { users = rpcData; }

  // Fallback query directe (si RLS policy configurée)
  if (!users) {
    const { data, error } = await supabase.from('profiles')
      .select('id,username,email,first_name,last_name,type,created_at,avatar_url,lang')
      .order('created_at',{ascending:false});
    if (!error && data) users = data;
  }

  if (!users) {
    uiToast('error','⚠ RLS bloque la lecture des comptes. Crée la fonction SQL get_all_profiles() dans Supabase (voir admin.js).');
    allUsers = [];
    return;
  }

  allUsers = users;

  // Stats fichiers
  const { data: filesData } = await supabase.from('files').select('user_id,size_bytes,type,status');
  allFiles = filesData||[];
  const statsMap = {};
  for (const f of allFiles) {
    if (!statsMap[f.user_id]) statsMap[f.user_id]={count:0,size:0};
    statsMap[f.user_id].count++;
    statsMap[f.user_id].size += f.size_bytes||0;
  }
  allUsers.forEach(u => { u._stats = statsMap[u.id]||{count:0,size:0}; });

  // Stats devices
  const { data: devsData } = await supabase.from('devices').select('user_id');
  const devMap = {};
  for (const d of (devsData||[])) { devMap[d.user_id]=(devMap[d.user_id]||0)+1; }
  allUsers.forEach(u => { u._devices = devMap[u.id]||0; });
}

async function loadAdminStats() {
  const oneWeekAgo = new Date(Date.now()-7*86400000).toISOString();
  const newUsers   = allUsers.filter(u=>u.created_at>oneWeekAgo).length;
  const { data: recentFiles } = await supabase.from('files').select('user_id').gte('created_at',oneWeekAgo);
  const activeSet  = new Set((recentFiles||[]).map(f=>f.user_id));
  const totalSize  = allFiles.reduce((s,f)=>s+(f.size_bytes||0),0);
  _t('adm-total-users',  allUsers.length.toLocaleString('fr'));
  _t('adm-new-users',    '+'+newUsers+' cette semaine');
  _t('adm-total-files',  allFiles.length.toLocaleString('fr'));
  _t('adm-total-size',   formatBytes(totalSize));
  _t('adm-active-users', activeSet.size.toLocaleString('fr'));
  _t('adm-storage',      formatBytes(totalSize));
  renderPlanChart();
  renderTypesChart();
  renderTopUsers(totalSize);
}

function renderPlanChart() {
  const el=document.getElementById('adm-plan-chart'); if(!el) return;
  const counts={};
  for (const u of allUsers) { const r=(u.type||'free').toLowerCase(); counts[r]=(counts[r]||0)+1; }
  const total=allUsers.length||1;
  el.innerHTML=Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([role,count])=>{
    const pct=Math.round(count/total*100);
    return `<div style="display:flex;align-items:center;gap:8px;">${BADGE(role)}
      <div style="flex:1;height:6px;background:var(--d5);border-radius:99px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;background:${COLORS[role]||'var(--t3)'};border-radius:99px;"></div>
      </div>
      <span style="font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--t2);min-width:55px;text-align:right;">${count} · ${pct}%</span>
    </div>`;
  }).join('');
}

function renderTypesChart() {
  const el=document.getElementById('adm-types-chart'); if(!el) return;
  const counts={};
  for (const f of allFiles) { const tp=f.type||'other'; counts[tp]=(counts[tp]||0)+1; }
  const total=allFiles.length||1;
  const TC={image:'var(--blue)',video:'var(--purple)',audio:'var(--cyan)',doc:'var(--green)',archive:'var(--amber)',other:'var(--t3)'};
  el.innerHTML=Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([type,count])=>{
    const pct=Math.round(count/total*100); const col=TC[type]||'var(--t3)';
    return `<div style="display:flex;align-items:center;gap:8px;">
      <span style="font-family:'JetBrains Mono',monospace;font-size:.68rem;color:${col};min-width:60px;text-transform:uppercase;">${type}</span>
      <div style="flex:1;height:6px;background:var(--d5);border-radius:99px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;background:${col};border-radius:99px;"></div>
      </div>
      <span style="font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--t2);min-width:55px;text-align:right;">${count} · ${pct}%</span>
    </div>`;
  }).join('');
}

function renderTopUsers(totalSize) {
  const el=document.getElementById('adm-top-users'); if(!el) return;
  const sorted=[...allUsers].sort((a,b)=>(b._stats?.size||0)-(a._stats?.size||0)).slice(0,10);
  el.innerHTML=sorted.map(u=>{
    const role=(u.type||'free').toLowerCase();
    const pct=totalSize?Math.round((u._stats?.size||0)/totalSize*100):0;
    const name=[u.first_name,u.last_name].filter(Boolean).join(' ')||`@${u.username||'?'}`;
    return `<tr>
      <td><span style="font-size:.84rem;">${name}</span> <span style="font-family:'JetBrains Mono',monospace;font-size:.65rem;color:var(--t3);">@${u.username||'?'}</span></td>
      <td>${BADGE(role)}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.74rem;color:var(--t2);">${u._stats?.count||0}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.74rem;">${formatBytes(u._stats?.size||0)}</td>
      <td><div style="display:flex;align-items:center;gap:6px;">
        <div style="flex:1;height:4px;background:var(--d5);border-radius:99px;min-width:40px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:var(--blue2);border-radius:99px;"></div>
        </div>
        <span style="font-family:'JetBrains Mono',monospace;font-size:.66rem;color:var(--t3);">${pct}%</span>
      </div></td>
    </tr>`;
  }).join('');
}

function renderAdminUsers() {
  const tbody=document.getElementById('adm-users-tbody'); if(!tbody) return;
  const q=(document.getElementById('adm-search')?.value||'').toLowerCase();
  let users=allUsers;
  if (admFilter!=='all') users=users.filter(u=>(u.type||'free').toLowerCase()===admFilter);
  if (q) users=users.filter(u=>
    (u.username||'').toLowerCase().includes(q)||(u.email||'').toLowerCase().includes(q)||
    (u.first_name||'').toLowerCase().includes(q)||(u.last_name||'').toLowerCase().includes(q)
  );
  const countEl=document.getElementById('adm-users-count');
  if(countEl)countEl.textContent=users.length+' utilisateur(s)';
  if(!users.length){tbody.innerHTML=`<tr><td colspan="7" class="table-empty">Aucun utilisateur trouvé.</td></tr>`;return;}
  const canEdit=adminRole==='admin';
  const myId=state.session?.user?.id;
  tbody.innerHTML=users.map(u=>{
    const name=[u.first_name,u.last_name].filter(Boolean).join(' ')||`@${u.username||'?'}`;
    const role=(u.type||'free').toLowerCase();
    const date=new Date(u.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'});
    const isMe=u.id===myId;
    const av=u.avatar_url
      ?`<img src="${u.avatar_url}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;flex-shrink:0;">`
      :`<div style="width:30px;height:30px;border-radius:50%;background:var(--d4);border:1px solid var(--b2);display:flex;align-items:center;justify-content:center;font-size:.7rem;color:var(--t3);flex-shrink:0;">${(u.first_name?.[0]||u.username?.[0]||'?').toUpperCase()}</div>`;
    const actHtml=canEdit?`<div style="display:flex;gap:3px;align-items:center;flex-wrap:wrap;">
        <button class="adm-upgrade-btn btn btn-ghost btn-xs" data-uid="${u.id}" data-role="${role}" data-uname="${u.username||name}" title="Changer le grade" style="color:var(--blue2);border-color:rgba(26,111,255,.3);">⬆ Grade</button>
        <button class="adm-msg-btn btn btn-ghost btn-xs" data-uid="${u.id}" data-uname="${u.username||name}" title="Envoyer un message" style="color:var(--amber);border-color:rgba(245,158,11,.3);">📣</button>
        <button class="adm-view-btn btn btn-ghost btn-xs" data-uid="${u.id}" data-uname="${u.username||name}" title="Voir les fichiers">📂</button>
        ${!isMe?`<button class="adm-ban-btn btn btn-ghost btn-xs" data-uid="${u.id}" data-name="${name}" title="Supprimer" style="color:var(--red);border-color:rgba(255,59,92,.3);">✕</button>`:''}
      </div>`:`<span style="font-size:.7rem;color:var(--t3);">lecture seule</span>`;
    return `<tr${isMe?' style="background:rgba(26,111,255,.04);"':''}>
      <td><div style="display:flex;align-items:center;gap:8px;">${av}<div>
        <div style="font-size:.84rem;color:var(--t1);">${name}${isMe?` <span style="font-size:.58rem;color:var(--blue2);border:1px solid var(--blue2);border-radius:99px;padding:1px 5px;">vous</span>`:''}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--t3);">@${u.username||'—'} · ${u._devices||0} app.</div>
      </div></div></td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.72rem;color:var(--t2);">${u.email||'—'}</td>
      <td>${BADGE(role)}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.74rem;">${u._stats.count}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.74rem;">${formatBytes(u._stats.size)}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--t3);">${date}</td>
      <td>${actHtml}</td>
    </tr>`;
  }).join('');
  if(canEdit){
    tbody.querySelectorAll('.adm-upgrade-btn').forEach(btn=>btn.addEventListener('click',function(){
      openUpgradeModal(this.dataset.uid, this.dataset.role, this.dataset.uname);
    }));
    tbody.querySelectorAll('.adm-msg-btn').forEach(btn=>btn.addEventListener('click',function(){
      openSendMessageModal(this.dataset.uid, this.dataset.uname);
    }));
    tbody.querySelectorAll('.adm-ban-btn').forEach(btn=>btn.addEventListener('click',function(){
      const n=this.dataset.name, uid=this.dataset.uid;
      creoConfirm('Supprimer ce compte ?',
        `Le compte de <strong>@${n}</strong> et tous ses fichiers seront supprimés définitivement. Cette action est irréversible.`,
        ()=>banUser(uid,n), true);
    }));
  }
  tbody.querySelectorAll('.adm-view-btn').forEach(btn=>btn.addEventListener('click',function(){viewUserFiles(this.dataset.uid,this.dataset.uname);}));
}

async function loadAllFiles(searchQ='') {
  const tbody=document.getElementById('adm-files-tbody'); if(!tbody)return;
  tbody.innerHTML=`<tr><td colspan="6" class="table-empty">Chargement…</td></tr>`;
  let query=supabase.from('files').select('*').order('created_at',{ascending:false}).limit(200);
  if(searchQ) query=query.ilike('name',`%${searchQ}%`);
  const{data,error}=await query;
  if(error){tbody.innerHTML=`<tr><td colspan="6" class="table-empty" style="color:var(--red);">Erreur RLS : ${error.message}</td></tr>`;return;}
  const uidMap={};allUsers.forEach(u=>{uidMap[u.id]=u.username||u.email?.split('@')[0]||'?';});
  if(!data?.length){tbody.innerHTML=`<tr><td colspan="6" class="table-empty">Aucun fichier.</td></tr>`;return;}
  const canDel=adminRole==='admin';
  tbody.innerHTML=data.map(f=>{
    const owner=uidMap[f.user_id]||f.user_id?.slice(0,8)||'?';
    const date=new Date(f.created_at).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    return `<tr>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.82rem;" title="${f.name}">${f.name}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--blue2);">@${owner}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.72rem;">${formatBytes(f.size_bytes||0)}</td>
      <td style="font-size:.7rem;color:var(--t3);text-transform:uppercase;">${f.type||'other'}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.68rem;color:var(--t3);">${date}</td>
      <td><div style="display:flex;gap:4px;">
        ${f.public_url?`<a class="btn btn-ghost btn-xs" href="${f.public_url}" target="_blank" download>⬇</a>`:''}
        ${canDel?`<button class="btn btn-ghost btn-xs adm-del-file" data-fid="${f.id}" data-path="${f.storage_path||''}" style="color:var(--red);">✕</button>`:''}
      </div></td>
    </tr>`;
  }).join('');
  if(canDel) tbody.querySelectorAll('.adm-del-file').forEach(btn=>btn.addEventListener('click',function(){
    const fid=this.dataset.fid, path=this.dataset.path;
    creoConfirm('Supprimer ce fichier ?','Ce fichier sera supprimé définitivement du stockage. Irréversible.',
      async()=>{await deleteFile(fid,path);loadAllFiles(searchQ);},true);
  }));
}

async function loadAllTransfers() {
  const tbody=document.getElementById('adm-transfers-tbody'); if(!tbody)return;
  tbody.innerHTML=`<tr><td colspan="6" class="table-empty">Chargement…</td></tr>`;
  const{data,error}=await supabase.from('files').select('*').order('created_at',{ascending:false}).limit(100);
  if(error){tbody.innerHTML=`<tr><td colspan="6" class="table-empty" style="color:var(--red);">Erreur RLS : ${error.message}</td></tr>`;return;}
  const uidMap={};allUsers.forEach(u=>{uidMap[u.id]=u.username||'?';});
  const canDel=adminRole==='admin';
  tbody.innerHTML=(data||[]).map(f=>{
    const owner=uidMap[f.user_id]||f.user_id?.slice(0,8)||'?';
    const dest=f.target_device_id?'Appareil':'Lien public';
    const date=new Date(f.created_at).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    const status=f.status==='error'?`<span class="status st-err">✕ Erreur</span>`:f.downloaded_at?`<span class="status st-done">✓ Reçu</span>`:`<span class="status st-wait">⏳ En attente</span>`;
    return `<tr>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.82rem;">${f.name}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--blue2);">@${owner}</td>
      <td style="font-size:.78rem;color:var(--t2);">${dest}</td>
      <td>${status}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.68rem;color:var(--t3);">${date}</td>
      <td><div style="display:flex;gap:4px;">
        ${f.public_url?`<a class="btn btn-ghost btn-xs" href="${f.public_url}" target="_blank" download>⬇</a>`:''}
        ${canDel?`<button class="btn btn-ghost btn-xs adm-del-file" data-fid="${f.id}" data-path="${f.storage_path||''}" style="color:var(--red);">✕</button>`:''}
      </div></td>
    </tr>`;
  }).join('');
  if(canDel) tbody.querySelectorAll('.adm-del-file').forEach(btn=>btn.addEventListener('click',function(){
    const fid=this.dataset.fid, path=this.dataset.path;
    creoConfirm('Supprimer ce fichier ?','Ce fichier sera supprimé définitivement du stockage. Irréversible.',
      async()=>{await deleteFile(fid,path);loadAllTransfers();},true);
  }));
}

async function viewUserFiles(userId,name) {
  switchAdmTab('files');
  const tbody=document.getElementById('adm-files-tbody'); if(!tbody)return;
  tbody.innerHTML=`<tr><td colspan="6" class="table-empty">Chargement des fichiers de @${name}…</td></tr>`;
  const{data,error}=await supabase.from('files').select('*').eq('user_id',userId).order('created_at',{ascending:false});
  if(error||!data?.length){tbody.innerHTML=`<tr><td colspan="6" class="table-empty">Aucun fichier pour @${name}.</td></tr>`;return;}
  const canDel=adminRole==='admin';
  tbody.innerHTML=data.map(f=>{
    const date=new Date(f.created_at).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    return `<tr>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.82rem;">${f.name}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--blue2);">@${name}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.72rem;">${formatBytes(f.size_bytes||0)}</td>
      <td style="font-size:.7rem;color:var(--t3);text-transform:uppercase;">${f.type||'other'}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.68rem;color:var(--t3);">${date}</td>
      <td><div style="display:flex;gap:4px;">
        ${f.public_url?`<a class="btn btn-ghost btn-xs" href="${f.public_url}" target="_blank" download>⬇</a>`:''}
        ${canDel?`<button class="btn btn-ghost btn-xs adm-del-file" data-fid="${f.id}" data-path="${f.storage_path||''}" style="color:var(--red);">✕</button>`:''}
      </div></td>
    </tr>`;
  }).join('');
  if(canDel) tbody.querySelectorAll('.adm-del-file').forEach(btn=>btn.addEventListener('click',function(){
    const fid=this.dataset.fid, path=this.dataset.path;
    creoConfirm('Supprimer ce fichier ?','Ce fichier sera supprimé définitivement du stockage.',
      async()=>{await deleteFile(fid,path);viewUserFiles(userId,name);},true);
  }));
}

async function loadAdminLogs() {
  const tbody=document.getElementById('adm-logs-tbody'); if(!tbody)return;
  const limit=parseInt(document.getElementById('adm-logs-limit')?.value||'50');
  const{data}=await supabase.from('notifications').select('created_at,user_id,text,color').order('created_at',{ascending:false}).limit(limit);
  const uidMap={};allUsers.forEach(u=>{uidMap[u.id]=u.username||u.email?.split('@')[0]||'?';});
  if(!data?.length){tbody.innerHTML=`<tr><td colspan="3" class="table-empty">Aucun log.</td></tr>`;return;}
  tbody.innerHTML=data.map(log=>{
    const date=new Date(log.created_at).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    const user=uidMap[log.user_id]||log.user_id?.slice(0,8)||'—';
    const dot=`<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${log.color||'var(--t3)'};margin-right:6px;flex-shrink:0;vertical-align:middle;"></span>`;
    return `<tr>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--t3);white-space:nowrap;">${date}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.74rem;color:var(--blue2);">@${user}</td>
      <td style="font-size:.8rem;">${dot}${log.text||'—'}</td>
    </tr>`;
  }).join('');
}

async function changeUserRole(userId,newRole) {
  if(userId===state.session?.user?.id){uiToast('error','Tu ne peux pas changer ton propre rôle.');renderAdminUsers();return;}
  const{error}=await supabase.from('profiles').update({type:newRole}).eq('id',userId);
  if(error){uiToast('error','Erreur : '+error.message);return;}
  const u=allUsers.find(x=>x.id===userId);if(u)u.type=newRole;
  uiToast('success',`✓ Rôle → ${newRole}`);renderAdminUsers();
  await logAction(`Rôle changé → ${newRole}`,`user: ${u?.username||userId}`);
}

async function banUser(userId,name) {
  if(userId===state.session?.user?.id){uiToast('error','Tu ne peux pas te supprimer.');return;}
  // Confirmation gérée via creoConfirm() dans renderAdminUsers
  const{data:userFiles}=await supabase.from('files').select('storage_path').eq('user_id',userId);
  for(const f of (userFiles||[])){if(f.storage_path)await supabase.storage.from('creo-files').remove([f.storage_path]);}
  await supabase.from('files').delete().eq('user_id',userId);
  await supabase.from('devices').delete().eq('user_id',userId);
  await supabase.from('profiles').delete().eq('id',userId);
  allUsers=allUsers.filter(u=>u.id!==userId);
  allFiles=allFiles.filter(f=>f.user_id!==userId);
  uiToast('success',`✓ Compte "${name}" supprimé`);
  renderAdminUsers();loadAdminStats();
  await logAction('Compte supprimé',`user: ${name}`);
}

async function deleteFile(fileId,storagePath) {
  // Appelé depuis creoConfirm - pas de confirm() natif
  if(storagePath)await supabase.storage.from('creo-files').remove([storagePath]);
  await supabase.from('files').delete().eq('id',fileId);
  uiToast('success','✓ Fichier supprimé');
  await logAction('Fichier supprimé par admin',fileId);
}

async function logAction(action,detail='') {
  await supabase.from('notifications').insert({user_id:state.session.user.id,text:`[ADMIN] ${action}${detail?' — '+detail:''}`,color:'var(--red)',read:false});
}

/* ══ Vues du site ══
   Nécessite la table Supabase :
   CREATE TABLE site_visits (
     id uuid default gen_random_uuid() primary key,
     page text, fingerprint text, lang text,
     referrer text, country text,
     created_at timestamptz default now()
   );
   ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "insert_visits" ON site_visits FOR INSERT WITH CHECK (true);
   CREATE POLICY "admin_select" ON site_visits FOR SELECT
     USING ((SELECT type FROM profiles WHERE id=auth.uid()) IN ('admin','sous-admin'));
══ */
async function loadVisits() {
  const days = parseInt(document.getElementById('adm-visits-range')?.value||'7');
  const since = new Date(Date.now()-days*86400000).toISOString();

  const{data,error}=await supabase.from('site_visits')
    .select('*').gte('created_at',since).order('created_at',{ascending:false}).limit(200);

  if(error){
    const tb=document.getElementById('adm-visits-tbody');
    if(tb)tb.innerHTML=`<tr><td colspan="5" class="table-empty" style="color:var(--red);">Erreur : crée la table site_visits dans Supabase (voir admin.js).</td></tr>`;
    _t('v-total','—');_t('v-unique','—');_t('v-signups','—');_t('v-top-page','—');
    return;
  }

  const rows=data||[];
  const uniqueFP=new Set(rows.map(r=>r.fingerprint).filter(Boolean));
  const pageCounts={};
  rows.forEach(r=>{if(r.page)pageCounts[r.page]=(pageCounts[r.page]||0)+1;});
  const topPage=Object.entries(pageCounts).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—';

  // Inscrits dans la période (via profiles)
  const{data:signups}=await supabase.from('profiles').select('id').gte('created_at',since);

  _t('v-total',rows.length.toLocaleString('fr'));
  _t('v-unique',uniqueFP.size.toLocaleString('fr'));
  _t('v-signups',(signups?.length||0).toLocaleString('fr'));
  _t('v-top-page',topPage.replace('/creo/menu/','').replace('.html',''));

  // Graphique pages
  const chart=document.getElementById('adm-pages-chart');
  if(chart){
    const total=rows.length||1;
    chart.innerHTML=Object.entries(pageCounts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([page,cnt])=>{
      const pct=Math.round(cnt/total*100);
      const label=page.replace('/creo/menu/','').replace('/creo/client/','').replace('.html','');
      return`<div style="display:flex;align-items:center;gap:8px;">
        <span style="font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--blue2);min-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${label}</span>
        <div style="flex:1;height:6px;background:var(--d5);border-radius:99px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:var(--blue);border-radius:99px;"></div>
        </div>
        <span style="font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--t2);min-width:55px;text-align:right;">${cnt} · ${pct}%</span>
      </div>`;
    }).join('');
  }

  // Table des visites
  const tb=document.getElementById('adm-visits-tbody');
  if(tb){
    if(!rows.length){tb.innerHTML=`<tr><td colspan="5" class="table-empty">Aucune visite dans cette période.</td></tr>`;return;}
    tb.innerHTML=rows.slice(0,50).map(r=>{
      const date=new Date(r.created_at).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
      const page=(r.page||'—').replace('/creo/menu/','').replace('.html','');
      const fp=(r.fingerprint||'—').slice(0,12)+'…';
      return`<tr>
        <td style="font-family:'JetBrains Mono',monospace;font-size:.68rem;color:var(--t3);white-space:nowrap;">${date}</td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:.74rem;color:var(--blue2);">${page}</td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:.66rem;color:var(--t3);">${fp}</td>
        <td style="font-size:.74rem;color:var(--t2);">${r.country||r.lang||'—'}</td>
        <td style="font-size:.7rem;color:var(--t3);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.referrer||'direct'}</td>
      </tr>`;
    }).join('');
  }
}

/* ══ Messages pop-up aux utilisateurs ══ */
async function sendPopupMessage() {
  const title=(document.getElementById('msg-title')?.value||'').trim();
  const body=(document.getElementById('msg-body')?.value||'').trim();
  const color=document.getElementById('msg-color')?.value||'var(--blue)';
  const target=document.getElementById('msg-target')?.value||'all';
  if(!title||!body){uiToast('warning','Titre et contenu requis.');return;}

  const btn=document.getElementById('adm-send-msg');btn.classList.add('btn-loading');

  // Construire la liste des destinataires
  let targets=allUsers;
  if(target!=='all')targets=allUsers.filter(u=>(u.type||'free').toLowerCase()===target);

  // Insérer une notification pour chaque user ciblé
  const inserts=targets.map(u=>({
    user_id:u.id,
    text:`📣 <strong>${title}</strong> — ${body}`,
    color,
    read:false,
  }));

  // Supabase limite les inserts en batch — envoyer par tranches de 50
  let ok=0;
  for(let i=0;i<inserts.length;i+=50){
    const{error}=await supabase.from('notifications').insert(inserts.slice(i,i+50));
    if(!error)ok+=Math.min(50,inserts.length-i);
  }

  // Sauvegarder dans admin_messages pour l'historique
  await supabase.from('admin_messages').insert({
    title, body, color, target,
    sent_by:state.session.user.id,
    recipients_count:ok,
  }).maybeSingle();

  btn.classList.remove('btn-loading');
  uiToast('success',`✓ Message envoyé à ${ok} utilisateur(s)`);
  if(document.getElementById('msg-title'))document.getElementById('msg-title').value='';
  if(document.getElementById('msg-body'))document.getElementById('msg-body').value='';
  loadMessages();
  await logAction(`Message envoyé : "${title}"`,`cible: ${target} · ${ok} users`);
}

/* ══ Bannière globale ══
   Stockée dans la table site_config : { key:'banner', value: JSON }
   CREATE TABLE site_config (key text primary key, value text);
══ */
async function setBanner() {
  const text=(document.getElementById('banner-text')?.value||'').trim();
  const color=document.getElementById('banner-color')?.value||'var(--blue)';
  if(!text){uiToast('warning','Entre le texte de la bannière.');return;}
  const value=JSON.stringify({text,color,active:true,set_at:new Date().toISOString()});
  await supabase.from('site_config').upsert({key:'banner',value}).eq('key','banner');
  uiToast('success','✓ Bannière activée — visible sur le client au prochain rechargement');
  await logAction('Bannière globale activée',text.slice(0,40));
}

async function clearBanner() {
  await supabase.from('site_config').upsert({key:'banner',value:JSON.stringify({active:false})}).eq('key','banner');
  uiToast('info','Bannière désactivée');
  const prev=document.getElementById('banner-preview');if(prev)prev.style.display='none';
}

function previewBanner() {
  const text=document.getElementById('banner-text')?.value||'';
  const color=document.getElementById('banner-color')?.value||'var(--blue)';
  const prev=document.getElementById('banner-preview');
  if(!prev)return;
  if(!text){prev.style.display='none';return;}
  prev.style.display='block';
  prev.style.background=color+'22';
  prev.style.border=`1px solid ${color}44`;
  prev.style.color='var(--t1)';
  prev.innerHTML=`🚨 <strong>Aperçu :</strong> ${text}`;
}

/* ══ Historique des messages ══ */
async function loadMessages() {
  const tbody=document.getElementById('adm-msgs-tbody');if(!tbody)return;
  const{data,error}=await supabase.from('admin_messages')
    .select('*').order('created_at',{ascending:false}).limit(30);
  if(error){tbody.innerHTML=`<tr><td colspan="5" class="table-empty" style="color:var(--amber);">Crée la table admin_messages pour activer l'historique.</td></tr>`;return;}
  if(!data?.length){tbody.innerHTML=`<tr><td colspan="5" class="table-empty">Aucun message envoyé.</td></tr>`;return;}
  tbody.innerHTML=data.map(m=>{
    const date=new Date(m.created_at).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    const dot=`<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${m.color||'var(--blue)'};margin-right:6px;"></span>`;
    return`<tr>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.68rem;color:var(--t3);white-space:nowrap;">${date}</td>
      <td>${dot}<span style="font-size:.82rem;">${m.title||'—'}</span></td>
      <td style="font-size:.74rem;color:var(--t2);">${m.target||'all'}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.74rem;color:var(--blue2);">${m.recipients_count||0}</td>
      <td></td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════════════
   MODAL CONFIRMATION INTÉGRÉE (remplace alert/confirm natif)
══════════════════════════════════════════ */
function creoConfirm(title, body, onConfirm, danger=true) {
  document.getElementById('_ccm')?.remove();
  const m = document.createElement('div');
  m.id = '_ccm';
  m.style.cssText = `position:fixed;inset:0;z-index:10000;display:flex;align-items:center;
    justify-content:center;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);`;
  m.innerHTML = `<div style="background:var(--d2);border:1px solid var(--b3);border-radius:var(--r-xl);
      padding:2rem 2rem 1.5rem;max-width:420px;width:90%;box-shadow:0 32px 80px #000a;
      ${danger?'border-top:3px solid var(--red);':'border-top:3px solid var(--blue);'}">
    <div style="font-size:1rem;font-weight:700;color:var(--t1);margin-bottom:.6rem;">${title}</div>
    <div style="font-size:.84rem;color:var(--t2);line-height:1.55;margin-bottom:1.5rem;">${body}</div>
    <div style="display:flex;gap:.6rem;justify-content:flex-end;">
      <button id="_ccm_cancel" style="padding:.52rem 1.3rem;border-radius:var(--r-lg);border:1px solid var(--b2);
        background:var(--d4);color:var(--t2);font-size:.82rem;cursor:pointer;">Annuler</button>
      <button id="_ccm_ok" style="padding:.52rem 1.3rem;border-radius:var(--r-lg);border:none;
        background:${danger?'var(--red)':'var(--blue)'};color:#fff;font-size:.82rem;cursor:pointer;font-weight:600;">
        ${danger?'⚠ Confirmer':'✓ Confirmer'}</button>
    </div>
  </div>`;
  document.body.appendChild(m);
  const close = () => m.remove();
  m.querySelector('#_ccm_cancel').onclick = close;
  m.querySelector('#_ccm_ok').onclick = () => { close(); onConfirm(); };
  m.onclick = e => { if(e.target===m) close(); };
}

/* ══════════════════════════════════════════
   MODAL INFO / ALERTE INTÉGRÉE
══════════════════════════════════════════ */
export function creoAlert(title, body, color='var(--blue)') {
  document.getElementById('_cam')?.remove();
  const m = document.createElement('div');
  m.id = '_cam';
  m.style.cssText = `position:fixed;inset:0;z-index:10000;display:flex;align-items:center;
    justify-content:center;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);`;
  m.innerHTML = `<div style="background:var(--d2);border:1px solid ${color}44;border-radius:var(--r-xl);
      padding:2rem 2rem 1.5rem;max-width:440px;width:90%;box-shadow:0 32px 80px #000a;
      border-left:3px solid ${color};">
    <div style="font-size:1.05rem;font-weight:700;color:${color};margin-bottom:.7rem;">${title}</div>
    <div style="font-size:.85rem;color:var(--t1);line-height:1.6;margin-bottom:1.4rem;">${body}</div>
    <div style="display:flex;justify-content:flex-end;">
      <button id="_cam_ok" style="padding:.52rem 1.4rem;border-radius:var(--r-lg);border:none;
        background:${color};color:#fff;font-size:.82rem;cursor:pointer;font-weight:600;">OK</button>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.querySelector('#_cam_ok').onclick = () => m.remove();
  m.onclick = e => { if(e.target===m) m.remove(); };
}

/* ══════════════════════════════════════════
   MODAL UPGRADE DE GRADE (depuis admin)
══════════════════════════════════════════ */
function openUpgradeModal(userId, currentRole, username) {
  document.getElementById('_ugm')?.remove();
  const m = document.createElement('div');
  m.id = '_ugm';
  m.style.cssText = `position:fixed;inset:0;z-index:10000;display:flex;align-items:center;
    justify-content:center;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);`;

  const opts = ROLES.map(r => `
    <label style="display:flex;align-items:center;gap:.7rem;padding:.6rem .8rem;
      border-radius:var(--r-lg);border:1px solid ${r===currentRole?'var(--blue)':'var(--b2)'};
      background:${r===currentRole?'rgba(26,111,255,.08)':'var(--d4)'};cursor:pointer;
      transition:all .15s;">
      <input type="radio" name="_ugm_role" value="${r}" ${r===currentRole?'checked':''} style="accent-color:var(--blue);">
      ${BADGE(r)}
      <span style="font-size:.78rem;color:var(--t2);">${_roleDesc(r)}</span>
    </label>`).join('');

  m.innerHTML = `<div style="background:var(--d2);border:1px solid var(--b3);border-radius:var(--r-xl);
      padding:2rem;max-width:460px;width:90%;box-shadow:0 32px 80px #000a;">
    <div style="font-size:1rem;font-weight:700;color:var(--t1);margin-bottom:.3rem;">Changer le grade</div>
    <div style="font-size:.8rem;color:var(--t3);margin-bottom:1.2rem;">Utilisateur : <strong style="color:var(--blue2);">@${username}</strong></div>
    <div style="display:flex;flex-direction:column;gap:.5rem;margin-bottom:1.4rem;">${opts}</div>
    <div style="display:flex;gap:.6rem;justify-content:flex-end;">
      <button id="_ugm_cancel" style="padding:.52rem 1.3rem;border-radius:var(--r-lg);border:1px solid var(--b2);
        background:var(--d4);color:var(--t2);font-size:.82rem;cursor:pointer;">Annuler</button>
      <button id="_ugm_ok" style="padding:.52rem 1.3rem;border-radius:var(--r-lg);border:none;
        background:var(--blue);color:#fff;font-size:.82rem;cursor:pointer;font-weight:600;">✓ Appliquer</button>
    </div>
  </div>`;
  document.body.appendChild(m);
  const close = () => m.remove();
  m.querySelector('#_ugm_cancel').onclick = close;
  m.querySelector('#_ugm_ok').onclick = () => {
    const sel = m.querySelector('input[name="_ugm_role"]:checked')?.value;
    if(sel && sel !== currentRole) changeUserRole(userId, sel);
    close();
  };
  m.onclick = e => { if(e.target===m) close(); };
  // Highlight au survol
  m.querySelectorAll('label').forEach(l => {
    l.onmouseenter = () => { l.style.borderColor='var(--blue)'; l.style.background='rgba(26,111,255,.06)'; };
    l.onmouseleave = () => {
      const r=l.querySelector('input')?.value;
      const isCurrent=r===currentRole;
      l.style.borderColor=isCurrent?'var(--blue)':'var(--b2)';
      l.style.background=isCurrent?'rgba(26,111,255,.08)':'var(--d4)';
    };
  });
}

function _roleDesc(r) {
  return { free:'Accès de base, 1 GB', pro:'Accès étendu, 50 GB', equipe:'Accès équipe, 500 GB',
    'sous-admin':'Modération, lecture seule admin', admin:'Contrôle total du site' }[r] || '';
}

/* ══════════════════════════════════════════
   MODAL ENVOYER MESSAGE À UN USER SPÉCIFIQUE
══════════════════════════════════════════ */
function openSendMessageModal(userId, username) {
  document.getElementById('_smm')?.remove();
  const m = document.createElement('div');
  m.id = '_smm';
  m.style.cssText = `position:fixed;inset:0;z-index:10000;display:flex;align-items:center;
    justify-content:center;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);`;
  m.innerHTML = `<div style="background:var(--d2);border:1px solid var(--b3);border-radius:var(--r-xl);
      padding:2rem;max-width:440px;width:90%;box-shadow:0 32px 80px #000a;">
    <div style="font-size:1rem;font-weight:700;color:var(--t1);margin-bottom:.3rem;">Envoyer un message</div>
    <div style="font-size:.8rem;color:var(--t3);margin-bottom:1rem;">→ <strong style="color:var(--blue2);">@${username}</strong></div>
    <div style="display:flex;flex-direction:column;gap:.7rem;margin-bottom:1.2rem;">
      <input id="_smm_title" type="text" placeholder="Titre du message…" maxlength="80"
        style="background:var(--d4);border:1px solid var(--b2);border-radius:var(--r-lg);
        padding:.55rem .85rem;color:var(--t1);font-size:.84rem;outline:none;width:100%;">
      <textarea id="_smm_body" placeholder="Contenu…" rows="3" maxlength="500"
        style="background:var(--d4);border:1px solid var(--b2);border-radius:var(--r-lg);
        padding:.55rem .85rem;color:var(--t1);font-size:.82rem;outline:none;width:100%;
        resize:vertical;font-family:inherit;"></textarea>
      <select id="_smm_color" style="background:var(--d4);border:1px solid var(--b2);border-radius:var(--r);
        padding:.38rem .7rem;color:var(--t1);font-size:.78rem;outline:none;width:fit-content;">
        <option value="var(--blue)">🔵 Info</option>
        <option value="var(--green)">🟢 Succès</option>
        <option value="var(--amber)">🟡 Avertissement</option>
        <option value="var(--red)">🔴 Urgent</option>
      </select>
    </div>
    <div style="display:flex;gap:.6rem;justify-content:flex-end;">
      <button id="_smm_cancel" style="padding:.52rem 1.3rem;border-radius:var(--r-lg);border:1px solid var(--b2);
        background:var(--d4);color:var(--t2);font-size:.82rem;cursor:pointer;">Annuler</button>
      <button id="_smm_ok" style="padding:.52rem 1.3rem;border-radius:var(--r-lg);border:none;
        background:var(--blue);color:#fff;font-size:.82rem;cursor:pointer;font-weight:600;">📣 Envoyer</button>
    </div>
  </div>`;
  document.body.appendChild(m);
  const close = () => m.remove();
  m.querySelector('#_smm_cancel').onclick = close;
  m.querySelector('#_smm_ok').onclick = async () => {
    const title = m.querySelector('#_smm_title').value.trim();
    const body  = m.querySelector('#_smm_body').value.trim();
    const color = m.querySelector('#_smm_color').value;
    if(!title||!body){ uiToast('warning','Titre et contenu requis.'); return; }
    await supabase.from('notifications').insert({
      user_id:userId, text:`📣 <strong>${title}</strong> — ${body}`,
      color, read:false,
    });
    close();
    uiToast('success',`✓ Message envoyé à @${username}`);
    await logAction(`Message individuel envoyé`,`→ @${username} : "${title}"`);
  };
  m.onclick = e => { if(e.target===m) close(); };
}

function switchAdmTab(tab) {
  admTab=tab;
  document.querySelectorAll('.adm-tab').forEach(b=>{
    const isActive=b.dataset.tab===tab;
    b.classList.toggle('active',isActive);
    b.style.background=isActive?'var(--d3)':'var(--d4)';
    b.style.color=isActive?'var(--t1)':'var(--t2)';
    b.style.borderColor=isActive?'var(--b3)':'var(--b2)';
  });
  ['users','files','transfers','stats','visits','messages','logs'].forEach(p=>{
    const el=document.getElementById(`adm-panel-${p}`);
    if(el)el.style.display=p===tab?'block':'none';
  });
  if(tab==='visits') loadVisits();
  if(tab==='messages') loadMessages();
}

function setupAdminEvents() {
  document.querySelectorAll('.adm-tab').forEach(btn=>btn.addEventListener('click',function(){switchAdmTab(this.dataset.tab);}));
  document.querySelectorAll('.adm-filter').forEach(chip=>chip.addEventListener('click',function(){
    document.querySelectorAll('.adm-filter').forEach(c=>c.classList.remove('active'));
    this.classList.add('active');admFilter=this.dataset.filter;renderAdminUsers();
  }));
  document.getElementById('adm-search')?.addEventListener('input',()=>renderAdminUsers());
  document.getElementById('adm-load-files')?.addEventListener('click',()=>loadAllFiles(document.getElementById('adm-files-search')?.value||''));
  document.getElementById('adm-files-search')?.addEventListener('input',function(){if(this.value.length>2||this.value==='')loadAllFiles(this.value);});
  document.getElementById('adm-load-transfers')?.addEventListener('click',loadAllTransfers);
  document.getElementById('adm-refresh-logs')?.addEventListener('click',loadAdminLogs);
  document.getElementById('adm-logs-limit')?.addEventListener('change',loadAdminLogs);
  document.getElementById('adm-refresh-visits')?.addEventListener('click',loadVisits);
  document.getElementById('adm-visits-range')?.addEventListener('change',loadVisits);
  document.getElementById('adm-send-msg')?.addEventListener('click',sendPopupMessage);
  document.getElementById('adm-set-banner')?.addEventListener('click',setBanner);
  document.getElementById('adm-clear-banner')?.addEventListener('click',clearBanner);
  document.getElementById('banner-text')?.addEventListener('input',previewBanner);
  document.getElementById('banner-color')?.addEventListener('change',previewBanner);
  document.getElementById('adm-refresh-msgs')?.addEventListener('click',loadMessages);
  _hookShowPage();
}

let _adminInited=false;
function _hookShowPage() {
  const orig=window.showPage; if(!orig)return;
  window.showPage=function(id,el){
    orig(id,el);
    if(id==='admin'){
      if(!_adminInited){_adminInited=true;initAdmin();}
      else{loadAdminStats();renderAdminUsers();}
    }
  };
}

function _t(id,v){const e=document.getElementById(id);if(e)e.textContent=v;}

let _waitCount=0;
const _wait=setInterval(()=>{
  _waitCount++;
  if(state.profile){clearInterval(_wait);_hookShowPage();}
  if(_waitCount>40)clearInterval(_wait);
},100);
