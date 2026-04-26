/* ══════════════════════════════════════════
   admin-app.js — Creo · Onglet App
   • Envoi de fichiers vers appareils agents
   • Suivi des téléchargements de l'app
   • Tous les admins voient tous les appareils
══════════════════════════════════════════ */
import { supabase } from './supabase.js';
import { state }    from './state.js';
import { uiToast, timeAgo, formatBytes } from './utils.js';

/* ── Versions de l'app ── */
const APP_VERSIONS = {
  windows: { label:'Windows', icon:'🪟', version:'3.2.1', size:'52 MB', requirements:'Windows 10/11 · 64-bit', filename:'CreoSetup-3.2.1.exe', base_url:'https://mpnfvrizbluhhjcfzztc.supabase.co/storage/v1/object/public/app-releases/CreoSetup-3.2.1.exe' },
  macos:   { label:'macOS',   icon:'🍎', version:'3.2.1', size:'48 MB', requirements:'macOS 12+ · Apple Silicon + Intel', filename:'Creo-3.2.1.dmg', base_url:'https://mpnfvrizbluhhjcfzztc.supabase.co/storage/v1/object/public/app-releases/Creo-3.2.1.dmg' },
  linux:   { label:'Linux',   icon:'🐧', version:'3.2.1', size:'44 MB', requirements:'Ubuntu 20.04+ / Debian / Fedora', filename:'creo-3.2.1.AppImage', base_url:'https://mpnfvrizbluhhjcfzztc.supabase.co/storage/v1/object/public/app-releases/creo-3.2.1.AppImage' },
};

let allDownloads = [];
let allDevices   = [];
let dlFilter = 'all', dlSearch = '';
let appSubTab = 'devices'; // 'devices' | 'downloads'
let selectedDeviceId = null;

/* ══ INIT ══ */
export async function initAppTab() {
  await Promise.all([loadDownloadLogs(), loadDevices()]);
  renderAppTab();
}

/* ══ CHARGER DONNÉES ══ */
async function loadDownloadLogs() {
  const { data, error } = await supabase
    .from('app_downloads')
    .select('*, profiles(username, email, avatar_url, type)')
    .order('created_at', { ascending: false })
    .limit(500);
  allDownloads = error ? null : (data || []);
}

async function loadDevices() {
  // Charger via la vue v_admin_devices qui inclut TOUS les appareils
  // même ceux sans user_id (agents partagés)
  let { data, error } = await supabase
    .from('v_admin_devices')
    .select('*');

  // Fallback sur la table directe si la vue n'existe pas encore
  if (error) {
    const res = await supabase
      .from('devices')
      .select('id, name, client_code, type, os, online, last_seen, icon, creo_version, outdated, user_id, fingerprint, profiles(username, email, type)')
      .order('online', { ascending: false })
      .order('last_seen', { ascending: false });
    data = res.data;
  }
  allDevices = data || [];
}

/* ══ RENDER PRINCIPAL ══ */
export function renderAppTab() {
  const panel = document.getElementById('adm-panel-app');
  if (!panel) return;

  // KPIs appareils
  const online   = allDevices.filter(d => d.online).length;
  const totalDev = allDevices.length;
  const totalDl  = allDownloads?.length || 0;
  const todayDl  = allDownloads?.filter(d => Date.now() - new Date(d.created_at) < 86400000).length || 0;

  panel.innerHTML = `
    <!-- Sous-onglets -->
    <div style="display:flex;gap:6px;margin-bottom:1.6rem;flex-wrap:wrap;">
      <button class="app-sub-tab ${appSubTab==='devices'?'active':''}" data-subtab="devices"
        style="${_subTabStyle(appSubTab==='devices')}">🖥️ Appareils & Envoi</button>
      <button class="app-sub-tab ${appSubTab==='downloads'?'active':''}" data-subtab="downloads"
        style="${_subTabStyle(appSubTab==='downloads')}">📊 Téléchargements app</button>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:1.8rem;">
      <div class="stat-card">
        <div class="stat-label">Appareils enregistrés</div>
        <div class="stat-val" style="color:var(--cyan);">${totalDev}</div>
        <div class="stat-sub">${online} en ligne</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">En ligne maintenant</div>
        <div class="stat-val" style="color:var(--green);">${online}</div>
        <div class="stat-sub">actifs dans les 2 min</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Téléchargements app</div>
        <div class="stat-val">${totalDl}</div>
        <div class="stat-sub">${todayDl} aujourd'hui</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Versions actives</div>
        <div class="stat-val" style="color:var(--blue2);">${Object.keys(APP_VERSIONS).length}</div>
        <div class="stat-sub">Win · Mac · Linux</div>
      </div>
    </div>

    <!-- Panel appareils & envoi -->
    <div id="app-sub-devices" style="display:${appSubTab==='devices'?'block':'none'};">
      ${_renderDevicesPanel()}
    </div>

    <!-- Panel téléchargements -->
    <div id="app-sub-downloads" style="display:${appSubTab==='downloads'?'block':'none'};">
      ${_renderDownloadsPanel()}
    </div>
  `;

  _setupAppEvents(panel);
}

