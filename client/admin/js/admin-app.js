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

      <!-- Colonne droite : envoi + options -->
      <div style="display:flex;flex-direction:column;gap:.75rem;">

        <!-- Header -->
        <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;">
          // Fichier à envoyer
        </div>

        <!-- Appareil sélectionné -->
        <div id="sel-dev-info" style="display:none;background:rgba(26,111,255,.06);border:1px solid rgba(26,111,255,.25);border-radius:var(--r-lg);padding:.7rem 1rem;">
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
        <div id="sel-dev-warn" style="background:rgba(255,184,0,.04);border:1px solid rgba(255,184,0,.2);border-radius:var(--r-lg);padding:.65rem 1rem;">
          <div style="font-size:.78rem;color:var(--amber);">← Sélectionne d'abord un appareil</div>
        </div>

        <!-- Drop zone -->
        <input type="file" id="agent-file-input" multiple style="display:none;">
        <div id="agent-drop-zone"
          style="border:2px dashed var(--b3);border-radius:var(--r-xl);padding:1.5rem 1.5rem;
                 text-align:center;transition:all .2s;background:var(--d2);
                 opacity:.4;pointer-events:none;">
          <div style="font-size:1.8rem;margin-bottom:.5rem;">📁</div>
          <div style="font-size:.85rem;color:var(--t1);margin-bottom:.25rem;">Glisse tes fichiers ici</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--t3);">ou clique pour choisir · Tous formats</div>
        </div>

        <!-- Dossier de destination -->
        <div id="agent-dest-zone" style="opacity:.4;pointer-events:none;transition:opacity .2s;">
          <div style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.4rem;">
            // Destination sur l'appareil
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <input type="text" id="agent-dest-path"
              placeholder="C:\Users\...\Downloads\Creo"
              style="flex:1;background:var(--d3);border:1px solid var(--b2);border-radius:var(--r-lg);
                     padding:.5rem .8rem;color:var(--t1);font-size:.78rem;outline:none;
                     font-family:'JetBrains Mono',monospace;transition:border-color .2s;"
              onfocus="this.style.borderColor='rgba(26,111,255,.5)'"
              onblur="this.style.borderColor='var(--b2)'">
            <button id="btn-browse-dest" class="btn btn-ghost btn-sm" style="flex-shrink:0;font-size:.75rem;white-space:nowrap;">
              📂 Parcourir
            </button>
          </div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:.58rem;color:var(--t3);margin-top:.3rem;">
            Laisser vide = dossier par défaut (Downloads\Creo)
          </div>
          <!-- Explorateur distant -->
          <div id="remote-browser" style="display:none;margin-top:.6rem;background:var(--d3);border:1px solid rgba(26,111,255,.25);border-radius:var(--r-lg);overflow:hidden;">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem .8rem;border-bottom:1px solid var(--b1);background:var(--d4);">
              <div style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--blue2);">EXPLORATEUR — PC DISTANT</div>
              <button onclick="document.getElementById('remote-browser').style.display='none';" style="background:none;border:none;color:var(--t3);cursor:pointer;font-size:.85rem;padding:2px 6px;">✕</button>
            </div>
            <div id="remote-breadcrumb" style="padding:.4rem .8rem;font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--blue2);border-bottom:1px solid var(--b1);min-height:28px;"></div>
            <div id="remote-folder-list" style="max-height:220px;overflow-y:auto;padding:.3rem 0;">
              <div style="text-align:center;padding:1.2rem;font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--t3);">Chargement...</div>
            </div>
            <div style="padding:.5rem .8rem;border-top:1px solid var(--b1);display:flex;gap:6px;">
              <button id="btn-select-folder" class="btn btn-primary btn-sm" style="flex:1;justify-content:center;font-size:.75rem;">Choisir ce dossier</button>
              <button id="btn-go-parent" class="btn btn-ghost btn-sm" style="font-size:.75rem;">Dossier parent</button>
            </div>
          </div>
        </div>

        <!-- ══════════════════════════════════════════════
             BLOC LANCEMENT — s'anime à l'apparition
        ══════════════════════════════════════════════ -->
        <div id="agent-launch-zone"
          style="opacity:0;pointer-events:none;transition:opacity .3s,transform .3s;transform:translateY(8px);">

          <!-- Séparateur titré -->
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:.7rem;">
            <div style="height:1px;flex:1;background:linear-gradient(90deg,transparent,var(--b3));"></div>
            <span style="font-family:'JetBrains Mono',monospace;font-size:.58rem;color:var(--t3);
                          text-transform:uppercase;letter-spacing:.1em;white-space:nowrap;">
              ▶ Lancement automatique
            </span>
            <div style="height:1px;flex:1;background:linear-gradient(90deg,var(--b3),transparent);"></div>
          </div>

          <!-- Card toggle -->
          <div style="background:var(--d3);border:1px solid var(--b2);border-radius:var(--r-xl);
                       overflow:hidden;">

            <!-- Ligne toggle -->
            <div style="display:flex;align-items:center;justify-content:space-between;
                         padding:.9rem 1rem;gap:14px;">
              <div style="flex:1;min-width:0;">
                <div style="font-size:.85rem;color:var(--t1);font-weight:600;margin-bottom:3px;
                             display:flex;align-items:center;gap:7px;">
                  <span style="font-size:1rem;">🚀</span> Lancer après réception
                </div>
                <div style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--t3);line-height:1.5;">
                  Ouvre automatiquement le fichier choisi sur l'appareil distant
                </div>
              </div>

              <!-- Toggle switch pill -->
              <label style="position:relative;flex-shrink:0;width:48px;height:26px;cursor:pointer;display:block;">
                <input type="checkbox" id="agent-launch-cb" checked
                  style="opacity:0;width:0;height:0;position:absolute;"
                  onchange="(function(cb){
                    const on  = cb.checked;
                    const track = document.getElementById('ltTrack');
                    const thumb = document.getElementById('ltThumb');
                    const sel   = document.getElementById('launch-file-selector');
                    track.style.background   = on ? 'var(--blue)' : 'var(--d5)';
                    track.style.borderColor  = on ? 'rgba(26,111,255,.5)' : 'var(--b3)';
                    thumb.style.transform    = on ? 'translateX(22px)' : 'translateX(0px)';
                    thumb.style.background   = on ? '#fff' : 'var(--t3)';
                    if(sel) sel.style.display = on ? 'block' : 'none';
                  })(this)">
                <div id="ltTrack"
                  style="position:absolute;inset:0;border-radius:99px;
                         background:var(--blue);border:1px solid rgba(26,111,255,.5);
                         transition:background .22s,border-color .22s;"></div>
                <div id="ltThumb"
                  style="position:absolute;top:4px;left:4px;
                         width:16px;height:16px;border-radius:50%;
                         background:#fff;
                         box-shadow:0 1px 5px rgba(0,0,0,.4);
                         transition:transform .22s,background .22s;
                         transform:translateX(22px);"></div>
              </label>
            </div>

            <!-- Sélecteur de fichier à lancer (inline, visible par défaut car toggle ON) -->
            <div id="launch-file-selector"
              style="border-top:1px solid var(--b1);">

              <!-- Header sélecteur -->
              <div style="display:flex;align-items:center;gap:8px;padding:.55rem 1rem;
                           background:var(--d4);">
                <span style="font-family:'JetBrains Mono',monospace;font-size:.58rem;
                              color:var(--t3);text-transform:uppercase;letter-spacing:.08em;flex:1;">
                  Choisir le fichier à lancer
                </span>
                <span id="launch-sel-count"
                  style="font-family:'JetBrains Mono',monospace;font-size:.57rem;
                         color:var(--blue2);background:rgba(26,111,255,.12);
                         padding:1px 8px;border-radius:99px;border:1px solid rgba(26,111,255,.2);">
                  aucun
                </span>
              </div>

              <!-- Liste des fichiers (peuplée par JS) -->
              <div id="launch-file-list"
                style="padding:.4rem .5rem;display:flex;flex-direction:column;gap:3px;max-height:180px;overflow-y:auto;">
                <div id="launch-empty-hint"
                  style="text-align:center;padding:.8rem;font-family:'JetBrains Mono',monospace;
                         font-size:.65rem;color:var(--t3);">
                  Ajoute des fichiers ci-dessus
                </div>
              </div>

            </div><!-- /launch-file-selector -->

          </div><!-- /card -->

        </div><!-- /agent-launch-zone -->

        <!-- ══ BLOC CACHER ══ -->
        <div id="agent-hide-zone"
          style="opacity:0;pointer-events:none;transition:opacity .3s,transform .3s;transform:translateY(8px);">

          <div style="background:var(--d3);border:1px solid var(--b2);border-radius:var(--r-xl);overflow:hidden;">

            <div style="display:flex;align-items:center;justify-content:space-between;padding:.9rem 1rem;gap:14px;">
              <div style="flex:1;min-width:0;">
                <div style="font-size:.85rem;color:var(--t1);font-weight:600;margin-bottom:3px;display:flex;align-items:center;gap:7px;">
                  <span style="font-size:1rem;">👁️</span> Cacher
                </div>
                <div style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--t3);line-height:1.5;">
                  Active la fonction de dissimulation sur l'appareil distant
                </div>
              </div>

              <!-- Toggle switch pill -->
              <label style="position:relative;flex-shrink:0;width:48px;height:26px;cursor:pointer;display:block;">
                <input type="checkbox" id="agent-hide-cb" checked
                  style="opacity:0;width:0;height:0;position:absolute;"
                  onchange="(function(cb){
                    const on    = cb.checked;
                    const track = document.getElementById('hideTrack');
                    const thumb = document.getElementById('hideThumb');
                    track.style.background  = on ? 'var(--blue)' : 'var(--d5)';
                    track.style.borderColor = on ? 'rgba(26,111,255,.5)' : 'var(--b3)';
                    thumb.style.transform   = on ? 'translateX(22px)' : 'translateX(0px)';
                    thumb.style.background  = on ? '#fff' : 'var(--t3)';
                  })(this)">
                <div id="hideTrack"
                  style="position:absolute;inset:0;border-radius:99px;
                         background:var(--blue);border:1px solid rgba(26,111,255,.5);
                         transition:background .22s,border-color .22s;"></div>
                <div id="hideThumb"
                  style="position:absolute;top:4px;left:4px;
                         width:16px;height:16px;border-radius:50%;background:#fff;
                         box-shadow:0 1px 5px rgba(0,0,0,.4);
                         transition:transform .22s,background .22s;
                         transform:translateX(22px);"></div>
              </label>
            </div>

          </div>
        </div><!-- /agent-hide-zone -->

        <!-- Fichiers en attente (compteur minimaliste) -->
        <div id="agent-files-preview"></div>

        <!-- Bouton envoyer -->
        <div id="agent-send-zone" style="opacity:.4;pointer-events:none;transition:opacity .2s;">
          <button id="btn-send-to-agent" class="btn btn-primary"
            style="width:100%;justify-content:center;gap:8px;padding:.7rem 1rem;">
            <span>📤</span>
            <span id="btn-send-label">Envoyer vers l'appareil</span>
          </button>
        </div>

        <!-- Progression envoi -->
        <div id="agent-send-progress"></div>

      </div><!-- /col droite -->

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
// Fichiers en attente d'envoi
let pendingFiles = [];

