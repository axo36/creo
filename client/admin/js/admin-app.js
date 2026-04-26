/* ══════════════════════════════════════════
   admin-app.js — Creo · Onglet App
   Uniquement les appareils avec Creo Agent
   Envoi de fichiers direct vers ces appareils
══════════════════════════════════════════ */
import { supabase } from './supabase.js';
import { state }    from './state.js';
import { uiToast, timeAgo, formatBytes } from './utils.js';

let agentDevices = [];
let allDownloads = [];
let appSubTab    = 'send';

/* ══ INIT ══ */
export async function initAppTab() {
  await Promise.all([loadAgentDevices(), loadDownloadLogs()]);
  renderAppTab();
}

/* ══ CHARGER uniquement les agents ══ */
async function loadAgentDevices() {
  // Essai via la vue admin
  let { data, error } = await supabase
    .from('v_admin_devices')
    .select('*')
    .eq('browser', 'Creo Agent');

  // Fallback direct
  if (error || !data) {
    const res = await supabase
      .from('devices')
      .select('id, name, client_code, type, os, online, last_seen, icon, creo_version, outdated, user_id, browser, fingerprint, profiles(username, email, avatar_url, type)')
      .eq('browser', 'Creo Agent')
      .order('online', { ascending: false })
      .order('last_seen', { ascending: false });
    data = res.data;
  }
  agentDevices = data || [];
}

async function loadDownloadLogs() {
  const { data, error } = await supabase
    .from('app_downloads')
    .select('*, profiles(username, email, avatar_url, type)')
    .order('created_at', { ascending: false })
    .limit(300);
  allDownloads = error ? null : (data || []);
}

/* ══ RENDER PRINCIPAL ══ */
export function renderAppTab() {
  const panel = document.getElementById('adm-panel-app');
  if (!panel) return;

  const online  = agentDevices.filter(d => d.online).length;
  const offline = agentDevices.length - online;
  const totalDl = allDownloads?.length || 0;
  const todayDl = allDownloads?.filter(d => Date.now() - new Date(d.created_at) < 86400000).length || 0;

  panel.innerHTML = `
    <!-- Sous-onglets -->
    <div style="display:flex;gap:6px;margin-bottom:1.6rem;">
      <button class="app-sub-tab" data-subtab="send"
        style="${_tabStyle(appSubTab==='send')}">🖥️ Appareils & Envoi</button>
      <button class="app-sub-tab" data-subtab="downloads"
        style="${_tabStyle(appSubTab==='downloads')}">📊 Téléchargements app</button>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:1.8rem;">
      <div class="stat-card">
        <div class="stat-label">Agents installés</div>
        <div class="stat-val" style="color:var(--cyan);">${agentDevices.length}</div>
        <div class="stat-sub">Creo Agent</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">En ligne</div>
        <div class="stat-val" style="color:var(--green);">${online}</div>
        <div class="stat-sub">actifs maintenant</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Hors ligne</div>
        <div class="stat-val" style="color:var(--t3);">${offline}</div>
        <div class="stat-sub">inactifs</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Téléchargements app</div>
        <div class="stat-val">${totalDl}</div>
        <div class="stat-sub">${todayDl} aujourd'hui</div>
      </div>
    </div>

    <!-- Panel envoi -->
    <div id="app-sub-send" style="display:${appSubTab==='send'?'block':'none'};">
      ${_renderSendPanel()}
    </div>

    <!-- Panel downloads -->
    <div id="app-sub-downloads" style="display:${appSubTab==='downloads'?'block':'none'};">
      ${_renderDownloadsPanel()}
    </div>
  `;

  _setupEvents(panel);
}