/* ══ PANEL APPAREILS & ENVOI ══ */
function _renderDevicesPanel() {
  return `
    <!-- Grille appareils -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:.65rem;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;">
        // ${allDevices.length} appareil(s) connecté(s) à Creo Agent
      </div>
      <button class="btn btn-ghost btn-sm" id="btn-refresh-devices">↺ Actualiser</button>
    </div>

    ${allDevices.length === 0 ? `
      <div style="background:rgba(255,184,0,.04);border:1px solid rgba(255,184,0,.2);border-radius:var(--r-xl);padding:2rem;text-align:center;margin-bottom:1.5rem;">
        <div style="font-size:1.8rem;margin-bottom:.8rem;">🖥️</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:.72rem;color:var(--amber);margin-bottom:.5rem;">AUCUN APPAREIL</div>
        <div style="font-size:.8rem;color:var(--t2);">Installe Creo Agent sur un PC Windows — il apparaîtra ici automatiquement.</div>
      </div>
    ` : `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-bottom:1.5rem;" id="devices-grid-admin">
        ${allDevices.map(d => _deviceCard(d)).join('')}
      </div>
    `}

    <!-- Zone d'envoi de fichier -->
    <div style="background:var(--d2);border:1px solid var(--b2);border-radius:var(--r-xl);padding:1.6rem;" id="send-file-zone">
      <div style="font-family:'JetBrains Mono',monospace;font-size:.65rem;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:1.2rem;">
        // envoyer un fichier vers un appareil
      </div>

      ${allDevices.length === 0 ? `
        <div style="font-size:.82rem;color:var(--t3);text-align:center;padding:1rem;">Aucun appareil disponible.</div>
      ` : `
        <div style="margin-bottom:1rem;">
          <div style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--t3);text-transform:uppercase;margin-bottom:.5rem;">1. Choisir l'appareil</div>
          <select id="send-device-sel"
            style="width:100%;background:var(--d3);border:1px solid var(--b2);border-radius:var(--r-lg);padding:.55rem .9rem;color:var(--t1);font-size:.82rem;outline:none;">
            <option value="">— Sélectionner un appareil —</option>
            ${allDevices.map(d => `
              <option value="${d.id}">
                ${d.online ? '🟢' : '⚫'} ${d.name}${d.client_code ? ' · ' + d.client_code : ''}${d.profiles?.username ? ' (@' + d.profiles.username + ')' : ''}
              </option>
            `).join('')}
          </select>
        </div>

        <div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--t3);text-transform:uppercase;margin-bottom:.5rem;">2. Choisir le fichier</div>
          <div id="admin-drop-zone"
            style="border:2px dashed var(--b3);border-radius:var(--r-xl);padding:2rem;text-align:center;cursor:pointer;transition:all .2s;background:var(--d3);"
            ondragover="event.preventDefault();this.style.borderColor='rgba(26,111,255,.5)';this.style.background='rgba(26,111,255,.04)';"
            ondragleave="this.style.borderColor='var(--b3)';this.style.background='var(--d3)';">
            <input type="file" id="admin-file-input" multiple style="display:none;">
            <div style="font-size:1.6rem;margin-bottom:.5rem;opacity:.5;">📁</div>
            <div style="font-size:.85rem;color:var(--t1);margin-bottom:.2rem;">Glisse ou clique pour choisir</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--t3);">Tous formats — envoi immédiat sur l'appareil</div>
          </div>
          <div id="admin-send-progress" style="margin-top:.8rem;"></div>
        </div>
      `}
    </div>
  `;
}