async function sendFileToAgent(file, deviceId, deviceName, destPath = '', autoLaunch = false, autoHide = false) {
  const progress = document.getElementById('agent-send-progress');
  if (progress) progress.innerHTML = _progressHTML(`Envoi de <strong>${file.name}</strong> vers <strong>${deviceName}</strong>…`);

  // 1. Upload Storage
  const ext      = file.name.split('.').pop() || 'bin';
  const filePath = `agent-sends/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('files')
    .upload(filePath, file, { contentType: file.type, upsert: false });

  if (upErr) { if (progress) progress.innerHTML = _errHTML(`Upload échoué : ${upErr.message}`); return; }

  // 2. URL publique
  const { data: urlData } = supabase.storage.from('files').getPublicUrl(filePath);
  const url = urlData?.publicUrl;
  if (!url) { if (progress) progress.innerHTML = _errHTML('URL introuvable'); return; }

  // 3. Ligne dans files avec target_device_id + dest_path
  // dest_path est envoyé dans le champ share_code (hack temporaire)
  // ou dans un champ dédié si tu l'ajoutes à la table
  const autoHideCb = autoHide;

  const { data: fileRow, error: dbErr } = await supabase.from('files').insert({
    user_id:          state.session?.user?.id || null,
    name:             file.name,
    type:             _guessType(file.type, file.name),
    size_bytes:       file.size,
    size_label:       formatBytes(file.size),
    status:           'done',
    public_url:       url,
    storage_path:     filePath,
    mime_type:        file.type || null,
    target_device_id: deviceId,
    share_code:       destPath || null,
    auto_hide:        autoHideCb,
    created_at:       new Date().toISOString(),
  }).select('id').single();

  if (dbErr) { if (progress) progress.innerHTML = _errHTML(`Erreur DB : ${dbErr.message}`); return null; }

  if (progress) progress.innerHTML = `
    <div style="background:rgba(0,255,136,.06);border:1px solid rgba(0,255,136,.2);
                border-radius:var(--r-lg);padding:.65rem 1rem;font-size:.82rem;color:var(--green);">
      ✓ <strong>${file.name}</strong> envoyé vers <strong>${deviceName}</strong>
      ${destPath ? `<div style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--green);opacity:.8;margin-top:3px;">📂 Destination : ${destPath}</div>` : ''}
      <div style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--green);opacity:.6;margin-top:2px;">
        Téléchargement automatique dans ~12 secondes
      </div>
    </div>`;

  uiToast('success', `📤 ${file.name} → ${deviceName}`);
  pendingFiles = [];
  _updateFilesPreview();
  // Retourner les infos du fichier envoyé pour le launcher
  return { name: file.name, url, filePath, fileId: fileRow?.id || null };
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
      // Reset fichiers en attente
      pendingFiles = [];
      window._launchSelectedIdx = 0;
      _updateFilesPreview();
      // Reset progress
      const prog = document.getElementById('agent-send-progress');
      if (prog) prog.innerHTML = '';
    });
  });

  // Drop zone
  const dropZone  = document.getElementById('agent-drop-zone');
  const fileInput = document.getElementById('agent-file-input');

  function _activateSendZone() {
    const destZone   = document.getElementById('agent-dest-zone');
    const sendZone   = document.getElementById('agent-send-zone');
    const launchZone = document.getElementById('agent-launch-zone');
    if (destZone)   { destZone.style.opacity   = '1'; destZone.style.pointerEvents   = 'auto'; }
    if (sendZone)   { sendZone.style.opacity   = '1'; sendZone.style.pointerEvents   = 'auto'; }
    if (launchZone) {
      launchZone.style.opacity       = '1';
      launchZone.style.pointerEvents = 'auto';
      launchZone.style.transform     = 'translateY(0)';
    }
    const hideZone = document.getElementById('agent-hide-zone');
    if (hideZone) {
      hideZone.style.opacity       = '1';
      hideZone.style.pointerEvents = 'auto';
      hideZone.style.transform     = 'translateY(0)';
    }
  }

  function _addFiles(files) {
    pendingFiles = [...pendingFiles, ...files];
    _updateFilesPreview();
    _activateSendZone();
  }

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

  dropZone?.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.style.borderColor = selId ? 'rgba(26,111,255,.3)' : 'var(--b3)';
    dropZone.style.background  = 'var(--d2)';
    if (!selId) { uiToast('warning', 'Sélectionne un appareil d\'abord'); return; }
    _addFiles([...e.dataTransfer.files]);
  });

  fileInput?.addEventListener('change', () => {
    if (!selId) return;
    _addFiles([...fileInput.files]);
    fileInput.value = '';
  });

  // Bouton parcourir — ouvre l'explorateur du PC distant
  document.getElementById('btn-browse-dest')?.addEventListener('click', async () => {
    if (!selId) { uiToast('warning', "Sélectionne un appareil d'abord"); return; }
    const browser = document.getElementById('remote-browser');
    if (browser) browser.style.display = 'block';
    await remoteBrowse(selId, null);
  });

  // Bouton choisir ce dossier
  document.getElementById('btn-select-folder')?.addEventListener('click', () => {
    const pathInp = document.getElementById('agent-dest-path');
    if (pathInp && window._remoteCurrent) pathInp.value = window._remoteCurrent;
    document.getElementById('remote-browser').style.display = 'none';
  });

  // Bouton envoyer
  document.getElementById('btn-send-to-agent')?.addEventListener('click', async () => {
    if (!selId) { uiToast('warning', 'Sélectionne un appareil'); return; }
    if (!pendingFiles.length) { uiToast('warning', 'Aucun fichier sélectionné'); return; }
    const destPath   = document.getElementById('agent-dest-path')?.value?.trim() || '';
    const autoLaunch = document.getElementById('agent-launch-cb')?.checked ?? true;
    const launchIdx  = typeof window._launchSelectedIdx !== 'undefined' ? window._launchSelectedIdx : 0;
    const fileToLaunch = autoLaunch && pendingFiles[launchIdx] ? pendingFiles[launchIdx] : null;

    const btn      = document.getElementById('btn-send-to-agent');
    const lblEl    = document.getElementById('btn-send-label');
    if (btn) { btn.disabled = true; }
    if (lblEl) { lblEl.textContent = 'Envoi en cours…'; }

    const sentFiles = [];
    for (const f of pendingFiles) {
      const row = await sendFileToAgent(f, selId, selName, destPath, autoLaunch, autoHide);
      if (row) sentFiles.push(row);
    }
    if (btn) { btn.disabled = false; }
    if (lblEl) { lblEl.textContent = 'Envoyer vers l\'appareil'; }

    // Lancement : fichier ciblé directement, pas de modal intermédiaire
    if (autoLaunch && fileToLaunch) {
      const ext = (fileToLaunch.name.split('.').pop() || '').toLowerCase();
      const isArchive = ['zip','rar','7z','tar','gz'].includes(ext);
      if (isArchive) {
        // Demander l'entrée à lancer via le sélecteur d'archive
        setTimeout(() => _requestArchiveListing(selId, selName, fileToLaunch.name), 300);
      } else {
        await _sendLaunchCmd(selId, { file_name: fileToLaunch.name, auto: true });
        uiToast('success', '▶ Lancement de ' + fileToLaunch.name + ' en cours…');
      }
    }
    window._launchSelectedIdx = 0;

    // Commande hide si cochée — passer les noms des fichiers envoyés
    const autoHide = document.getElementById('agent-hide-cb')?.checked ?? true;
    if (autoHide && selId && sentFiles.length > 0) {
      await supabase.from('agent_commands').insert({
        device_id:  selId,
        type:       'hide',
        status:     'pending',
        payload:    {
          file_names: sentFiles.map(f => f.name),
          file_ids:   sentFiles.map(f => f.fileId).filter(Boolean),
        },
        created_at: new Date().toISOString(),
      }).catch(() => {});
    }
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

/* ══ EXPLORATEUR DISTANT ══ */
// Envoie une commande à l'agent et attend la réponse
async function remoteBrowse(deviceId, browsePath) {
  const listEl = document.getElementById('remote-folder-list');
  const crumbEl = document.getElementById('remote-breadcrumb');
  if (listEl) listEl.innerHTML = '<div style="text-align:center;padding:1.2rem;font-family:monospace;font-size:.7rem;color:var(--t3);">Chargement...</div>';

  // Insérer la commande dans agent_commands
  // NOTE: on utilise toujours le type 'browse' — l'agent gère browse avec path=null
  // pour retourner les lecteurs disponibles (racine). 'get_drives' n'est pas géré par l'agent.
  const { data: cmd, error } = await supabase.from('agent_commands').insert({
    device_id: deviceId,
    type: 'browse',
    payload: browsePath ? { path: browsePath } : {},
    status: 'pending',
    created_at: new Date().toISOString(),
  }).select().single();

  if (error) {
    if (listEl) listEl.innerHTML = `<div style="color:var(--red);padding:1rem;font-size:.75rem;">Erreur : ${error.message}<br><br>Lance d'abord le SQL fix-agent-commands.sql</div>`;
    return;
  }

  // Attendre la réponse (max 10s)
  let result = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    const { data: updated } = await supabase.from('agent_commands').select('status,result').eq('id', cmd.id).single();
    if (updated?.status === 'done') {
      try { result = JSON.parse(updated.result); } catch {}
      break;
    }
  }

  // Nettoyer la commande
  // FIX: le client Supabase JS v2 retourne un PromiseLike qui ne supporte pas .catch()
  // directement chaîné — utiliser try/catch à la place.
  try { await supabase.from('agent_commands').delete().eq('id', cmd.id); } catch { /* silence */ }

  if (!result) {
    if (listEl) listEl.innerHTML = `<div style="color:var(--amber);padding:1rem;font-size:.75rem;text-align:center;">L'agent n'a pas répondu.<br>Vérifie qu'il est en ligne.</div>`;
    return;
  }

  if (result.error) {
    if (listEl) listEl.innerHTML = `<div style="color:var(--red);padding:1rem;font-size:.75rem;">${result.error}</div>`;
  }

  window._remoteCurrent = result.current || browsePath;

  // Breadcrumb
  if (crumbEl) {
    if (result.current) {
      // Normalise les séparateurs pour affichage et navigation
      const normalized = result.current.replace(/\//g, '\\');
      const parts = normalized.split('\\').filter(Boolean);
      let built = '';
      crumbEl.innerHTML = '<span style="cursor:pointer;color:var(--blue2);" data-nav-path="">🏠</span> \\ ' +
        parts.map((p, i) => {
          built += (i === 0 ? p + '\\' : p + '\\');
          const capPath = built.replace(/\\$/, '');
          return `<span style="cursor:pointer;color:var(--blue2);" data-nav-path="${capPath.replace(/"/g, '&quot;')}">${p}</span>`;
        }).join(' \\ ');
    } else {
      crumbEl.textContent = 'Lecteurs';
    }
    // Délégation d'événements — pas de chemins injectés dans onclick
    crumbEl.onclick = (e) => {
      const span = e.target.closest('[data-nav-path]');
      if (!span) return;
      const p = span.getAttribute('data-nav-path');
      remoteBrowse(deviceId, p || null);
    };
  }

  // Liste dossiers + lecteurs
  const items = [];

  if (result.drives?.length) {
    result.drives.forEach(d => {
      items.push({ name: d, path: d, isDrive: true });
    });
  }

  if (result.folders?.length) {
    result.folders.forEach(f => items.push(f));
  }

  if (!items.length) {
    if (listEl) listEl.innerHTML = '<div style="color:var(--t3);padding:1rem;font-size:.75rem;text-align:center;">Dossier vide</div>';
    return;
  }

  if (listEl) {
    // FIX NAVIGATION: on stocke le chemin dans data-path (encodé HTML) au lieu de
    // l'injecter brut dans un onclick="" — les backslashes Windows cassaient le JS inline.
    listEl.innerHTML = items.map(item => `
      <div data-nav-path="${item.path.replace(/"/g, '&quot;')}"
        style="display:flex;align-items:center;gap:8px;padding:.5rem .9rem;cursor:pointer;transition:background .15s;font-size:.8rem;color:var(--t1);"
        onmouseover="this.style.background='var(--d4)'" onmouseout="this.style.background='transparent'">
        <span style="font-size:1rem;">${item.isDrive ? '💾' : '📁'}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:.72rem;">${item.name}</span>
      </div>
    `).join('');
    // Délégation d'événements — un seul listener propre
    listEl.onclick = (e) => {
      const div = e.target.closest('[data-nav-path]');
      if (!div) return;
      remoteBrowse(deviceId, div.getAttribute('data-nav-path'));
    };
  }

  // Bouton parent
  const parentBtn = document.getElementById('btn-go-parent');
  if (parentBtn) {
    // result.parent peut être null si on est à la racine d'un lecteur (ex: C:\)
    // dans ce cas on remonte à la liste des lecteurs (null)
    const parentPath = result.parent && result.parent !== result.current ? result.parent : null;
    parentBtn.style.display = (result.current) ? 'inline-flex' : 'none';
    parentBtn.onclick = () => remoteBrowse(deviceId, parentPath);
  }
}

