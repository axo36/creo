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
    .in('key', ['app_version_windows', 'app_version_macos', 'app_version_linux', 'app_update_notes', 'app_update_force']);

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

  const currentWin   = cfgMap['app_version_windows'] || '3.2.1';
  const currentMac   = cfgMap['app_version_macos']   || '3.2.1';
  const currentLinux = cfgMap['app_version_linux']    || '3.2.1';
  const notes        = cfgMap['app_update_notes']     || '';
  const forceUpdate  = cfgMap['app_update_force']     === 'true';

  const totalAgents  = devices.length;
  const upToDate     = devices.filter(d => !d.outdated).length;
  const outdated     = devices.filter(d => d.outdated).length;
  const onlineAgents = devices.filter(d => d.online).length;

  panel.innerHTML = `
    <!-- Explication -->
    <div style="background:rgba(26,111,255,.04);border:1px solid rgba(26,111,255,.15);border-radius:var(--r-xl);padding:1rem 1.4rem;margin-bottom:1.8rem;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--blue2);margin-bottom:.3rem;">// Fonctionnement</div>
      <p style="font-size:.8rem;color:var(--t2);line-height:1.6;">
        Publie une nouvelle version ici → les agents Creo la détectent automatiquement au prochain démarrage et se mettent à jour sans intervention.
        Le fichier <code style="background:var(--d4);padding:0 5px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:.75rem;color:var(--amber);">version.json</code> est lu par chaque agent toutes les heures.
      </p>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:1.8rem;">
      <div class="stat-card">
        <div class="stat-label">Agents enregistrés</div>
        <div class="stat-val" style="color:var(--cyan);">${totalAgents}</div>
        <div class="stat-sub">${onlineAgents} en ligne</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">À jour</div>
        <div class="stat-val" style="color:var(--green);">${upToDate}</div>
        <div class="stat-sub">dernière version</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">À mettre à jour</div>
        <div class="stat-val" style="color:${outdated > 0 ? 'var(--red)' : 'var(--t3)'};">${outdated}</div>
        <div class="stat-sub">version obsolète</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Mise à jour forcée</div>
        <div class="stat-val" style="font-size:1rem;color:${forceUpdate ? 'var(--red)' : 'var(--t3)'};">${forceUpdate ? 'ACTIVE' : 'Non'}</div>
        <div class="stat-sub">${forceUpdate ? 'bloque les vieilles versions' : 'facultative'}</div>
      </div>
    </div>

    <!-- Publier une version -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.2rem;margin-bottom:2rem;">
      <div style="background:var(--d2);border:1px solid var(--b2);border-radius:var(--r-xl);padding:1.4rem;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--t3);text-transform:uppercase;margin-bottom:1rem;">// Versions publiées</div>
        <div class="field" style="margin-bottom:.8rem;">
          <label style="font-family:'JetBrains Mono',monospace;font-size:.58rem;color:var(--t3);text-transform:uppercase;display:block;margin-bottom:.3rem;">🪟 Windows</label>
          <div style="display:flex;gap:8px;">
            <input type="text" id="upd-ver-win" value="${currentWin}"
              style="flex:1;background:var(--d3);border:1px solid var(--b2);border-radius:var(--r-lg);padding:.45rem .75rem;color:var(--t1);font-size:.82rem;outline:none;font-family:'JetBrains Mono',monospace;">
            <input type="text" id="upd-url-win" value="${cfgMap['app_url_windows']||''}" placeholder="URL .exe"
              style="flex:2;background:var(--d3);border:1px solid var(--b2);border-radius:var(--r-lg);padding:.45rem .75rem;color:var(--t1);font-size:.72rem;outline:none;font-family:'JetBrains Mono',monospace;">
          </div>
        </div>
        <div class="field" style="margin-bottom:.8rem;">
          <label style="font-family:'JetBrains Mono',monospace;font-size:.58rem;color:var(--t3);text-transform:uppercase;display:block;margin-bottom:.3rem;">🍎 macOS</label>
          <div style="display:flex;gap:8px;">
            <input type="text" id="upd-ver-mac" value="${currentMac}"
              style="flex:1;background:var(--d3);border:1px solid var(--b2);border-radius:var(--r-lg);padding:.45rem .75rem;color:var(--t1);font-size:.82rem;outline:none;font-family:'JetBrains Mono',monospace;">
            <input type="text" id="upd-url-mac" value="${cfgMap['app_url_macos']||''}" placeholder="URL .dmg"
              style="flex:2;background:var(--d3);border:1px solid var(--b2);border-radius:var(--r-lg);padding:.45rem .75rem;color:var(--t1);font-size:.72rem;outline:none;font-family:'JetBrains Mono',monospace;">
          </div>
        </div>
        <div class="field" style="margin-bottom:1rem;">
          <label style="font-family:'JetBrains Mono',monospace;font-size:.58rem;color:var(--t3);text-transform:uppercase;display:block;margin-bottom:.3rem;">🐧 Linux</label>
          <div style="display:flex;gap:8px;">
            <input type="text" id="upd-ver-linux" value="${currentLinux}"
              style="flex:1;background:var(--d3);border:1px solid var(--b2);border-radius:var(--r-lg);padding:.45rem .75rem;color:var(--t1);font-size:.82rem;outline:none;font-family:'JetBrains Mono',monospace;">
            <input type="text" id="upd-url-linux" value="${cfgMap['app_url_linux']||''}" placeholder="URL .AppImage"
              style="flex:2;background:var(--d3);border:1px solid var(--b2);border-radius:var(--r-lg);padding:.45rem .75rem;color:var(--t1);font-size:.72rem;outline:none;font-family:'JetBrains Mono',monospace;">
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:.8rem;">
          <input type="checkbox" id="upd-force" ${forceUpdate ? 'checked' : ''}
            style="width:15px;height:15px;accent-color:var(--red);cursor:pointer;">
          <label for="upd-force" style="font-size:.8rem;color:var(--t1);cursor:pointer;">Mise à jour <strong style="color:var(--red);">forcée</strong> — bloque les vieilles versions</label>
        </div>
        <button class="btn btn-primary" id="btn-publish-update" style="width:100%;justify-content:center;">⬆ Publier la mise à jour</button>
      </div>

      <div style="background:var(--d2);border:1px solid var(--b2);border-radius:var(--r-xl);padding:1.4rem;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--t3);text-transform:uppercase;margin-bottom:.8rem;">// Notes de mise à jour</div>
        <textarea id="upd-notes" rows="6" placeholder="Quoi de neuf dans cette version…"
          style="width:100%;background:var(--d3);border:1px solid var(--b2);border-radius:var(--r-lg);padding:.7rem .9rem;color:var(--t1);font-size:.8rem;outline:none;resize:vertical;line-height:1.6;font-family:'Outfit',sans-serif;">${notes}</textarea>

        <!-- version.json preview -->
        <div style="margin-top:.8rem;">
          <div style="font-family:'JetBrains Mono',monospace;font-size:.58rem;color:var(--t3);text-transform:uppercase;margin-bottom:.4rem;">Aperçu version.json (lu par les agents)</div>
          <div id="version-json-preview" style="background:var(--d5);border:1px solid var(--b2);border-radius:var(--r-lg);padding:.8rem;font-family:'JetBrains Mono',monospace;font-size:.65rem;color:var(--t1);line-height:1.8;overflow-x:auto;white-space:pre;"></div>
        </div>
      </div>
    </div>

    <!-- Table agents -->
    <div style="margin-bottom:1rem;font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--t3);text-transform:uppercase;">// état des agents</div>
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Appareil</th>
          <th>Code</th>
          <th>Version</th>
          <th>Statut</th>
          <th>OS</th>
          <th>Vu</th>
          <th>Action</th>
        </tr></thead>
        <tbody>
          ${devices.length === 0
            ? `<tr><td colspan="7" class="table-empty">Aucun agent enregistré</td></tr>`
            : devices.map(d => {
                const isOld = d.outdated;
                return `<tr>
                  <td>
                    <div style="font-size:.82rem;color:var(--t1);">${d.name}</div>
                  </td>
                  <td><code style="font-family:'JetBrains Mono',monospace;font-size:.68rem;color:var(--blue2);background:rgba(26,111,255,.08);padding:1px 6px;border-radius:4px;">${d.client_code||'—'}</code></td>
                  <td><span style="font-family:'JetBrains Mono',monospace;font-size:.7rem;color:${isOld?'var(--red)':'var(--green)'};">v${d.creo_version||'?'}</span></td>
                  <td>
                    <span style="display:inline-flex;align-items:center;gap:4px;font-family:'JetBrains Mono',monospace;font-size:.58rem;padding:1px 7px;border-radius:99px;
                      background:${d.online?'rgba(0,255,136,.1)':isOld?'rgba(255,59,92,.08)':'var(--d5)'};
                      color:${d.online?'var(--green)':isOld?'var(--red)':'var(--t3)'};
                      border:1px solid ${d.online?'rgba(0,255,136,.2)':isOld?'rgba(255,59,92,.2)':'var(--b2)'};">
                      ${d.online ? '● EN LIGNE' : isOld ? '⚠ OBSOLÈTE' : '○ HORS LIGNE'}
                    </span>
                  </td>
                  <td style="font-size:.72rem;color:var(--t2);">${d.os||'—'}</td>
                  <td style="font-family:'JetBrains Mono',monospace;font-size:.65rem;color:var(--t3);">${d.last_seen ? _timeAgo(new Date(d.last_seen)) : '—'}</td>
                  <td>
                    <button class="btn btn-ghost btn-sm" style="font-size:.68rem;"
                      onclick="window.creoUpdate.forceDeviceUpdate('${d.id}', '${d.name}')">
                      ⟳ Forcer maj
                    </button>
                  </td>
                </tr>`;
              }).join('')
          }
        </tbody>
      </table>
    </div>
  `;

  // Preview JSON immédiat
  _updateJsonPreview();
  _setupUpdateEvents();
}

