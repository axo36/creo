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
      <button class="adm-tab active" data-tab="users" style="padding:.45rem 1rem;border-radius:var(--r-lg);border:1px solid var(--b2);background:var(--d3);color:var(--t1);font-size:.8rem;cursor:pointer;transition:all .18s;">👤 Comptes</button>
      <button class="adm-tab" data-tab="files" style="padding:.45rem 1rem;border-radius:var(--r-lg);border:1px solid var(--b2);background:var(--d4);color:var(--t2);font-size:.8rem;cursor:pointer;transition:all .18s;">📂 Fichiers</button>
      <button class="adm-tab" data-tab="transfers" style="padding:.45rem 1rem;border-radius:var(--r-lg);border:1px solid var(--b2);background:var(--d4);color:var(--t2);font-size:.8rem;cursor:pointer;transition:all .18s;">⚡ Transferts</button>
      <button class="adm-tab" data-tab="stats" style="padding:.45rem 1rem;border-radius:var(--r-lg);border:1px solid var(--b2);background:var(--d4);color:var(--t2);font-size:.8rem;cursor:pointer;transition:all .18s;">📊 Statistiques</button>
      <button class="adm-tab" data-tab="logs" style="padding:.45rem 1rem;border-radius:var(--r-lg);border:1px solid var(--b2);background:var(--d4);color:var(--t2);font-size:.8rem;cursor:pointer;transition:all .18s;">🗒 Logs</button>
    </div>
    <div class="stat-grid stat-grid-4" style="margin-bottom:1.8rem;" id="adm-kpi-row">
      <div class="stat-card"><div class="stat-label">Utilisateurs</div><div class="stat-val" id="adm-total-users">—</div><div class="stat-sub" id="adm-new-users">chargement…</div></div>
      <div class="stat-card"><div class="stat-label">Fichiers sur le site</div><div class="stat-val" id="adm-total-files">—</div><div class="stat-sub" id="adm-total-size">—</div></div>
      <div class="stat-card"><div class="stat-label">Actifs (7 jours)</div><div class="stat-val" id="adm-active-users">—</div><div class="stat-sub">ont uploadé cette semaine</div></div>
      <div class="stat-card"><div class="stat-label">Stockage total</div><div class="stat-val" id="adm-storage">—</div><div class="stat-sub">tous les comptes</div></div>
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

    <!-- Stats -->
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

/* ══ Charger TOUS les users
   Nécessite dans Supabase SQL Editor :
   CREATE OR REPLACE FUNCTION get_all_profiles()
   RETURNS SETOF profiles LANGUAGE sql SECURITY DEFINER AS $$
     SELECT * FROM profiles ORDER BY created_at DESC;
   $$;
   Et dans Authentication > Policies, ajouter une SELECT policy sur profiles pour admins.
══ */
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
    const actHtml=canEdit?`<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">
        <select class="adm-role-sel" data-uid="${u.id}" style="background:var(--d4);border:1px solid var(--b2);border-radius:var(--r);padding:3px 6px;color:var(--t1);font-size:.7rem;cursor:pointer;outline:none;">
          ${ROLES.map(r=>`<option value="${r}"${r===role?' selected':''}>${r}</option>`).join('')}
        </select>
        ${!isMe?`<button class="adm-ban-btn btn btn-ghost btn-xs" data-uid="${u.id}" data-name="${name}" title="Supprimer le compte" style="color:var(--red);border-color:rgba(255,59,92,.3);">✕</button>`:''}
        <button class="adm-view-btn btn btn-ghost btn-xs" data-uid="${u.id}" data-name="${name}" title="Voir les fichiers">📂</button>
      </div>`:`<span style="font-size:.7rem;color:var(--t3);">lecture seule</span>`;
    return `<tr${isMe?' style="background:rgba(26,111,255,.04);"':''}>
      <td><div style="display:flex;align-items:center;gap:8px;">${av}<div>
        <div style="font-size:.84rem;color:var(--t1);">${name}${isMe?` <span style="font-size:.58rem;color:var(--blue2);border:1px solid var(--blue2);border-radius:99px;padding:1px 5px;">vous</span>`:''}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--t3);">@${u.username||'—'} · ${u._devices} app.</div>
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
    tbody.querySelectorAll('.adm-role-sel').forEach(sel=>sel.addEventListener('change',async function(){await changeUserRole(this.dataset.uid,this.value);}));
    tbody.querySelectorAll('.adm-ban-btn').forEach(btn=>btn.addEventListener('click',function(){banUser(this.dataset.uid,this.dataset.name);}));
  }
  tbody.querySelectorAll('.adm-view-btn').forEach(btn=>btn.addEventListener('click',function(){viewUserFiles(this.dataset.uid,this.dataset.name);}));
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
  if(canDel) tbody.querySelectorAll('.adm-del-file').forEach(btn=>btn.addEventListener('click',async function(){await deleteFile(this.dataset.fid,this.dataset.path);loadAllFiles(searchQ);}));
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
  if(canDel) tbody.querySelectorAll('.adm-del-file').forEach(btn=>btn.addEventListener('click',async function(){await deleteFile(this.dataset.fid,this.dataset.path);loadAllTransfers();}));
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
  if(canDel) tbody.querySelectorAll('.adm-del-file').forEach(btn=>btn.addEventListener('click',async function(){await deleteFile(this.dataset.fid,this.dataset.path);viewUserFiles(userId,name);}));
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
  if(!confirm(`Supprimer le compte de "${name}" ?\nSes fichiers seront aussi supprimés. Irréversible.`))return;
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
  if(!confirm('Supprimer ce fichier définitivement ?'))return;
  if(storagePath)await supabase.storage.from('creo-files').remove([storagePath]);
  await supabase.from('files').delete().eq('id',fileId);
  uiToast('success','✓ Fichier supprimé');
  await logAction('Fichier supprimé par admin',fileId);
}

async function logAction(action,detail='') {
  await supabase.from('notifications').insert({user_id:state.session.user.id,text:`[ADMIN] ${action}${detail?' — '+detail:''}`,color:'var(--red)',read:false});
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
  ['users','files','transfers','stats','logs'].forEach(p=>{
    const el=document.getElementById(`adm-panel-${p}`);
    if(el)el.style.display=p===tab?'block':'none';
  });
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
