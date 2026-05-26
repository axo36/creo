/* ══════════════════════════════════════════
   admin-update.js — Creo · Mise à jour auto
   Système indépendant de l'app principale.
   L'admin publie une version → les agents
   la détectent et se mettent à jour seuls.
══════════════════════════════════════════ */
import { supabase } from './supabase.js';
import { uiToast }  from './utils.js';

let updateData = null; // données chargées depuis Supabase

/* ══ INIT ══ */
export async function initUpdateTab() {
  await loadUpdateData();
  renderUpdateTab();
}

/* ══ CHARGER ══ */
async function loadUpdateData() {
  // Lire les versions publiées dans site_config
  const { data: cfg } = await supabase
    .from('site_config')
    .select('key, value')
    .in('key', ['app_version_windows', 'app_url_windows', 'app_update_notes', 'app_update_force', 'app_update_published']);

  const cfgMap = {};
  (cfg || []).forEach(r => { cfgMap[r.key] = r.value; });

  // Stats agents : combien ont la dernière version
  const { data: devices } = await supabase
    .from('devices')
    .select('id, name, client_code, creo_version, online, last_seen, outdated, os')
    .eq('browser', 'Creo Agent')
    .order('online', { ascending: false })
    .order('last_seen', { ascending: false });

  updateData = { cfgMap, devices: devices || [] };
}

/* ══ RENDER ══ */
export function renderUpdateTab() {
  const panel = document.getElementById('adm-panel-update');
  if (!panel || !updateData) return;

  const { cfgMap, devices } = updateData;
  const currentVer = cfgMap['app_version_windows'] || '3.2.1';
  const currentUrl = cfgMap['app_url_windows']     || '';
  const notes      = cfgMap['app_update_notes']    || '';
  const forceUpdate = cfgMap['app_update_force']   === 'true';

  const total    = devices.length;
  const upToDate = devices.filter(d => !d.outdated).length;
  const outdated = devices.filter(d =>  d.outdated).length;

  panel.innerHTML = `

    <!-- Stats rapides -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:1.6rem;">
      <div class="stat-card">
        <div class="stat-label">Agents</div>
        <div class="stat-val" style="color:var(--cyan);">${total}</div>
        <div class="stat-sub">enregistrés</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">À jour</div>
        <div class="stat-val" style="color:var(--green);">${upToDate}</div>
        <div class="stat-sub">v${currentVer}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Obsolètes</div>
        <div class="stat-val" style="color:${outdated>0?'var(--red)':'var(--t3)'};">${outdated}</div>
        <div class="stat-sub">${outdated>0?'à mettre à jour':'tout est bon'}</div>
      </div>
    </div>

    <!-- Publier une version — ultra simple -->
    <div style="background:var(--d2);border:1px solid var(--b2);border-radius:var(--r-xl);padding:1.4rem;margin-bottom:1.4rem;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:1rem;">
        // Publier une nouvelle version
      </div>

      <div style="display:grid;grid-template-columns:120px 1fr;gap:10px;margin-bottom:.8rem;align-items:center;">
        <div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:.58rem;color:var(--t3);margin-bottom:.3rem;">Numéro de version</div>
          <input type="text" id="upd-ver-win" value="${currentVer}"
            style="width:100%;background:var(--d3);border:1px solid var(--b2);border-radius:var(--r-lg);
                   padding:.5rem .75rem;color:var(--t1);font-size:.88rem;outline:none;
                   font-family:'JetBrains Mono',monospace;text-align:center;"
            placeholder="3.2.2">
        </div>
        <div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:.58rem;color:var(--t3);margin-bottom:.3rem;">URL du fichier .exe</div>
          <input type="text" id="upd-url-win" value="${currentUrl}"
            style="width:100%;background:var(--d3);border:1px solid var(--b2);border-radius:var(--r-lg);
                   padding:.5rem .75rem;color:var(--t1);font-size:.78rem;outline:none;
                   font-family:'JetBrains Mono',monospace;"
            placeholder="https://… /CreoAgent-Setup.exe">
        </div>
      </div>

      <div style="margin-bottom:.8rem;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:.58rem;color:var(--t3);margin-bottom:.3rem;">Notes (optionnel)</div>
        <textarea id="upd-notes" rows="2" placeholder="Quoi de neuf…"
          style="width:100%;background:var(--d3);border:1px solid var(--b2);border-radius:var(--r-lg);
                 padding:.5rem .75rem;color:var(--t1);font-size:.8rem;outline:none;
                 resize:none;font-family:'Outfit',sans-serif;line-height:1.5;">${notes}</textarea>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input type="checkbox" id="upd-force" ${forceUpdate?'checked':''}
            style="width:15px;height:15px;accent-color:var(--red);cursor:pointer;">
          <span style="font-size:.8rem;color:var(--t2);">
            Mise à jour <strong style="color:var(--red);">forcée</strong>
            <span style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--t3);"> — s'installe automatiquement sans demander</span>
          </span>
        </label>
        <button class="btn btn-primary" id="btn-publish-update" style="white-space:nowrap;gap:8px;">
          <span>⬆</span> <span>Publier</span>
        </button>
      </div>
    </div>

    <!-- Table agents -->
    <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--t3);text-transform:uppercase;margin-bottom:.6rem;">
      // État des agents
    </div>
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Appareil</th>
          <th>Version</th>
          <th>Statut</th>
          <th>Vu</th>
          <th></th>
        </tr></thead>
        <tbody>
          ${devices.length === 0
            ? `<tr><td colspan="5" class="table-empty">Aucun agent enregistré</td></tr>`
            : devices.map(d => {
                const old = d.outdated;
                return `<tr>
                  <td style="font-size:.82rem;color:var(--t1);">${d.name}</td>
                  <td><span style="font-family:'JetBrains Mono',monospace;font-size:.7rem;
                    color:${old?'var(--red)':'var(--green)'};">v${d.creo_version||'?'}</span></td>
                  <td>
                    <span style="font-family:'JetBrains Mono',monospace;font-size:.6rem;
                      padding:2px 8px;border-radius:99px;
                      background:${d.online?'rgba(0,255,136,.1)':old?'rgba(255,59,92,.08)':'var(--d5)'};
                      color:${d.online?'var(--green)':old?'var(--red)':'var(--t3)'};
                      border:1px solid ${d.online?'rgba(0,255,136,.2)':old?'rgba(255,59,92,.2)':'var(--b2)'};">
                      ${d.online?'● EN LIGNE':old?'⚠ OBSOLÈTE':'○ HORS LIGNE'}
                    </span>
                  </td>
                  <td style="font-family:'JetBrains Mono',monospace;font-size:.65rem;color:var(--t3);">
                    ${d.last_seen ? _timeAgo(new Date(d.last_seen)) : '—'}
                  </td>
                  <td>
                    <button class="btn btn-ghost btn-sm" style="font-size:.68rem;"
                      onclick="window.creoUpdate.forceDeviceUpdate('${d.id}','${d.name}')">
                      ⟳ Forcer
                    </button>
                  </td>
                </tr>`;
              }).join('')
          }
        </tbody>
      </table>
    </div>
  `;

  _setupUpdateEvents();
}