/* ══ PREVIEW JSON ══ */
function _updateJsonPreview() {
  const ver = {
    windows: document.getElementById('upd-ver-win')?.value  || '3.2.1',
    macos:   document.getElementById('upd-ver-mac')?.value  || '3.2.1',
    linux:   document.getElementById('upd-ver-linux')?.value|| '3.2.1',
  };
  const preview = document.getElementById('version-json-preview');
  if (!preview) return;
  preview.textContent = JSON.stringify({
    version:   ver,
    force:     document.getElementById('upd-force')?.checked || false,
    notes:     document.getElementById('upd-notes')?.value   || '',
    published: new Date().toISOString(),
    urls: {
      windows: document.getElementById('upd-url-win')?.value  || '',
      macos:   document.getElementById('upd-url-mac')?.value  || '',
      linux:   document.getElementById('upd-url-linux')?.value|| '',
    },
  }, null, 2);
}

/* ══ EVENTS ══ */
function _setupUpdateEvents() {
  // Mise à jour live du preview JSON
  ['upd-ver-win','upd-ver-mac','upd-ver-linux','upd-url-win','upd-url-mac','upd-url-linux','upd-notes','upd-force'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', _updateJsonPreview);
    document.getElementById(id)?.addEventListener('change', _updateJsonPreview);
  });

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

  const verWin   = document.getElementById('upd-ver-win')?.value?.trim()   || '3.2.1';
  const verMac   = document.getElementById('upd-ver-mac')?.value?.trim()   || '3.2.1';
  const verLinux = document.getElementById('upd-ver-linux')?.value?.trim() || '3.2.1';
  const urlWin   = document.getElementById('upd-url-win')?.value?.trim()   || '';
  const urlMac   = document.getElementById('upd-url-mac')?.value?.trim()   || '';
  const urlLinux = document.getElementById('upd-url-linux')?.value?.trim() || '';
  const notes    = document.getElementById('upd-notes')?.value?.trim()     || '';
  const force    = document.getElementById('upd-force')?.checked           || false;

  // Sauvegarder dans site_config
  const upserts = [
    { key: 'app_version_windows', value: verWin },
    { key: 'app_version_macos',   value: verMac },
    { key: 'app_version_linux',   value: verLinux },
    { key: 'app_url_windows',     value: urlWin },
    { key: 'app_url_macos',       value: urlMac },
    { key: 'app_url_linux',       value: urlLinux },
    { key: 'app_update_notes',    value: notes },
    { key: 'app_update_force',    value: String(force) },
    { key: 'app_update_published',value: new Date().toISOString() },
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
    .select('id, creo_version')
    .eq('browser', 'Creo Agent');

  if (agentDevices?.length) {
    for (const dev of agentDevices) {
      const devVer = (dev.creo_version || '').replace(/^v/, '');
      const latestVer = verWin.replace(/^v/, ''); // on compare avec Windows par défaut
      if (devVer !== latestVer) {
        await supabase.from('devices').update({ outdated: true }).eq('id', dev.id);
      }
    }
  }

  uiToast('success', `✓ Version publiée — les agents se mettront à jour automatiquement`);
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
