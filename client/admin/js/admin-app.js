/* ══════════════════════════════════════════
   admin-app.js — Creo · Onglet App
   Gestion des téléchargements de l'app Creo
   Chaque téléchargement est tracé par token utilisateur
══════════════════════════════════════════ */
import { supabase } from './supabase.js';
import { state } from './state.js';
import { formatBytes, uiToast, timeAgo } from './utils.js';

/* ═══ CONFIG VERSIONS APP ═══
   Modifie ici les infos de chaque version disponible
   url_token : le vrai URL de téléchargement sera généré dynamiquement
               avec le token utilisateur ajouté en paramètre
*/
const APP_VERSIONS = {
  windows: {
    label: 'Windows',
    icon: '🪟',
    version: '3.2.1',
    size: '52 MB',
    requirements: 'Windows 10/11 · 64-bit',
    filename: 'CreoSetup-3.2.1.exe',
    // Remplace cette URL par ton vrai lien de stockage (ex: Supabase Storage, S3, etc.)
    base_url: 'https://mpnfvrizbluhhjcfzztc.supabase.co/storage/v1/object/public/app-releases/CreoSetup-3.2.1.exe',
  },
  macos: {
    label: 'macOS',
    icon: '🍎',
    version: '3.2.1',
    size: '48 MB',
    requirements: 'macOS 12+ · Apple Silicon + Intel',
    filename: 'Creo-3.2.1.dmg',
    base_url: 'https://mpnfvrizbluhhjcfzztc.supabase.co/storage/v1/object/public/app-releases/Creo-3.2.1.dmg',
  },
  linux: {
    label: 'Linux',
    icon: '🐧',
    version: '3.2.1',
    size: '44 MB',
    requirements: 'Ubuntu 20.04+ / Debian / Fedora',
    filename: 'creo-3.2.1.AppImage',
    base_url: 'https://mpnfvrizbluhhjcfzztc.supabase.co/storage/v1/object/public/app-releases/creo-3.2.1.AppImage',
  },
};

let allDownloads = [];
let dlFilter = 'all';
let dlSearch = '';

/* ═══ INIT ═══ */
export async function initAppTab() {
  await loadDownloadLogs();
  renderAppTab();
  setupAppEvents();
}

/* ═══ CHARGER LOGS ═══ */
async function loadDownloadLogs() {
  const { data, error } = await supabase
    .from('app_downloads')
    .select('*, profiles(username, email, avatar_url, type)')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    // Si la table n'existe pas encore, on affiche un message d'aide
    allDownloads = null;
    return;
  }
  allDownloads = data || [];
}