function _deviceCard(d) {
  const online   = d.online;
  const lastSeen = d.last_seen ? _timeAgo(new Date(d.last_seen)) : '—';
  const code     = d.client_code || '—';
  const owner    = d.profiles?.username ? `@${d.profiles.username}` : 'Agent partagé';

  return `
    <div style="background:var(--d2);border:1px solid ${online ? 'rgba(0,255,136,.2)' : 'var(--b2)'};
                border-radius:var(--r-xl);padding:1rem 1.1rem;position:relative;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.6rem;">
        <span style="font-size:1.2rem;">${d.icon || '🖥️'}</span>
        <span style="display:inline-flex;align-items:center;gap:4px;
          font-family:'JetBrains Mono',monospace;font-size:.55rem;padding:2px 7px;border-radius:99px;
          background:${online ? 'rgba(0,255,136,.1)' : 'var(--d5)'};
          color:${online ? 'var(--green)' : 'var(--t3)'};
          border:1px solid ${online ? 'rgba(0,255,136,.2)' : 'var(--b2)'};">
          <span style="width:4px;height:4px;border-radius:50%;background:currentColor;${online ? 'box-shadow:0 0 4px currentColor;' : ''}"></span>
          ${online ? 'EN LIGNE' : 'HORS LIGNE'}
        </span>
      </div>
      <div style="font-size:.84rem;color:var(--t1);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;">${d.name}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--blue2);margin-bottom:3px;">${code}</div>
      <div style="font-size:.7rem;color:var(--t3);">${owner}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:.58rem;color:var(--t3);margin-top:4px;">
        ${online ? '● actif maintenant' : `vu ${lastSeen}`}
      </div>
    </div>`;
}