/* ══ PANEL ENVOI ══ */
function _renderSendPanel() {
  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.4rem;align-items:start;">

      <!-- Colonne gauche : liste agents -->
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.8rem;">
          <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;">
            // Choisir l'appareil
          </div>
          <button class="btn btn-ghost btn-sm" id="btn-refresh-agents" style="font-size:.68rem;">↺</button>
        </div>

        ${agentDevices.length === 0 ? `
          <div style="background:rgba(255,184,0,.04);border:1px dashed rgba(255,184,0,.3);border-radius:var(--r-xl);padding:2rem;text-align:center;">
            <div style="font-size:1.8rem;margin-bottom:.7rem;">🖥️</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--amber);margin-bottom:.5rem;">AUCUN AGENT CONNECTÉ</div>
            <div style="font-size:.78rem;color:var(--t2);line-height:1.6;">Installe <strong style="color:var(--t1);">Creo Agent</strong> sur un PC Windows.<br>Il apparaîtra ici automatiquement.</div>
          </div>
        ` : `
          <div style="display:flex;flex-direction:column;gap:6px;" id="agents-list">
            ${agentDevices.map(d => _agentRow(d)).join('')}
          </div>
        `}
      </div>

      <!-- Colonne droite : envoi fichier -->
      <div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:.8rem;">
          // Fichier à envoyer
        </div>

        <!-- Appareil sélectionné -->
        <div id="sel-dev-info" style="display:none;background:rgba(26,111,255,.06);border:1px solid rgba(26,111,255,.25);border-radius:var(--r-lg);padding:.7rem 1rem;margin-bottom:.8rem;">
          <div style="font-family:'JetBrains Mono',monospace;font-size:.55rem;color:var(--blue2);text-transform:uppercase;margin-bottom:2px;">Appareil sélectionné</div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span id="sel-dev-icon" style="font-size:1.1rem;">🖥️</span>
            <div>
              <div id="sel-dev-name" style="font-size:.84rem;color:var(--t1);font-weight:500;"></div>
              <div id="sel-dev-code" style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--blue2);"></div>
            </div>
          </div>
        </div>

        <!-- Avertissement si pas de sélection -->
        <div id="sel-dev-warn" style="background:rgba(255,184,0,.04);border:1px solid rgba(255,184,0,.2);border-radius:var(--r-lg);padding:.65rem 1rem;margin-bottom:.8rem;">
          <div style="font-size:.78rem;color:var(--amber);">← Sélectionne d'abord un appareil</div>
        </div>

        <!-- Drop zone -->
        <input type="file" id="agent-file-input" multiple style="display:none;">
        <div id="agent-drop-zone"
          style="border:2px dashed var(--b3);border-radius:var(--r-xl);padding:2.5rem 1.5rem;
                 text-align:center;transition:all .2s;background:var(--d2);
                 opacity:.4;pointer-events:none;">
          <div style="font-size:2rem;margin-bottom:.6rem;">📁</div>
          <div style="font-size:.88rem;color:var(--t1);margin-bottom:.3rem;">Glisse tes fichiers ici</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--t3);">ou clique pour choisir · Tous formats</div>
        </div>

        <!-- Progression -->
        <div id="agent-send-progress" style="margin-top:.8rem;"></div>
      </div>

    </div>
  `;
}

/* ══ ROW AGENT ══ */
function _agentRow(d) {
  const online  = d.online;
  const code    = d.client_code || '';
  const lastSeen = d.last_seen ? _timeAgo(new Date(d.last_seen)) : '—';

  return `
    <div class="agent-row" data-id="${d.id}" data-name="${d.name}" data-code="${code}" data-icon="${d.icon||'🖥️'}"
      style="display:flex;align-items:center;gap:10px;padding:.7rem .9rem;
             border-radius:var(--r-lg);border:1px solid var(--b2);
             background:var(--d2);cursor:pointer;transition:all .18s;user-select:none;"
      onmouseover="if(!this.classList.contains('sel')){this.style.borderColor='rgba(26,111,255,.3)';this.style.background='rgba(26,111,255,.03)';}"
      onmouseout="if(!this.classList.contains('sel')){this.style.borderColor='var(--b2)';this.style.background='var(--d2)';}">

      <!-- Icône -->
      <div style="font-size:1.2rem;flex-shrink:0;">${d.icon||'🖥️'}</div>

      <!-- Infos -->
      <div style="flex:1;min-width:0;">
        <div style="font-size:.83rem;color:var(--t1);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.name}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:1px;">
          ${code ? `<code style="font-family:'JetBrains Mono',monospace;font-size:.58rem;color:var(--blue2);background:rgba(26,111,255,.1);padding:0 5px;border-radius:3px;">${code}</code>` : ''}
          <span style="font-size:.66rem;color:var(--t3);">${d.os||''}</span>
        </div>
      </div>

      <!-- Statut -->
      <div style="flex-shrink:0;text-align:right;">
        <div style="display:inline-flex;align-items:center;gap:3px;
          font-family:'JetBrains Mono',monospace;font-size:.55rem;
          padding:2px 7px;border-radius:99px;
          background:${online?'rgba(0,255,136,.1)':'var(--d5)'};
          color:${online?'var(--green)':'var(--t3)'};
          border:1px solid ${online?'rgba(0,255,136,.2)':'var(--b2)'};">
          <span style="width:4px;height:4px;border-radius:50%;background:currentColor;
            ${online?'animation:pulse 2s infinite;box-shadow:0 0 4px currentColor;':''}"></span>
          ${online ? 'EN LIGNE' : 'HORS LIGNE'}
        </div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:.55rem;color:var(--t3);margin-top:2px;">
          ${online ? 'actif' : lastSeen}
        </div>
      </div>
    </div>`;
}

/* ══ PANEL TÉLÉCHARGEMENTS ══ */
function _renderDownloadsPanel() {
  if (allDownloads === null) return `
    <div style="background:rgba(255,184,0,.04);border:1px solid rgba(255,184,0,.2);border-radius:var(--r-xl);padding:1.4rem;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:var(--amber);margin-bottom:.6rem;">⚠ Table app_downloads manquante</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:.65rem;color:var(--t1);background:var(--d5);padding:.8rem;border-radius:var(--r);line-height:2;">CREATE TABLE IF NOT EXISTS public.app_downloads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  platform TEXT NOT NULL, version TEXT NOT NULL DEFAULT '3.2.1',
  ip_address TEXT, token TEXT UNIQUE, created_at TIMESTAMPTZ DEFAULT now()
);</div>
    </div>`;

  const total = allDownloads.length;
  const byPlat = { windows: 0, macos: 0, linux: 0 };
  allDownloads.forEach(d => { if (byPlat[d.platform] !== undefined) byPlat[d.platform]++; });

  return `
    <!-- Barres plateformes -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:1.6rem;">
      ${[['windows','🪟','var(--blue)'],['macos','🍎','var(--cyan)'],['linux','🐧','var(--amber)']].map(([p,icon,clr]) => `
        <div style="background:var(--d2);border:1px solid var(--b2);border-radius:var(--r-xl);padding:1rem;text-align:center;">
          <div style="font-size:1.4rem;margin-bottom:.3rem;">${icon}</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;color:var(--white);">${byPlat[p]}</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:${clr};">${total?Math.round(byPlat[p]/total*100):0}%</div>
          <div style="height:3px;background:var(--d5);border-radius:99px;margin-top:.5rem;overflow:hidden;">
            <div style="height:100%;width:${total?Math.round(byPlat[p]/total*100):0}%;background:${clr};border-radius:99px;"></div>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Lien tracké -->
    <div style="background:var(--d2);border:1px solid rgba(26,111,255,.2);border-radius:var(--r-xl);padding:1.2rem;margin-bottom:1.4rem;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--blue2);text-transform:uppercase;margin-bottom:.7rem;">// Lien tracké</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <select id="app-link-platform" style="background:var(--d4);border:1px solid var(--b2);border-radius:var(--r);padding:.4rem .8rem;color:var(--t1);font-size:.8rem;outline:none;">
          <option value="windows">🪟 Windows</option>
          <option value="macos">🍎 macOS</option>
          <option value="linux">🐧 Linux</option>
        </select>
        <button class="btn btn-primary btn-sm" onclick="window._creoApp.generateLink()">⚡ Générer</button>
      </div>
      <div id="app-link-result" style="display:none;margin-top:.7rem;background:var(--d4);border:1px solid var(--b2);border-radius:var(--r);padding:.65rem .9rem;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:.58rem;color:var(--t3);margin-bottom:.25rem;">Lien :</div>
        <div style="display:flex;gap:8px;align-items:center;">
          <code id="app-link-val" style="flex:1;font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--blue2);word-break:break-all;"></code>
          <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText(document.getElementById('app-link-val').textContent).then(()=>window._creoApp.toast('success','📋 Copié !'))">📋</button>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:.8rem;flex-wrap:wrap;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--t3);text-transform:uppercase;">// Journal (${total})</div>
      <button class="btn btn-ghost btn-sm" style="margin-left:auto;" onclick="window._creoApp.exportCSV()">⬇ CSV</button>
    </div>
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Utilisateur</th><th>Plateforme</th><th>Version</th><th>Date</th>
        </tr></thead>
        <tbody>
          ${allDownloads.slice(0, 100).map(d => {
            const u = d.profiles;
            const icons = { windows:'🪟', macos:'🍎', linux:'🐧' };
            return `<tr>
              <td>
                <div style="font-size:.82rem;color:var(--t1);">${u?.username || 'Invité'}</div>
                <div style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--t3);">${u?.email||'—'}</div>
              </td>
              <td style="font-family:'JetBrains Mono',monospace;font-size:.72rem;">${icons[d.platform]||'💾'} ${d.platform||'—'}</td>
              <td style="font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--blue2);">v${d.version||'—'}</td>
              <td style="font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--t2);">${timeAgo(d.created_at)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ══ UPLOAD + ENVOI ══ */
async function sendFileToAgent(file, deviceId, deviceName) {
  const progress = document.getElementById('agent-send-progress');
  if (progress) progress.innerHTML = _progressHTML(`Envoi de <strong>${file.name}</strong> vers <strong>${deviceName}</strong>…`);

  // 1. Upload Storage
  const ext  = file.name.split('.').pop() || 'bin';
  const path = `agent-sends/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('files')
    .upload(path, file, { contentType: file.type, upsert: false });

  if (upErr) { if (progress) progress.innerHTML = _errHTML(`Upload échoué : ${upErr.message}`); return; }

  // 2. URL publique
  const { data: urlData } = supabase.storage.from('files').getPublicUrl(path);
  const url = urlData?.publicUrl;
  if (!url) { if (progress) progress.innerHTML = _errHTML('URL introuvable'); return; }

  // 3. Ligne dans files avec target_device_id
  const { error: dbErr } = await supabase.from('files').insert({
    user_id:          state.session?.user?.id || null,
    name:             file.name,
    type:             _guessType(file.type, file.name),
    size_bytes:       file.size,
    size_label:       formatBytes(file.size),
    status:           'done',
    public_url:       url,
    storage_path:     path,
    mime_type:        file.type || null,
    target_device_id: deviceId,
    created_at:       new Date().toISOString(),
  });

  if (dbErr) { if (progress) progress.innerHTML = _errHTML(`Erreur DB : ${dbErr.message}`); return; }

  if (progress) progress.innerHTML = `
    <div style="background:rgba(0,255,136,.06);border:1px solid rgba(0,255,136,.2);
                border-radius:var(--r-lg);padding:.65rem 1rem;font-size:.82rem;color:var(--green);">
      ✓ <strong>${file.name}</strong> envoyé vers <strong>${deviceName}</strong>
      <div style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--green);opacity:.7;margin-top:2px;">
        Téléchargement automatique dans ~12 secondes
      </div>
    </div>`;

  uiToast('success', `📤 ${file.name} → ${deviceName}`);
}

/* ══ EVENTS ══ */
function _setupEvents(panel) {
  // Sous-onglets
  panel.querySelectorAll('.app-sub-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      appSubTab = btn.dataset.subtab;
      panel.querySelectorAll('.app-sub-tab').forEach(b => b.style.cssText = _tabStyle(false));
      btn.style.cssText = _tabStyle(true);
      document.getElementById('app-sub-send').style.display      = appSubTab === 'send'      ? 'block' : 'none';
      document.getElementById('app-sub-downloads').style.display = appSubTab === 'downloads' ? 'block' : 'none';
    });
  });

  // Refresh agents
  document.getElementById('btn-refresh-agents')?.addEventListener('click', async () => {
    await loadAgentDevices();
    renderAppTab();
    uiToast('success', '↺ Actualisé');
  });

  // Sélection agent
  let selId = null, selName = null;

  panel.querySelectorAll('.agent-row').forEach(row => {
    row.addEventListener('click', () => {
      // Reset tous
      panel.querySelectorAll('.agent-row').forEach(r => {
        r.classList.remove('sel');
        r.style.borderColor = 'var(--b2)';
        r.style.background  = 'var(--d2)';
      });
      // Sélectionner
      row.classList.add('sel');
      row.style.borderColor = 'rgba(26,111,255,.5)';
      row.style.background  = 'rgba(26,111,255,.06)';

      selId   = row.dataset.id;
      selName = row.dataset.name;
      const code = row.dataset.code;
      const icon = row.dataset.icon;

      // Mettre à jour l'info appareil sélectionné
      document.getElementById('sel-dev-info').style.display = 'block';
      document.getElementById('sel-dev-warn').style.display = 'none';
      document.getElementById('sel-dev-name').textContent   = selName;
      document.getElementById('sel-dev-icon').textContent   = icon;
      document.getElementById('sel-dev-code').textContent   = code;

      // Activer la drop zone
      const dz = document.getElementById('agent-drop-zone');
      if (dz) {
        dz.style.opacity       = '1';
        dz.style.pointerEvents = 'auto';
        dz.style.cursor        = 'pointer';
        dz.style.borderColor   = 'rgba(26,111,255,.3)';
      }
    });
  });

  // Drop zone
  const dropZone  = document.getElementById('agent-drop-zone');
  const fileInput = document.getElementById('agent-file-input');

  dropZone?.addEventListener('click', () => {
    if (!selId) { uiToast('warning', 'Sélectionne un appareil d\'abord'); return; }
    fileInput?.click();
  });

  dropZone?.addEventListener('dragover', e => {
    e.preventDefault();
    if (selId) {
      dropZone.style.borderColor = 'rgba(26,111,255,.6)';
      dropZone.style.background  = 'rgba(26,111,255,.05)';
    }
  });

  dropZone?.addEventListener('dragleave', () => {
    dropZone.style.borderColor = selId ? 'rgba(26,111,255,.3)' : 'var(--b3)';
    dropZone.style.background  = 'var(--d2)';
  });

  dropZone?.addEventListener('drop', async e => {
    e.preventDefault();
    dropZone.style.borderColor = selId ? 'rgba(26,111,255,.3)' : 'var(--b3)';
    dropZone.style.background  = 'var(--d2)';
    if (!selId) { uiToast('warning', 'Sélectionne un appareil d\'abord'); return; }
    for (const f of [...e.dataTransfer.files]) await sendFileToAgent(f, selId, selName);
  });

  fileInput?.addEventListener('change', async () => {
    if (!selId) return;
    for (const f of [...fileInput.files]) await sendFileToAgent(f, selId, selName);
    fileInput.value = '';
  });

  // API globale
  window._creoApp = {
    generateLink: () => {
      const p     = document.getElementById('app-link-platform')?.value || 'windows';
      const token = Math.random().toString(36).slice(2, 10).toUpperCase();
      const url   = `${window.location.origin}/menu/download.html?platform=${p}&token=${token}`;
      document.getElementById('app-link-result').style.display = 'block';
      document.getElementById('app-link-val').textContent      = url;
    },
    exportCSV: () => {
      if (!allDownloads?.length) { uiToast('info', 'Aucune donnée'); return; }
      const rows = [
        ['Utilisateur','Email','Plateforme','Version','Date'].join(','),
        ...allDownloads.map(d => [
          d.profiles?.username||'',
          d.profiles?.email||'',
          d.platform, d.version, d.created_at,
        ].map(v=>`"${v}"`).join(',')),
      ].join('\n');
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(new Blob([rows], {type:'text/csv'})),
        download: `creo-downloads-${new Date().toISOString().slice(0,10)}.csv`,
      });
      a.click();
    },
    toast: uiToast,
  };
}

/* ══ UTILS ══ */
function _tabStyle(active) {
  return `padding:.42rem 1rem;border-radius:var(--r-lg);font-size:.8rem;cursor:pointer;
    transition:all .18s;border:1px solid ${active?'rgba(26,111,255,.3)':'var(--b2)'};
    background:${active?'rgba(26,111,255,.1)':'var(--d4)'};
    color:${active?'var(--blue2)':'var(--t2)'};`;
}

function _progressHTML(msg) {
  return `<div style="font-family:'JetBrains Mono',monospace;font-size:.72rem;color:var(--blue2);margin-bottom:.4rem;">${msg}</div>
    <div style="height:3px;background:var(--d5);border-radius:99px;overflow:hidden;">
      <div style="height:100%;background:linear-gradient(90deg,var(--blue),var(--cyan));border-radius:99px;width:60%;animation:progAnim .8s ease infinite alternate;"></div>
    </div>`;
}

function _errHTML(msg) {
  return `<div style="background:rgba(255,59,92,.06);border:1px solid rgba(255,59,92,.2);border-radius:var(--r-lg);padding:.6rem .9rem;font-size:.8rem;color:var(--red);">✗ ${msg}</div>`;
}

function _guessType(mime, name) {
  if (mime?.startsWith('video/')) return 'video';
  if (mime?.startsWith('image/')) return 'image';
  if (mime?.startsWith('audio/')) return 'audio';
  const ext = (name||'').split('.').pop().toLowerCase();
  if (['mp4','mov','avi','mkv'].includes(ext)) return 'video';
  if (['jpg','jpeg','png','gif','webp'].includes(ext)) return 'image';
  if (['zip','rar','7z'].includes(ext)) return 'archive';
  if (['pdf','doc','docx','xls','xlsx'].includes(ext)) return 'doc';
  return 'other';
}

function _timeAgo(date) {
  const s = Math.round((Date.now() - date) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s/60)}min`;
  if (s < 86400) return `${Math.round(s/3600)}h`;
  return `${Math.round(s/86400)}j`;
}