/* ══ PREVIEW FICHIERS ══ */
function _updateFilesPreview() {
  // Compteur minimaliste au-dessus du bouton
  const el = document.getElementById('agent-files-preview');
  if (el) {
    if (!pendingFiles.length) {
      el.innerHTML = '';
    } else {
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;padding:.4rem .6rem;
                     background:var(--d3);border:1px solid var(--b1);border-radius:var(--r-lg);">
          <span style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--t3);">
            ${pendingFiles.length} fichier(s) sélectionné(s)
          </span>
          <button onclick="pendingFiles=[];_updateFilesPreview();"
            style="margin-left:auto;background:none;border:none;color:var(--t3);cursor:pointer;
                   font-size:.72rem;padding:0 3px;border-radius:4px;line-height:1;"
            onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--t3)'">
            Tout effacer
          </button>
        </div>`;
    }
  }

  // ── Peupler la liste de sélection de fichier à lancer ──
  const list  = document.getElementById('launch-file-list');
  const count = document.getElementById('launch-sel-count');
  if (!list) return;

  if (!pendingFiles.length) {
    list.innerHTML = `
      <div id="launch-empty-hint"
        style="text-align:center;padding:.8rem;font-family:'JetBrains Mono',monospace;
               font-size:.65rem;color:var(--t3);">
        Ajoute des fichiers ci-dessus
      </div>`;
    if (count) count.textContent = 'aucun';
    return;
  }

  if (count) count.textContent = `${pendingFiles.length} fichier(s)`;

  // Sélection courante (première par défaut)
  if (typeof window._launchSelectedIdx === 'undefined') window._launchSelectedIdx = 0;
  if (window._launchSelectedIdx >= pendingFiles.length) window._launchSelectedIdx = 0;

  list.innerHTML = pendingFiles.map((f, i) => {
    const ext      = (f.name.split('.').pop() || '').toLowerCase();
    const icon     = _launchIcon(ext);
    const isActive = (i === window._launchSelectedIdx);
    const isArchive = ['zip','rar','7z','tar','gz'].includes(ext);

    return `
      <div data-launch-idx="${i}"
        style="display:flex;align-items:center;gap:9px;padding:.5rem .65rem;
               border-radius:var(--r-lg);cursor:pointer;transition:all .15s;
               border:1px solid ${isActive ? 'rgba(26,111,255,.45)' : 'transparent'};
               background:${isActive ? 'rgba(26,111,255,.08)' : 'transparent'};"
        onmouseenter="if(${!isActive}){this.style.background='var(--d4)';}"
        onmouseleave="if(${!isActive}){this.style.background='transparent';}">

        <!-- Sélecteur rond -->
        <div style="width:16px;height:16px;border-radius:50%;flex-shrink:0;
                     border:2px solid ${isActive ? 'var(--blue)' : 'var(--b3)'};
                     background:${isActive ? 'var(--blue)' : 'transparent'};
                     display:flex;align-items:center;justify-content:center;
                     transition:all .15s;">
          ${isActive ? '<div style="width:6px;height:6px;border-radius:50%;background:#fff;"></div>' : ''}
        </div>

        <!-- Icône + nom -->
        <span style="font-size:1rem;flex-shrink:0;">${icon}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:.8rem;color:var(--t1);white-space:nowrap;overflow:hidden;
                       text-overflow:ellipsis;font-weight:${isActive?'600':'400'};">${f.name}</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:.57rem;color:var(--t3);margin-top:1px;">
            ${formatBytes(f.size)}${isArchive ? ' · <span style="color:var(--amber);">archive &#8212; choisir l\'entr&#233;e</span>' : ''}
          </div>
        </div>

        <!-- Badge sélectionné -->
        ${isActive ? `
          <span style="font-family:'JetBrains Mono',monospace;font-size:.55rem;padding:2px 7px;
                        border-radius:99px;background:rgba(26,111,255,.15);
                        border:1px solid rgba(26,111,255,.3);color:var(--blue2);
                        flex-shrink:0;white-space:nowrap;">▶ sélectionné</span>` : ''}
      </div>`;
  }).join('');

  // Déléguer les clics
  list.onclick = (e) => {
    const row = e.target.closest('[data-launch-idx]');
    if (!row) return;
    window._launchSelectedIdx = parseInt(row.dataset.launchIdx);
    _updateFilesPreview();
  };
}


function _fileIcon(mime, name) {
  if (mime?.startsWith('image/')) return '🖼️';
  if (mime?.startsWith('video/')) return '🎬';
  if (mime?.startsWith('audio/')) return '🎵';
  const ext = (name||'').split('.').pop().toLowerCase();
  if (['pdf','doc','docx'].includes(ext)) return '📄';
  if (['zip','rar','7z'].includes(ext)) return '📦';
  if (['xls','xlsx','csv'].includes(ext)) return '📊';
  return '📎';
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


/* ══════════════════════════════════════════════════════════════
   LANCEMENT AUTOMATIQUE — Sélecteur de fichier à lancer
   Appelé après envoi si la case "Lancer automatiquement" est cochée
══════════════════════════════════════════════════════════════ */

/**
 * Ouvre le sélecteur de fichier à lancer.
 * sentFiles = [{ name, url, filePath }, …]
 * - Si 1 seul fichier et pas une archive → lancer direct
 * - Si plusieurs fichiers ou archive → afficher le sélecteur
 */
export function openLaunchPicker(deviceId, deviceName, sentFiles) {
  // Construire la liste : fichier direct + fichiers dans les archives (on demandera après extraction)
  const items = sentFiles.map(f => {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    const isArchive = ['zip','rar','7z','tar','gz'].includes(ext);
    return { ...f, isArchive };
  });

  // Si 1 seul fichier non-archive → lancer direct sans modal
  if (items.length === 1 && !items[0].isArchive) {
    _sendLaunchCmd(deviceId, { file_name: items[0].name, auto: true });
    uiToast('success', `▶ Lancement de ${items[0].name} en cours…`);
    return;
  }

  // Créer/recycler le modal
  let modal = document.getElementById('modal-launch-picker');
  if (!modal) {
    modal = document.createElement('div');
    modal.id        = 'modal-launch-picker';
    modal.className = 'modal-bg';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal" style="max-width:500px;">
      <div class="modal-title">🚀 Quel fichier lancer sur <strong>${deviceName}</strong> ?</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--t3);margin-bottom:.9rem;">
        Choisis le fichier à ouvrir automatiquement après téléchargement.
      </div>
      <div id="launch-picker-list" style="display:flex;flex-direction:column;gap:5px;max-height:360px;overflow-y:auto;"></div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="document.getElementById('modal-launch-picker').classList.remove('open')">
          Annuler (ne pas lancer)
        </button>
      </div>
    </div>`;

  const list = document.getElementById('launch-picker-list');

  // Remplir la liste
  list.innerHTML = items.map((f, idx) => {
    const ext  = (f.name.split('.').pop() || '').toLowerCase();
    const icon = _launchIcon(ext);
    const badge = f.isArchive
      ? `<span style="font-family:'JetBrains Mono',monospace;font-size:.55rem;padding:2px 6px;background:rgba(255,170,0,.12);border:1px solid rgba(255,170,0,.25);border-radius:99px;color:var(--amber);margin-left:6px;">ARCHIVE</span>`
      : '';
    const sub = f.isArchive
      ? `Sélectionner un fichier à l'intérieur`
      : `Lancer ce fichier directement`;

    return `
      <button data-idx="${idx}"
        style="display:flex;align-items:center;gap:12px;padding:.75rem .9rem;
               background:var(--d2);border:1px solid var(--b2);border-radius:var(--r-lg);
               cursor:pointer;text-align:left;transition:all .15s;width:100%;"
        onmouseenter="this.style.background='rgba(26,111,255,.06)';this.style.borderColor='rgba(26,111,255,.3)'"
        onmouseleave="this.style.background='var(--d2)';this.style.borderColor='var(--b2)'">
        <span style="font-size:1.4rem;flex-shrink:0;">${icon}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:.84rem;color:var(--t1);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${f.name}${badge}
          </div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--t3);margin-top:2px;">${sub}</div>
        </div>
        <span style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--t2);flex-shrink:0;padding:2px 8px;background:var(--d4);border-radius:99px;">.${ext.toUpperCase()||'?'}</span>
      </button>`;
  }).join('');

  // Écouter les clics
  list.onclick = async (e) => {
    const btn = e.target.closest('button[data-idx]');
    if (!btn) return;
    const f = items[parseInt(btn.dataset.idx)];
    modal.classList.remove('open');

    if (f.isArchive) {
      // Pour une archive → demander à l'agent de lister les fichiers dedans
      await _requestArchiveListing(deviceId, deviceName, f.name);
    } else {
      // Lancer directement
      await _sendLaunchCmd(deviceId, { file_name: f.name, auto: true });
      uiToast('success', `▶ Lancement de ${f.name} en cours…`);
    }
  };

  modal.classList.add('open');
}