/* ══ PANEL TÉLÉCHARGEMENTS ══ */
function _renderDownloadsPanel() {
  const total    = allDownloads?.length || 0;
  const today    = allDownloads?.filter(d => Date.now() - new Date(d.created_at) < 86400000).length || 0;
  const winCount = allDownloads?.filter(d => d.platform === 'windows').length || 0;
  const macCount = allDownloads?.filter(d => d.platform === 'macos').length || 0;
  const linCount = allDownloads?.filter(d => d.platform === 'linux').length || 0;

  return `
    <!-- Versions app -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:2rem;">
      ${Object.entries(APP_VERSIONS).map(([key, v]) => `
        <div style="background:var(--d2);border:1px solid var(--b2);border-radius:var(--r-xl);padding:1.2rem;transition:border-color .2s;"
             onmouseover="this.style.borderColor='rgba(26,111,255,.3)'" onmouseout="this.style.borderColor='var(--b2)'">
          <div style="font-size:1.6rem;margin-bottom:.6rem;">${v.icon}</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1rem;letter-spacing:.06em;color:var(--white);margin-bottom:.2rem;">${v.label}</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--blue2);margin-bottom:.4rem;">v${v.version} · ${v.size}</div>
          <div style="font-size:.7rem;color:var(--t3);margin-bottom:.8rem;">${v.requirements}</div>
          <button class="btn btn-ghost btn-sm" onclick="window.creoApp.editVersion('${key}')" style="width:100%;justify-content:center;font-size:.72rem;">✏ Modifier URL</button>
        </div>
      `).join('')}
    </div>

    <!-- Générateur de lien -->
    <div style="background:var(--d2);border:1px solid rgba(26,111,255,.2);border-radius:var(--r-xl);padding:1.4rem;margin-bottom:1.8rem;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--blue2);text-transform:uppercase;margin-bottom:.8rem;">// Lien de téléchargement tracké</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <select id="app-link-platform" style="background:var(--d4);border:1px solid var(--b2);border-radius:var(--r);padding:.42rem .8rem;color:var(--t1);font-size:.8rem;outline:none;">
          <option value="windows">🪟 Windows</option>
          <option value="macos">🍎 macOS</option>
          <option value="linux">🐧 Linux</option>
        </select>
        <input id="app-link-userid" type="text" placeholder="User ID (optionnel)"
          style="flex:1;min-width:180px;background:var(--d4);border:1px solid var(--b2);border-radius:var(--r);padding:.42rem .8rem;color:var(--t1);font-size:.8rem;outline:none;font-family:'JetBrains Mono',monospace;">
        <button class="btn btn-primary btn-sm" onclick="window.creoApp.generateLink()">⚡ Générer</button>
      </div>
      <div id="app-generated-link" style="display:none;margin-top:.8rem;background:var(--d4);border:1px solid var(--b2);border-radius:var(--r);padding:.7rem .9rem;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:.58rem;color:var(--t3);margin-bottom:.3rem;">Lien généré :</div>
        <div style="display:flex;gap:8px;align-items:center;">
          <code id="app-link-output" style="flex:1;font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--blue2);word-break:break-all;"></code>
          <button class="btn btn-ghost btn-sm" onclick="window.creoApp.copyLink()">📋</button>
        </div>
      </div>
    </div>

    <!-- Table téléchargements -->
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:.8rem;flex-wrap:wrap;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--t3);text-transform:uppercase;margin-right:.3rem;">// journal</div>
      ${['all','windows','macos','linux'].map(f => `
        <div class="filter-chip adm-dl-filter ${f==='all'?'active':''}" data-filter="${f}" style="cursor:pointer;">${f==='all'?'Tous':f==='windows'?'🪟 Win':f==='macos'?'🍎 Mac':'🐧 Linux'}</div>
      `).join('')}
      <input type="text" id="adm-dl-search" placeholder="Rechercher…"
        style="background:var(--d3);border:1px solid var(--b2);border-radius:var(--r-lg);padding:.35rem .75rem;color:var(--t1);font-size:.76rem;outline:none;width:180px;font-family:'JetBrains Mono',monospace;"
        oninput="window.creoApp.searchDl(this.value)">
      <button class="btn btn-ghost btn-sm" onclick="window.creoApp.refreshDl()">↺</button>
      <button class="btn btn-ghost btn-sm" onclick="window.creoApp.exportDlCSV()">⬇ CSV</button>
    </div>

    ${allDownloads === null ? _renderSetupSQL() : _renderDlTable()}
  `;
}