/* ══ EVENTS ══ */
function _setupUpdateEvents() {
  // Mise à jour live du preview JSON
  // Publier
  document.getElementById('btn-publish-update')?.addEventListener('click', publishUpdate);

  // API globale
  window.creoUpdate = {
    forceDeviceUpdate: async (deviceId, deviceName) => {
      if (!confirm(`Forcer la mise à jour de "${deviceName}" ?`)) return;
      const { error } = await supabase.from('devices').update({ outdated: true }).eq('id', deviceId);
      if (error) { uiToast('error', `Erreur : ${error.message}`); return; }
      uiToast('success', `✓ Mise à jour forcée pour ${deviceName}`);
      await loadUpdateData();
      renderUpdateTab();
    },
  };
}

/* ══ PUBLIER ══ */
async function publishUpdate() {
  const btn = document.getElementById('btn-publish-update');
  if (btn) { btn.textContent = 'Publication…'; btn.disabled = true; }

  const verWin = document.getElementById('upd-ver-win')?.value?.trim() || '3.2.1';
  const urlWin = document.getElementById('upd-url-win')?.value?.trim() || '';
  const notes  = document.getElementById('upd-notes')?.value?.trim()   || '';
  const force  = document.getElementById('upd-force')?.checked         || false;

  if (!urlWin) {
    uiToast('warning', 'Entre une URL .exe avant de publier');
    if (btn) { btn.innerHTML = '<span>⬆</span> <span>Publier</span>'; btn.disabled = false; }
    return;
  }

  const upserts = [
    { key: 'app_version_windows',  value: verWin },
    { key: 'app_url_windows',      value: urlWin },
    { key: 'app_update_notes',     value: notes },
    { key: 'app_update_force',     value: String(force) },
    { key: 'app_update_published', value: new Date().toISOString() },
  ];

  const { error } = await supabase.from('site_config').upsert(upserts, { onConflict: 'key' });

  if (error) {
    uiToast('error', `Erreur publication : ${error.message}`);
    if (btn) { btn.textContent = '⬆ Publier la mise à jour'; btn.disabled = false; }
    return;
  }

  // Marquer tous les agents avec une version différente comme "outdated"
  const { data: agentDevices } = await supabase
    .from('devices')
    .select('id, creo_version, os')
    .eq('browser', 'Creo Agent');

  if (agentDevices?.length) {
    const latest = verWin.replace(/^v/, '');
    for (const dev of agentDevices) {
      const devVer = (dev.creo_version || '').replace(/^v/, '');
      const isOld  = devVer !== latest;
      await supabase.from('devices').update({ outdated: isOld }).eq('id', dev.id);
    }
  }

  uiToast('success', `✓ v${verWin} publiée — les agents se mettront à jour automatiquement`);
  if (btn) { btn.textContent = '⬆ Publier la mise à jour'; btn.disabled = false; }

  await loadUpdateData();
  renderUpdateTab();
}

/* ══ UTILS ══ */
function _timeAgo(date) {
  const s = Math.round((Date.now() - date) / 1000);
  if (s < 60) return `${s}s`; if (s < 3600) return `${Math.round(s/60)}min`; if (s < 86400) return `${Math.round(s/3600)}h`;
  return `${Math.round(s/86400)}j`;
}