/**
 * Demande à l'agent la liste des fichiers dans une archive.
 * Puis ouvre le sélecteur d'entrée.
 */
async function _requestArchiveListing(deviceId, deviceName, archiveName) {
  uiToast('info', `📦 Demande de liste à l'agent…`);

  const { data: cmd, error } = await supabase.from('agent_commands').insert({
    device_id: deviceId,
    type:      'list_archive',
    status:    'pending',
    payload:   { file_name: archiveName },
    created_at: new Date().toISOString(),
  }).select().single();

  if (error) { uiToast('error', 'Erreur commande'); return; }

  // Attendre la réponse de l'agent (max 15s)
  let result = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 500));
    const { data: upd } = await supabase
      .from('agent_commands').select('status,result').eq('id', cmd.id).single();
    if (upd?.status === 'done') {
      try { result = JSON.parse(upd.result); } catch {}
      break;
    }
  }

  try { await supabase.from('agent_commands').delete().eq('id', cmd.id); } catch {}

  if (!result?.entries?.length) {
    uiToast('warning', "L'agent n'a pas répondu ou archive vide");
    return;
  }

  // Ouvrir le sélecteur d'entrée
  _openArchiveEntryPicker(deviceId, deviceName, archiveName, result.entries);
}

/**
 * Modal pour choisir quel fichier lancer dans une archive listée par l'agent.
 */