function _renderDlTable() {
  const filtered = _getFilteredDl();
  if (!filtered.length) return `<div style="text-align:center;padding:2rem;color:var(--t3);font-family:'JetBrains Mono',monospace;font-size:.72rem;">Aucun téléchargement enregistré.</div>`;

  return `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr><th>Utilisateur</th><th>Plateforme</th><th>Version</th><th>IP</th><th>Date</th></tr></thead>
        <tbody id="adm-dl-tbody">
          ${filtered.map(d => {
            const u = d.profiles;
            const pInfo = APP_VERSIONS[d.platform] || {};
            return `<tr>
              <td>
                <div style="display:flex;align-items:center;gap:8px;">
                  <div style="width:26px;height:26px;background:linear-gradient(135deg,var(--blue),var(--purple));border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.62rem;font-weight:600;color:#fff;flex-shrink:0;overflow:hidden;">
                    ${u?.avatar_url ? `<img src="${u.avatar_url}" style="width:100%;height:100%;object-fit:cover;">` : (u?.username||'?').slice(0,2).toUpperCase()}
                  </div>
                  <div>
                    <div style="font-size:.8rem;color:var(--t1);">${u?.username||'Invité'}</div>
                    <div style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--t3);">${u?.email||d.user_id||'—'}</div>
                  </div>
                </div>
              </td>
              <td><span style="display:inline-flex;align-items:center;gap:4px;background:var(--d4);border:1px solid var(--b2);border-radius:99px;padding:1px 8px;font-size:.7rem;font-family:'JetBrains Mono',monospace;color:var(--t2);">${pInfo.icon||'💾'} ${d.platform||'—'}</span></td>
              <td><span style="font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--blue2);">v${d.version||'—'}</span></td>
              <td><span style="font-family:'JetBrains Mono',monospace;font-size:.65rem;color:var(--t3);">${d.ip_address||'—'}</span></td>
              <td>
                <div style="font-size:.76rem;color:var(--t2);">${timeAgo(d.created_at)}</div>
                <div style="font-family:'JetBrains Mono',monospace;font-size:.58rem;color:var(--t3);">${new Date(d.created_at).toLocaleDateString('fr')}</div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--t3);margin-top:.6rem;">${filtered.length} enregistrement(s)</div>
  `;
}

function _renderSetupSQL() {
  return `
    <div style="background:rgba(255,184,0,.04);border:1px solid rgba(255,184,0,.2);border-radius:var(--r-xl);padding:1.6rem;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:var(--amber);margin-bottom:.8rem;">⚠ Table app_downloads manquante</div>
      <p style="font-size:.8rem;color:var(--t2);margin-bottom:1rem;">Exécute ce SQL dans Supabase > SQL Editor :</p>
      <div style="background:var(--d5);border:1px solid var(--b2);border-radius:var(--r-lg);padding:1rem;font-family:'JetBrains Mono',monospace;font-size:.68rem;color:var(--t1);line-height:1.9;overflow-x:auto;white-space:pre;">CREATE TABLE IF NOT EXISTS public.app_downloads (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  platform   TEXT NOT NULL,
  version    TEXT NOT NULL DEFAULT '3.2.1',
  ip_address TEXT,
  user_agent TEXT,
  token      TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.app_downloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin reads" ON public.app_downloads FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND type IN ('admin','sous-admin')));
CREATE POLICY "Insert own" ON public.app_downloads FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);</div>
      <div style="margin-top:1rem;display:flex;gap:8px;">
        <a href="https://supabase.com/dashboard" target="_blank" class="btn btn-primary btn-sm">Ouvrir Supabase →</a>
        <button class="btn btn-ghost btn-sm" onclick="window.creoApp.refreshDl()">↺ Actualiser</button>
      </div>
    </div>`;
}

/* ══ UPLOAD + ENVOI VERS APPAREIL ══ */
async function uploadAndSendToDevice(file, deviceId) {
  const progress = document.getElementById('admin-send-progress');
  if (progress) progress.innerHTML = _progressHTML(`⬆ Upload de ${file.name}…`);

  // 1. Upload dans Supabase Storage
  const ext      = file.name.split('.').pop();
  const safeName = `agent-sends/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('files')
    .upload(safeName, file, { contentType: file.type, upsert: false });

  if (upErr) {
    if (progress) progress.innerHTML = _errorHTML(`Upload échoué : ${upErr.message}`);
    return;
  }

  // 2. URL publique
  const { data: urlData } = supabase.storage.from('files').getPublicUrl(safeName);
  const publicUrl = urlData?.publicUrl;
  if (!publicUrl) { if (progress) progress.innerHTML = _errorHTML('URL introuvable'); return; }

  // 3. Créer la ligne dans files avec target_device_id
  const { error: dbErr } = await supabase.from('files').insert({
    user_id:          state.session?.user?.id || null,
    name:             file.name,
    type:             _guessType(file.type, file.name),
    size_bytes:       file.size,
    size_label:       formatBytes(file.size),
    status:           'done',
    public_url:       publicUrl,
    storage_path:     safeName,
    mime_type:        file.type || null,
    target_device_id: deviceId,
    created_at:       new Date().toISOString(),
  });

  if (dbErr) {
    if (progress) progress.innerHTML = _errorHTML(`Erreur base de données : ${dbErr.message}`);
    return;
  }

  if (progress) progress.innerHTML = `
    <div style="background:rgba(0,255,136,.06);border:1px solid rgba(0,255,136,.2);border-radius:var(--r-lg);padding:.65rem 1rem;font-size:.8rem;color:var(--green);">
      ✓ <strong>${file.name}</strong> envoyé — l'appareil va le télécharger automatiquement dans les 12 secondes.
    </div>`;

  uiToast('success', `📤 ${file.name} envoyé vers l'appareil`);
}

