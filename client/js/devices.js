/* ══ devices.js — gestion des appareils ══ */
import { supabase } from './supabase.js';
import { state } from './state.js';
import { detectDevice, timeAgo, formatBytes, uiToast, openModal } from './utils.js';

/* Enregistre/met à jour l'appareil actuel au login */
export async function ensureDeviceRegistered() {
  const info = detectDevice();

  if (state.currentDeviceId) {
    const { data } = await supabase.from('devices')
      .update({
        last_seen: new Date().toISOString(),
        online: true,
        browser: info.browser,
        os: info.os,
        screen: info.screen,
      })
      .eq('id', state.currentDeviceId)
      .eq('user_id', state.session.user.id)
      .select().single();
    if (data) return; // déjà enregistré
  }

  // Pas encore dans la liste → neutre, user devra l'ajouter manuellement
  // On enregistre quand même pour le suivi de session mais sans nom imposé
  const { data: dev } = await supabase.from('devices').insert({
    user_id:   state.session.user.id,
    name:      `${info.browser} · ${info.os}`,
    type:      info.type,
    icon:      info.icon,
    os:        info.os,
    browser:   info.browser,
    screen:    info.screen,
    online:    true,
    last_seen: new Date().toISOString(),
  }).select().single();

  if (dev) {
    state.currentDeviceId = dev.id;
    localStorage.setItem('creo_device_id', dev.id);
  }
}

export function renderDevicesPage() {
  const info   = detectDevice();
  const curDev = state.devices.find(d => d.id === state.currentDeviceId);

  // Stats cards
  document.getElementById('dev-online').innerHTML =
    `${state.devices.length} <span class="unit" style="color:var(--green);">appareils</span>`;
  document.getElementById('dev-total').textContent =
    curDev?.name || `${info.browser} · ${info.os}`;

  // TB cette semaine : somme des fichiers créés dans les 7 derniers jours
  const weekAgo = Date.now() - 7 * 86400000;
  const weekBytes = state.files
    .filter(f => new Date(f.created_at).getTime() > weekAgo)
    .reduce((s, f) => s + (f.size_bytes || 0), 0);
  document.getElementById('dev-bw').innerHTML =
    `${(weekBytes / 1e12).toFixed(4)} <span class="unit">TB/sem</span>`;
  document.getElementById('dev-last-sync').textContent =
    curDev?.last_seen ? new Date(curDev.last_seen).toTimeString().slice(0, 5) : '—';

  if (!state.devices.length) {
    document.getElementById('devices-grid').innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--t3);
                  font-family:'JetBrains Mono',monospace;font-size:.75rem;">
        Aucun appareil — clique sur ＋ Ajouter pour enregistrer cet appareil.
      </div>`;
    return;
  }

  document.getElementById('devices-grid').innerHTML = state.devices.map(d => {
    const isCur    = d.id === state.currentDeviceId;
    const isRecent = d.last_seen && (Date.now() - new Date(d.last_seen)) < 600000;
    const myFiles  = state.files.filter(f => f.target_device_id === d.id);

    return `<div class="device-card ${isCur || isRecent ? 'online' : 'offline'}">
      <div class="dc-head">
        <div class="dc-icon" style="${!isRecent && !isCur ? 'opacity:.5' : ''}">${d.icon || '🖥️'}</div>
        <div class="dc-dot ${isRecent || isCur ? 'on' : 'off'}"></div>
      </div>
      <div class="dc-name">${d.name}</div>
      <div class="dc-type">${d.os || ''} · ${d.browser || ''}</div>
      <div class="dc-stats">
        <div class="dc-stat">
          <div class="dc-stat-val">${d.screen || '—'}</div>
          <div class="dc-stat-key">Résolution</div>
        </div>
        <div class="dc-stat">
          <div class="dc-stat-val">${timeAgo(d.last_seen)}</div>
          <div class="dc-stat-key">Vu</div>
        </div>
        <div class="dc-stat">
          <div class="dc-stat-val" style="${myFiles.length ? 'color:var(--amber)' : ''}">${myFiles.length}</div>
          <div class="dc-stat-key">Fichiers reçus</div>
        </div>
        <div class="dc-stat">
          <div class="dc-stat-val" style="font-size:.65rem;">
            ${isCur ? '● Cet appareil' : isRecent ? '● Actif' : '○ Inactif'}
          </div>
          <div class="dc-stat-key">Statut</div>
        </div>
      </div>
      ${myFiles.length && isCur ? `
        <div style="background:rgba(255,184,0,.08);border:1px solid rgba(255,184,0,.2);
                    border-radius:var(--r);padding:.5rem .8rem;margin-bottom:.8rem;
                    font-size:.78rem;color:var(--amber);display:flex;align-items:center;justify-content:space-between;">
          📥 ${myFiles.length} fichier(s) en attente
          <button onclick="window.creo.downloadAll('${d.id}')"
                  style="background:rgba(0,255,136,.1);color:var(--green);border:1px solid rgba(0,255,136,.25);
                         padding:2px 8px;border-radius:4px;font-size:.7rem;cursor:pointer;">
            Tout télécharger
          </button>
        </div>` : ''}
      <div class="dc-actions">
        <button class="btn btn-primary btn-sm" onclick="window.creo.sendToDevice('${d.id}')">⬆ Envoyer ici</button>
        ${isCur
          ? `<button class="btn btn-ghost btn-sm" onclick="window.creo.openRenameModal()">✏ Renommer</button>`
          : `<button class="btn btn-ghost btn-sm" onclick="window.creo.deleteDeviceById('${d.id}')">Supprimer</button>`
        }
      </div>
    </div>`;
  }).join('');
}

export function updateDeviceSelect() {
  const sel = document.getElementById('mt-dest');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="__storage__">☁ Mon stockage (lien de téléchargement)</option>';
  state.devices.forEach(d => {
    const isCur = d.id === state.currentDeviceId;
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = `${d.icon || '📱'} ${d.name}${isCur ? ' (cet appareil)' : ''}`;
    sel.appendChild(opt);
  });
  if (cur) {
    const o = sel.querySelector(`option[value="${cur}"]`);
    if (o) sel.value = cur;
  }
}

export async function renameDevice(newName) {
  if (!newName) return uiToast('warning', 'Entre un nom.');
  const { error } = await supabase.from('devices')
    .update({ name: newName })
    .eq('id', state.currentDeviceId);
  if (error) return uiToast('error', error.message);
  const d = state.devices.find(x => x.id === state.currentDeviceId);
  if (d) d.name = newName;
  uiToast('success', `✓ Renommé : "${newName}"`);
}

export async function addDeviceManually(name, type, os) {
  const info = detectDevice();
  const typeIcons = { desktop:'🖥️', laptop:'💻', phone:'📱', nas:'📦' };
  const { data, error } = await supabase.from('devices').insert({
    user_id:   state.session.user.id,
    name,
    type,
    icon:      typeIcons[type] || '🖥️',
    os:        os || info.os,
    browser:   info.browser,
    screen:    info.screen,
    online:    false,
    last_seen: new Date().toISOString(),
  }).select().single();
  if (error) { uiToast('error', error.message); return null; }
  state.devices.push(data);
  uiToast('success', `✓ Appareil "${name}" ajouté`);
  return data;
}