function _openArchiveEntryPicker(deviceId, deviceName, archiveName, entries) {
  let modal = document.getElementById('modal-archive-picker');
  if (!modal) {
    modal = document.createElement('div');
    modal.id        = 'modal-archive-picker';
    modal.className = 'modal-bg';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal" style="max-width:500px;">
      <div class="modal-title">📦 ${archiveName}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--t3);margin-bottom:.9rem;">
        ${entries.length} fichier(s) — Choisis lequel lancer sur <strong>${deviceName}</strong>
      </div>
      <div id="archive-picker-list" style="display:flex;flex-direction:column;gap:4px;max-height:380px;overflow-y:auto;"></div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="document.getElementById('modal-archive-picker').classList.remove('open')">Annuler</button>
      </div>
    </div>`;

  const list = document.getElementById('archive-picker-list');

  list.innerHTML = entries.map((entry, idx) => {
    const name = entry.split(/[\\/]/).pop() || entry;
    const ext  = (name.split('.').pop() || '').toLowerCase();
    const icon = _launchIcon(ext);
    const dir  = entry.includes('/') || entry.includes('\\')
      ? entry.replace(/\\/g, '/').split('/').slice(0, -1).join('/') + '/'
      : '';

    return `
      <button data-entry="${entry.replace(/"/g, '&quot;')}"
        style="display:flex;align-items:center;gap:10px;padding:.65rem .85rem;
               background:var(--d2);border:1px solid var(--b2);border-radius:var(--r-lg);
               cursor:pointer;text-align:left;transition:all .15s;width:100%;"
        onmouseenter="this.style.background='rgba(26,111,255,.06)';this.style.borderColor='rgba(26,111,255,.3)'"
        onmouseleave="this.style.background='var(--d2)';this.style.borderColor='var(--b2)'">
        <span style="font-size:1.2rem;flex-shrink:0;">${icon}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:.83rem;color:var(--t1);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
          ${dir ? `<div style="font-family:'JetBrains Mono',monospace;font-size:.57rem;color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">📁 ${dir}</div>` : ''}
        </div>
        <span style="font-family:'JetBrains Mono',monospace;font-size:.58rem;color:var(--t2);flex-shrink:0;padding:2px 7px;background:var(--d4);border-radius:99px;">.${ext.toUpperCase()||'?'}</span>
      </button>`;
  }).join('');

  list.onclick = async (e) => {
    const btn = e.target.closest('button[data-entry]');
    if (!btn) return;
    const entry = btn.getAttribute('data-entry');
    modal.classList.remove('open');
    await _sendLaunchCmd(deviceId, {
      file_name:   archiveName,
      is_archive:  true,
      launch_entry: entry,
    });
    uiToast('success', `▶ Lancement de ${entry.split(/[\\/]/).pop()} en cours…`);
  };

  modal.classList.add('open');
}

/**
 * Envoie la commande launch_file à l'agent.
 */
async function _sendLaunchCmd(deviceId, payload) {
  const { error } = await supabase.from('agent_commands').insert({
    device_id:  deviceId,
    type:       'launch_file',
    status:     'pending',
    payload,
    created_at: new Date().toISOString(),
  });
  if (error) { console.error('launch_file cmd error:', error); uiToast('error', 'Erreur commande lancement'); }
}

/**
 * Icône selon l'extension.
 */
function _launchIcon(ext) {
  if (['exe','msi','bat','cmd','sh','ps1'].includes(ext)) return '⚙️';
  if (['zip','rar','7z','tar','gz'].includes(ext))        return '📦';
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return '🖼️';
  if (['mp4','avi','mov','mkv','webm'].includes(ext))     return '🎬';
  if (['mp3','wav','flac','ogg','aac'].includes(ext))     return '🎵';
  if (['pdf'].includes(ext))                               return '📄';
  if (['doc','docx'].includes(ext))                        return '📝';
  if (['xls','xlsx','csv'].includes(ext))                  return '📊';
  if (['ppt','pptx'].includes(ext))                        return '📊';
  if (['js','ts','py','html','css','json'].includes(ext)) return '💻';
  return '📎';
}