/* ══ EVENTS ══ */
function _setupAppEvents(panel) {
  // Sous-onglets
  panel.querySelectorAll('.app-sub-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      appSubTab = btn.dataset.subtab;
      panel.querySelectorAll('.app-sub-tab').forEach(b => b.style.cssText = _subTabStyle(false));
      btn.style.cssText = _subTabStyle(true);
      ['devices','downloads'].forEach(t => {
        const el = document.getElementById(`app-sub-${t}`);
        if (el) el.style.display = t === appSubTab ? 'block' : 'none';
      });
    });
  });

  // Filtres téléchargements
  panel.querySelectorAll('.adm-dl-filter').forEach(chip => {
    chip.addEventListener('click', () => {
      panel.querySelectorAll('.adm-dl-filter').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      dlFilter = chip.dataset.filter;
      _updateDlTable();
    });
  });

  // Refresh appareils
  document.getElementById('btn-refresh-devices')?.addEventListener('click', async () => {
    await loadDevices();
    renderAppTab();
    uiToast('success', '↺ Appareils actualisés');
  });

  // Drop zone envoi
  const dropZone  = document.getElementById('admin-drop-zone');
  const fileInput = document.getElementById('admin-file-input');

  dropZone?.addEventListener('click', () => fileInput?.click());
  dropZone?.addEventListener('drop', async e => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--b3)';
    dropZone.style.background  = 'var(--d3)';
    const deviceSel = document.getElementById('send-device-sel');
    const devId = deviceSel?.value;
    if (!devId) { uiToast('warning', 'Sélectionne un appareil d\'abord'); return; }
    const files = [...e.dataTransfer.files];
    for (const f of files) await uploadAndSendToDevice(f, devId);
  });

  fileInput?.addEventListener('change', async () => {
    const deviceSel = document.getElementById('send-device-sel');
    const devId = deviceSel?.value;
    if (!devId) { uiToast('warning', 'Sélectionne un appareil d\'abord'); return; }
    const files = [...fileInput.files];
    for (const f of files) await uploadAndSendToDevice(f, devId);
    fileInput.value = '';
  });

  // API globale
  window.creoApp = {
    searchDl:  (v) => { dlSearch = v; _updateDlTable(); },
    refreshDl: async () => { await loadDownloadLogs(); renderAppTab(); uiToast('success', '↺ Actualisé'); },
    generateLink: () => {
      const platform = document.getElementById('app-link-platform')?.value;
      const userId   = document.getElementById('app-link-userid')?.value?.trim();
      const token    = btoa([userId||'anon', platform, Date.now()].join('|'));
      const url      = `${window.location.origin}/menu/download-secure.html?platform=${platform}&token=${token}${userId?'&uid='+userId:''}`;
      document.getElementById('app-generated-link').style.display = 'block';
      document.getElementById('app-link-output').textContent = url;
    },
    copyLink: () => {
      const txt = document.getElementById('app-link-output')?.textContent;
      if (txt) navigator.clipboard.writeText(txt).then(() => uiToast('success', '📋 Lien copié !'));
    },
    editVersion: (key) => {
      const v = APP_VERSIONS[key]; if (!v) return;
      const newUrl = prompt(`URL pour ${v.label} :`, v.base_url);
      if (newUrl !== null) { APP_VERSIONS[key].base_url = newUrl.trim(); renderAppTab(); uiToast('success', `✓ URL ${v.label} mise à jour`); }
    },
    exportDlCSV: () => {
      if (!allDownloads?.length) { uiToast('info', 'Aucune donnée'); return; }
      const rows = [['Utilisateur','Email','Plateforme','Version','IP','Date'].join(','),
        ...allDownloads.map(d => [d.profiles?.username||'',d.profiles?.email||'',d.platform,d.version,d.ip_address||'',d.created_at].map(v=>`"${v}"`).join(','))].join('\n');
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([rows],{type:'text/csv'})), download:`creo-downloads-${new Date().toISOString().slice(0,10)}.csv` });
      a.click();
    },
  };
}

/* ══ HELPERS ══ */
function _subTabStyle(active) {
  return `padding:.42rem 1rem;border-radius:var(--r-lg);font-size:.8rem;cursor:pointer;transition:all .18s;
    border:1px solid ${active ? 'rgba(26,111,255,.3)' : 'var(--b2)'};
    background:${active ? 'rgba(26,111,255,.1)' : 'var(--d4)'};
    color:${active ? 'var(--blue2)' : 'var(--t2)'};`;
}