/* ═══ RENDER PRINCIPAL ═══ */
export function renderAppTab() {
  const panel = document.getElementById('adm-panel-app');
  if (!panel) return;

  // Stats rapides
  const total = allDownloads?.length || 0;
  const today = allDownloads?.filter(d => {
    const diff = Date.now() - new Date(d.created_at);
    return diff < 86400000;
  }).length || 0;
  const unique = new Set(allDownloads?.map(d => d.user_id)).size || 0;
  const winCount  = allDownloads?.filter(d => d.platform === 'windows').length || 0;
  const macCount  = allDownloads?.filter(d => d.platform === 'macos').length || 0;
  const linuxCount = allDownloads?.filter(d => d.platform === 'linux').length || 0;

  panel.innerHTML = `
    <!-- ══ CONFIG APP ══ -->
    <div style="margin-bottom:2rem;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:.65rem;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:1rem;">
        // versions disponibles
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
        ${Object.entries(APP_VERSIONS).map(([key, v]) => `
          <div style="background:var(--d2);border:1px solid var(--b2);border-radius:var(--r-xl);padding:1.4rem;position:relative;overflow:hidden;transition:border-color .2s;"
               onmouseover="this.style.borderColor='rgba(26,111,255,.3)'" onmouseout="this.style.borderColor='rgba(255,255,255,.08)'">
            <div style="position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--blue),transparent);opacity:.5;"></div>
            <div style="font-size:1.8rem;margin-bottom:.8rem;">${v.icon}</div>
            <div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;letter-spacing:.06em;color:var(--white);margin-bottom:.3rem;">${v.label}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:.65rem;color:var(--blue2);margin-bottom:.5rem;">v${v.version} · ${v.size}</div>
            <div style="font-size:.72rem;color:var(--t3);margin-bottom:1rem;">${v.requirements}</div>
            <div style="background:var(--d4);border:1px solid var(--b1);border-radius:var(--r);padding:.5rem .8rem;font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--t2);word-break:break-all;margin-bottom:.8rem;">${v.base_url.length>50?v.base_url.slice(0,50)+'…':v.base_url}</div>
            <button class="btn btn-ghost btn-sm" onclick="window.creoApp.editVersion('${key}')" style="width:100%;justify-content:center;">✏ Modifier l'URL</button>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- ══ STATS TÉLÉCHARGEMENTS ══ -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:2rem;">
      ${[
        { label: 'Total téléchargements', val: total.toLocaleString('fr'), sub: 'depuis le début', color: 'var(--blue2)' },
        { label: "Aujourd'hui", val: today.toLocaleString('fr'), sub: 'dernières 24h', color: 'var(--green)' },
        { label: 'Utilisateurs uniques', val: unique.toLocaleString('fr'), sub: 'comptes distincts', color: 'var(--cyan)' },
        { label: 'Windows / Mac / Linux', val: `${winCount} / ${macCount} / ${linuxCount}`, sub: 'par plateforme', color: 'var(--amber)' },
      ].map(s => `
        <div class="stat-card">
          <div class="stat-label">${s.label}</div>
          <div class="stat-val" style="color:${s.color};">${s.val}</div>
          <div class="stat-sub">${s.sub}</div>
        </div>
      `).join('')}
    </div>

    <!-- ══ LINK BUILDER ══ -->
    <div style="background:var(--d2);border:1px solid rgba(26,111,255,.2);border-radius:var(--r-xl);padding:1.6rem;margin-bottom:2rem;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:.65rem;color:var(--blue2);text-transform:uppercase;letter-spacing:.1em;margin-bottom:1rem;">
        // Générateur de lien de téléchargement
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
        <select id="app-link-platform" style="background:var(--d4);border:1px solid var(--b2);border-radius:var(--r);padding:.4rem .8rem;color:var(--t1);font-size:.8rem;outline:none;">
          <option value="windows">🪟 Windows</option>
          <option value="macos">🍎 macOS</option>
          <option value="linux">🐧 Linux</option>
        </select>
        <input id="app-link-userid" type="text" placeholder="User ID (laisser vide = non tracé)" style="flex:1;min-width:200px;background:var(--d4);border:1px solid var(--b2);border-radius:var(--r);padding:.4rem .8rem;color:var(--t1);font-size:.8rem;outline:none;font-family:'JetBrains Mono',monospace;">
        <button class="btn btn-primary btn-sm" onclick="window.creoApp.generateLink()">⚡ Générer le lien</button>
      </div>
      <div id="app-generated-link" style="display:none;margin-top:1rem;background:var(--d4);border:1px solid var(--b2);border-radius:var(--r);padding:.8rem 1rem;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:.65rem;color:var(--t3);margin-bottom:.4rem;">Lien généré :</div>
        <div style="display:flex;gap:8px;align-items:center;">
          <code id="app-link-output" style="flex:1;font-family:'JetBrains Mono',monospace;font-size:.72rem;color:var(--blue2);word-break:break-all;"></code>
          <button class="btn btn-ghost btn-sm" onclick="window.creoApp.copyLink()">📋 Copier</button>
        </div>
      </div>
    </div>

    <!-- ══ TABLE TÉLÉCHARGEMENTS ══ -->
    <div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:1rem;flex-wrap:wrap;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:.65rem;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-right:.5rem;">
          // journal des téléchargements
        </div>
        ${['all','windows','macos','linux'].map((f,i) => `
          <div class="filter-chip adm-dl-filter ${f==='all'?'active':''}" data-filter="${f}" style="cursor:pointer;padding:.28rem .8rem;border-radius:99px;font-size:.72rem;${f==='all'?'background:rgba(26,111,255,.15);color:var(--blue2);border:1px solid rgba(26,111,255,.3);':'background:var(--d4);color:var(--t2);border:1px solid var(--b2);'}">
            ${f==='all'?'Tous':f==='windows'?'🪟':f==='macos'?'🍎':'🐧'} ${f==='all'?'':f}
          </div>
        `).join('')}
        <input type="text" id="adm-dl-search" placeholder="Rechercher utilisateur…"
          style="background:var(--d3);border:1px solid var(--b2);border-radius:var(--r-lg);padding:.38rem .8rem;color:var(--t1);font-size:.78rem;outline:none;width:210px;font-family:'JetBrains Mono',monospace;"
          onfocus="this.style.borderColor='rgba(26,111,255,.4)'" onblur="this.style.borderColor='rgba(255,255,255,.08)'"
          oninput="window.creoApp.searchDl(this.value)">
        <button class="btn btn-ghost btn-sm" onclick="window.creoApp.refreshDl()">↺ Actualiser</button>
        <button class="btn btn-ghost btn-sm" onclick="window.creoApp.exportDlCSV()">⬇ CSV</button>
      </div>

      ${allDownloads === null ? renderSetupInstructions() : renderDownloadsTable()}
    </div>
  `;

  // Events filtres
  panel.querySelectorAll('.adm-dl-filter').forEach(chip => {
    chip.addEventListener('click', () => {
      panel.querySelectorAll('.adm-dl-filter').forEach(c => {
        c.style.background = 'var(--d4)'; c.style.color = 'var(--t2)'; c.style.borderColor = 'rgba(255,255,255,.08)';
        c.classList.remove('active');
      });
      chip.style.background = 'rgba(26,111,255,.15)';
      chip.style.color = 'var(--blue2)';
      chip.style.borderColor = 'rgba(26,111,255,.3)';
      chip.classList.add('active');
      dlFilter = chip.dataset.filter;
      updateDlTable();
    });
  });
}

/* ═══ TABLE TÉLÉCHARGEMENTS ═══ */
function renderDownloadsTable() {
  const filtered = getFilteredDl();
  if (!filtered.length) {
    return `<div style="text-align:center;padding:3rem;color:var(--t3);font-family:'JetBrains Mono',monospace;font-size:.75rem;">
      Aucun téléchargement enregistré.
    </div>`;
  }
  return `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Utilisateur</th>
            <th>Plateforme</th>
            <th>Version</th>
            <th>IP</th>
            <th>Date</th>
            <th>Appareil</th>
          </tr>
        </thead>
        <tbody id="adm-dl-tbody">
          ${filtered.map(d => {
            const u = d.profiles;
            const pInfo = APP_VERSIONS[d.platform] || {};
            return `<tr>
              <td>
                <div style="display:flex;align-items:center;gap:8px;">
                  <div style="width:28px;height:28px;background:linear-gradient(135deg,var(--blue),var(--purple));border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:600;color:#fff;flex-shrink:0;overflow:hidden;">
                    ${u?.avatar_url?`<img src="${u.avatar_url}" style="width:100%;height:100%;object-fit:cover;">`:(u?.username||'?').slice(0,2).toUpperCase()}
                  </div>
                  <div>
                    <div style="font-size:.82rem;color:var(--t1);">${u?.username||'Invité'}</div>
                    <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--t3);">${u?.email||d.user_id||'—'}</div>
                  </div>
                </div>
              </td>
              <td>
                <span style="display:inline-flex;align-items:center;gap:5px;background:var(--d4);border:1px solid var(--b2);border-radius:99px;padding:2px 10px;font-size:.72rem;font-family:'JetBrains Mono',monospace;color:var(--t2);">
                  ${pInfo.icon||'💾'} ${d.platform||'—'}
                </span>
              </td>
              <td><span style="font-family:'JetBrains Mono',monospace;font-size:.72rem;color:var(--blue2);">v${d.version||'—'}</span></td>
              <td><span style="font-family:'JetBrains Mono',monospace;font-size:.68rem;color:var(--t3);">${d.ip_address||'—'}</span></td>
              <td>
                <div style="font-size:.78rem;color:var(--t2);">${timeAgo(d.created_at)}</div>
                <div style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--t3);">${new Date(d.created_at).toLocaleDateString('fr')}</div>
              </td>
              <td><span style="font-size:.72rem;color:var(--t3);">${d.user_agent?d.user_agent.slice(0,30)+'…':'—'}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div style="font-family:'JetBrains Mono',monospace;font-size:.65rem;color:var(--t3);margin-top:.8rem;">
      ${filtered.length} enregistrement(s) affiché(s)
    </div>
  `;
}

/* ═══ SQL SETUP INSTRUCTIONS ═══ */
function renderSetupInstructions() {
  return `
    <div style="background:rgba(255,184,0,.04);border:1px solid rgba(255,184,0,.2);border-radius:var(--r-xl);padding:1.8rem;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:1.2rem;letter-spacing:.06em;color:var(--amber);margin-bottom:1rem;">
        ⚠ TABLE MANQUANTE
      </div>
      <p style="font-size:.82rem;color:var(--t2);margin-bottom:1.2rem;">
        La table <code style="background:var(--d4);padding:2px 6px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:.78rem;color:var(--amber);">app_downloads</code> n'existe pas encore dans Supabase.
        Exécute ce SQL dans l'éditeur SQL de Supabase :
      </p>
      <div style="background:var(--d5);border:1px solid var(--b2);border-radius:var(--r-lg);padding:1.2rem;font-family:'JetBrains Mono',monospace;font-size:.72rem;color:var(--t1);line-height:1.9;overflow-x:auto;white-space:pre;">
-- 1. Créer la table app_downloads
CREATE TABLE IF NOT EXISTS public.app_downloads (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  platform      TEXT NOT NULL CHECK (platform IN ('windows','macos','linux')),
  version       TEXT NOT NULL DEFAULT '3.2.1',
  ip_address    TEXT,
  user_agent    TEXT,
  token         TEXT UNIQUE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 2. RLS : seul l'admin peut lire tout
ALTER TABLE public.app_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read all downloads"
  ON public.app_downloads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND type IN ('admin','sous-admin')
    )
  );

CREATE POLICY "Authenticated can insert own download"
  ON public.app_downloads FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 3. Index pour les stats
CREATE INDEX IF NOT EXISTS idx_app_downloads_user ON public.app_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_app_downloads_platform ON public.app_downloads(platform);
CREATE INDEX IF NOT EXISTS idx_app_downloads_created ON public.app_downloads(created_at);</div>
      <div style="margin-top:1rem;display:flex;gap:8px;flex-wrap:wrap;">
        <a href="https://supabase.com/dashboard" target="_blank" class="btn btn-primary btn-sm">Ouvrir Supabase →</a>
        <button class="btn btn-ghost btn-sm" onclick="window.creoApp.refreshDl()">↺ J'ai exécuté le SQL, actualiser</button>
      </div>
    </div>
  `;
}

/* ═══ FILTRAGE ═══ */
function getFilteredDl() {
  if (!allDownloads) return [];
  return allDownloads.filter(d => {
    const matchPlatform = dlFilter === 'all' || d.platform === dlFilter;
    const q = dlSearch.toLowerCase();
    const matchSearch = !q ||
      (d.profiles?.username||'').toLowerCase().includes(q) ||
      (d.profiles?.email||'').toLowerCase().includes(q) ||
      (d.ip_address||'').includes(q);
    return matchPlatform && matchSearch;
  });
}

function updateDlTable() {
  const tbody = document.getElementById('adm-dl-tbody');
  if (!tbody) { renderAppTab(); return; }
  const filtered = getFilteredDl();
  const pInfo = (p) => APP_VERSIONS[p] || {};
  tbody.innerHTML = filtered.map(d => {
    const u = d.profiles;
    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:28px;height:28px;background:linear-gradient(135deg,var(--blue),var(--purple));border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:600;color:#fff;flex-shrink:0;overflow:hidden;">
            ${u?.avatar_url?`<img src="${u.avatar_url}" style="width:100%;height:100%;object-fit:cover;">`:(u?.username||'?').slice(0,2).toUpperCase()}
          </div>
          <div>
            <div style="font-size:.82rem;color:var(--t1);">${u?.username||'Invité'}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--t3);">${u?.email||d.user_id||'—'}</div>
          </div>
        </div>
      </td>
      <td>
        <span style="display:inline-flex;align-items:center;gap:5px;background:var(--d4);border:1px solid var(--b2);border-radius:99px;padding:2px 10px;font-size:.72rem;font-family:'JetBrains Mono',monospace;color:var(--t2);">
          ${pInfo(d.platform).icon||'💾'} ${d.platform||'—'}
        </span>
      </td>
      <td><span style="font-family:'JetBrains Mono',monospace;font-size:.72rem;color:var(--blue2);">v${d.version||'—'}</span></td>
      <td><span style="font-family:'JetBrains Mono',monospace;font-size:.68rem;color:var(--t3);">${d.ip_address||'—'}</span></td>
      <td>
        <div style="font-size:.78rem;color:var(--t2);">${timeAgo(d.created_at)}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--t3);">${new Date(d.created_at).toLocaleDateString('fr')}</div>
      </td>
      <td><span style="font-size:.72rem;color:var(--t3);">${d.user_agent?d.user_agent.slice(0,30)+'…':'—'}</span></td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" style="text-align:center;color:var(--t3);font-size:.78rem;padding:2rem;">Aucun résultat</td></tr>`;
}

/* ═══ EVENTS GLOBAUX ═══ */
function setupAppEvents() {
  window.creoApp = {
    searchDl: (val) => { dlSearch = val; updateDlTable(); },

    refreshDl: async () => {
      await loadDownloadLogs();
      renderAppTab();
      uiToast('success', '↺ Journal actualisé');
    },

    generateLink: () => {
      const platform = document.getElementById('app-link-platform')?.value;
      const userId = document.getElementById('app-link-userid')?.value?.trim();
      if (!platform || !APP_VERSIONS[platform]) return;

      const v = APP_VERSIONS[platform];
      // On génère un token simple : base64(userId + platform + timestamp)
      const token = btoa([userId||'anon', platform, Date.now()].join('|'));
      const url = `${window.location.origin}/creo/menu/download-secure.html?platform=${platform}&token=${token}${userId?'&uid='+userId:''}`;

      document.getElementById('app-generated-link').style.display = 'block';
      document.getElementById('app-link-output').textContent = url;
    },

    copyLink: () => {
      const txt = document.getElementById('app-link-output')?.textContent;
      if (!txt) return;
      navigator.clipboard.writeText(txt).then(() => uiToast('success', '📋 Lien copié !'));
    },

    editVersion: (key) => {
      const v = APP_VERSIONS[key];
      if (!v) return;
      const newUrl = prompt(`URL de téléchargement pour ${v.label} :`, v.base_url);
      if (newUrl !== null) {
        APP_VERSIONS[key].base_url = newUrl.trim();
        renderAppTab();
        uiToast('success', `✓ URL ${v.label} mise à jour`);
      }
    },

    exportDlCSV: () => {
      if (!allDownloads?.length) { uiToast('info', 'Aucune donnée à exporter'); return; }
      const rows = [
        ['Utilisateur', 'Email', 'Plateforme', 'Version', 'IP', 'Date'].join(','),
        ...allDownloads.map(d => [
          d.profiles?.username || '',
          d.profiles?.email || '',
          d.platform,
          d.version,
          d.ip_address || '',
          d.created_at,
        ].map(v => `"${v}"`).join(','))
      ].join('\n');
      const blob = new Blob([rows], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `creo-downloads-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      uiToast('success', '⬇ Export CSV téléchargé');
    },
  };
}

/* ═══ EXPORT CONFIG POUR download-secure.html ═══ */
export { APP_VERSIONS };