function _getFilteredDl() {
  if (!allDownloads) return [];
  return allDownloads.filter(d => {
    const matchP = dlFilter === 'all' || d.platform === dlFilter;
    const q = dlSearch.toLowerCase();
    const matchS = !q || (d.profiles?.username||'').toLowerCase().includes(q) || (d.profiles?.email||'').toLowerCase().includes(q) || (d.ip_address||'').includes(q);
    return matchP && matchS;
  });
}

function _updateDlTable() {
  const tbody = document.getElementById('adm-dl-tbody');
  if (!tbody) return;
  tbody.innerHTML = _getFilteredDl().map(d => {
    const u = d.profiles, pInfo = APP_VERSIONS[d.platform]||{};
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:8px;"><div style="width:26px;height:26px;background:linear-gradient(135deg,var(--blue),var(--purple));border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.62rem;font-weight:600;color:#fff;flex-shrink:0;overflow:hidden;">${u?.avatar_url?`<img src="${u.avatar_url}" style="width:100%;height:100%;object-fit:cover;">`:(u?.username||'?').slice(0,2).toUpperCase()}</div><div><div style="font-size:.8rem;color:var(--t1);">${u?.username||'Invité'}</div><div style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--t3);">${u?.email||'—'}</div></div></div></td>
      <td><span style="display:inline-flex;align-items:center;gap:4px;background:var(--d4);border:1px solid var(--b2);border-radius:99px;padding:1px 8px;font-size:.7rem;font-family:'JetBrains Mono',monospace;color:var(--t2);">${pInfo.icon||'💾'} ${d.platform||'—'}</span></td>
      <td><span style="font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--blue2);">v${d.version||'—'}</span></td>
      <td><span style="font-family:'JetBrains Mono',monospace;font-size:.65rem;color:var(--t3);">${d.ip_address||'—'}</span></td>
      <td><div style="font-size:.76rem;color:var(--t2);">${timeAgo(d.created_at)}</div><div style="font-family:'JetBrains Mono',monospace;font-size:.58rem;color:var(--t3);">${new Date(d.created_at).toLocaleDateString('fr')}</div></td>
    </tr>`;
  }).join('') || `<tr><td colspan="5" style="text-align:center;color:var(--t3);font-size:.75rem;padding:1.5rem;">Aucun résultat</td></tr>`;
}

function _progressHTML(msg) {
  return `<div style="font-family:'JetBrains Mono',monospace;font-size:.72rem;color:var(--blue2);">${msg}</div>
    <div style="height:3px;background:var(--d5);border-radius:99px;overflow:hidden;margin-top:.4rem;">
      <div style="height:100%;background:linear-gradient(90deg,var(--blue),var(--cyan));border-radius:99px;animation:progAnim .8s ease infinite alternate;width:60%;"></div>
    </div>`;
}

function _errorHTML(msg) {
  return `<div style="background:rgba(255,59,92,.06);border:1px solid rgba(255,59,92,.2);border-radius:var(--r-lg);padding:.6rem .9rem;font-size:.8rem;color:var(--red);">✗ ${msg}</div>`;
}

function _guessType(mime, name) {
  if (!mime && name) { const ext = name.split('.').pop().toLowerCase(); if (['mp4','mov','avi','mkv'].includes(ext)) return 'video'; if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return 'image'; if (['mp3','wav','ogg'].includes(ext)) return 'audio'; if (['zip','rar','7z','tar'].includes(ext)) return 'archive'; if (['pdf','doc','docx','xls','xlsx'].includes(ext)) return 'doc'; }
  if (!mime) return 'other';
  if (mime.startsWith('video/')) return 'video'; if (mime.startsWith('image/')) return 'image'; if (mime.startsWith('audio/')) return 'audio';
  return 'other';
}

function _timeAgo(date) {
  const s = Math.round((Date.now() - date) / 1000);
  if (s < 60) return `il y a ${s}s`; if (s < 3600) return `il y a ${Math.round(s/60)}min`; if (s < 86400) return `il y a ${Math.round(s/3600)}h`;
  return `il y a ${Math.round(s/86400)}j`;
}

export { APP_VERSIONS };
