/* ══════════════════════════════════════════
   transfers.js — Page Transferts complète
   Upload réel · Code / Lien / QR · Appareils
   Historique 7 jours · Forfait free 1 GB
══════════════════════════════════════════ */
import { supabase }                                 from './supabase.js';
import { state, nextUid }                           from './state.js';
import { detectFileType, formatBytes, genCode,
         uiToast, copyText }                        from './utils.js';

/* ── Constantes ── */
const FREE_QUOTA_BYTES = 1 * 1024 * 1024 * 1024; // 1 GB forfait free
const HISTORY_DAYS     = 7;                        // historique 7 jours

/* ── Icônes SVG propres par type (pas d'emoji) ── */
const TYPE_SVG = {
  image:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="22" height="22"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>`,
  video:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="22" height="22"><path d="m15 10 4.553-2.277A1 1 0 0 1 21 8.68v6.64a1 1 0 0 1-1.447.901L15 14M3 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`,
  audio:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="22" height="22"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  doc:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="22" height="22"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>`,
  archive: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="22" height="22"><polyline points="21,8 21,21 3,21 3,8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
  other:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="22" height="22"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>`,
};

const TYPE_MAP = {
  image:   ['jpg','jpeg','png','gif','webp','svg','bmp','heic','avif'],
  video:   ['mp4','mov','avi','mkv','webm','flv','m4v','wmv'],
  audio:   ['mp3','wav','flac','aac','ogg','m4a','opus','aiff'],
  doc:     ['pdf','doc','docx','txt','rtf','xls','xlsx','ppt','pptx','csv','md'],
  archive: ['zip','rar','tar','gz','7z','bz2'],
};

function getType(name = '', mime = '') {
  const ext = (name.split('.').pop() || '').toLowerCase();
  for (const [t, exts] of Object.entries(TYPE_MAP)) if (exts.includes(ext)) return t;
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'other';
}
function getIcon(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  for (const [t, exts] of Object.entries(TYPE_MAP)) if (exts.includes(ext)) return TYPE_SVG[t];
  return TYPE_SVG.other;
}

/* ══ CALCUL STOCKAGE UTILISÉ ══ */
function usedBytes() {
  return state.files.filter(f => f.status === 'done').reduce((s, f) => s + (f.size_bytes || 0), 0);
}
function storagePercent() {
  return Math.min(100, Math.round((usedBytes() / FREE_QUOTA_BYTES) * 100));
}
function isQuotaFull(fileSize = 0) {
  return usedBytes() + fileSize > FREE_QUOTA_BYTES;
}

/* ══ HISTORIQUE FILTRÉ 7 JOURS ══ */
function recentFiles() {
  const cutoff = Date.now() - HISTORY_DAYS * 86400000;
  return state.files.filter(f => new Date(f.created_at).getTime() > cutoff);
}

/* ══ STATS HEADER ══ */
export function updateTransfersStats() {
  const done  = state.files.filter(f => f.status === 'done');
  const used  = usedBytes();
  const pct   = storagePercent();
  const week  = recentFiles();

  // Fichiers envoyés cette semaine
  _html('stat-total', `${week.length} <span class="unit">cette semaine</span>`);

  // Stockage utilisé / 1 GB avec barre
  const color = pct >= 90 ? 'var(--red)' : pct >= 70 ? 'var(--amber)' : 'var(--green)';
  _html('stat-size', `
    <div style="font-family:'Bebas Neue',sans-serif;font-size:2rem;color:var(--white);line-height:1;">
      ${formatBytes(used)}
    </div>
    <div style="margin-top:.4rem;height:4px;background:var(--d5);border-radius:99px;overflow:hidden;">
      <div style="width:${pct}%;height:100%;background:${color};border-radius:99px;transition:width .5s;"></div>
    </div>
    <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:${color};margin-top:3px;">
      ${pct}% de 1 GB ${pct >= 100 ? '— PLEIN' : ''}
    </div>`);

  // Appareils en ligne
  const online = state.devices.filter(d => d.last_seen && (Date.now() - new Date(d.last_seen)) < 600000).length;
  _html('stat-devices', `${online} <span class="unit" style="color:var(--green);">en ligne</span>`);

  // Taux de succès
  const total = state.files.length;
  const ok    = done.length;
  const rate  = total ? Math.round((ok / total) * 100) : 100;
  _html('stat-success', `${rate} <span class="unit">%</span>`);

  // Alerte quota
  const alertEl = document.getElementById('quota-alert');
  if (alertEl) {
    if (pct >= 90) {
      alertEl.style.display = 'flex';
      alertEl.innerHTML = pct >= 100
        ? `⛔ Stockage plein — les nouveaux uploads sont bloqués. Supprime des fichiers pour libérer de l'espace.`
        : `⚠ Stockage à ${pct}% — il te reste ${formatBytes(FREE_QUOTA_BYTES - used)}. Supprime d'anciens fichiers.`;
    } else {
      alertEl.style.display = 'none';
    }
  }
}

/* ══ RENDER HISTORIQUE 7 JOURS ══ */
export function renderTransfersTable(q = '') {
  let data = recentFiles();

  // Filtre
  if (state.transferFilter === 'sent')     data = data.filter(f => f.status === 'done' && !f.target_device_id);
  if (state.transferFilter === 'device')   data = data.filter(f => f.target_device_id);
  if (state.transferFilter === 'received') data = data.filter(f => f.target_device_id === state.currentDeviceId);
  if (state.transferFilter === 'error')    data = data.filter(f => f.status === 'error');

  // Recherche
  if (q) {
    const ql = q.toLowerCase();
    data = data.filter(f => f.name.toLowerCase().includes(ql));
  }

  // Tri
  data.sort((a, b) => {
    if (state.transferSort === 'date-desc') return new Date(b.created_at) - new Date(a.created_at);
    if (state.transferSort === 'date-asc')  return new Date(a.created_at) - new Date(b.created_at);
    if (state.transferSort === 'size-desc') return (b.size_bytes || 0) - (a.size_bytes || 0);
    if (state.transferSort === 'size-asc')  return (a.size_bytes || 0) - (b.size_bytes || 0);
    if (state.transferSort === 'name-asc')  return a.name.localeCompare(b.name);
    return 0;
  });

  const tbody = document.getElementById('transfers-tbody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">
      ${q ? `Aucun résultat pour « ${q} »` : "Aucun fichier cette semaine — glisse un fichier pour commencer."}
    </td></tr>`;
    return;
  }

  const stMap = { done: 'st-done', error: 'st-err', wait: 'st-wait' };
  tbody.innerHTML = data.map(f => {
    const safe     = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const hl       = q ? f.name.replace(new RegExp(safe, 'gi'), m => `<span class="hl">${m}</span>`) : f.name;
    const date     = new Date(f.created_at).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
    const destDev  = f.target_device_id ? state.devices.find(d => d.id === f.target_device_id) : null;

    // Statut reçu = a-t-il été téléchargé ?
    const isReceived = f.downloaded_at != null;
    let statusHtml;
    if (f.status === 'error') {
      statusHtml = `<span class="status st-err">✕ Erreur</span>`;
    } else if (f.target_device_id && !isReceived) {
      statusHtml = `<span class="status st-wait">⏳ Pas encore reçu</span>`;
    } else if (f.target_device_id && isReceived) {
      statusHtml = `<span class="status st-done">✓ Reçu</span>`;
    } else {
      statusHtml = `<span class="status st-done">✓ Disponible</span>`;
    }

    // Destination
    let destHtml;
    if (destDev) {
      destHtml = `<div style="display:flex;align-items:center;gap:6px;font-size:.78rem;color:var(--t1);">
        <span style="color:var(--blue2);">${getDeviceIcon(destDev.type)}</span> ${destDev.name}
      </div>`;
    } else {
      destHtml = `<div style="font-size:.78rem;color:var(--t2);">Lien public</div>`;
    }

    // Actions partage
    let shareHtml = '';
    if (!f.target_device_id) {
      // Fichier public → code + lien + QR disponibles
      if (f.share_code) {
        shareHtml = `
          <button class="btn-share-pill code"  onclick="window.creo.showShareOptions('${f.id}','code')">Code</button>
          <button class="btn-share-pill link"  onclick="window.creo.showShareOptions('${f.id}','link')">Lien</button>
          <button class="btn-share-pill qr"    onclick="window.creo.showShareOptions('${f.id}','qr')">QR</button>`;
      }
    }

    return `<tr>
      <td>
        <div class="td-name">
          <span class="td-svg-icon" style="color:var(--t3);">${getIcon(f.name)}</span>
          <div>
            <div class="td-fname">${hl}</div>
            <div class="td-fmeta">${(f.type || 'other').toUpperCase()} · ${f.size_label || formatBytes(f.size_bytes)}</div>
          </div>
        </div>
      </td>
      <td>${destHtml}</td>
      <td>${statusHtml}</td>
      <td class="font-mono" style="font-size:.66rem;color:var(--t3);">${date}</td>
      <td>
        <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
          ${shareHtml}
        </div>
      </td>
      <td>
        ${f.public_url
          ? `<button class="btn btn-primary btn-xs" onclick="window.creo.downloadFile('${f.public_url}','${f.name}')">⬇ Télécharger</button>`
          : ''}
        <button class="btn btn-ghost btn-xs" onclick="window.creo.deleteFile('${f.id}','${f.storage_path||''}')">✕</button>
      </td>
    </tr>`;
  }).join('');
}

/* ══ UPLOAD AVEC CHOIX DE PARTAGE ══ */
export function startUpload(files) {
  if (!files || !files.length) return;

  // Vérifier quota avant même d'ouvrir la modal
  const totalSize = Array.from(files).reduce((s, f) => s + f.size, 0);
  if (isQuotaFull(totalSize)) {
    uiToast('error', `Stockage plein (${formatBytes(usedBytes())} / 1 GB). Supprime des fichiers d'abord.`);
    return;
  }

  state.pendingFiles = Array.from(files);

  // Aperçu des fichiers dans la modal
  const preview = document.getElementById('modal-dest-preview');
  if (preview) {
    const overQuota = usedBytes() + totalSize > FREE_QUOTA_BYTES;
    preview.innerHTML = `
      ${overQuota ? `<div style="background:rgba(255,59,92,.08);border:1px solid rgba(255,59,92,.2);border-radius:var(--r-lg);padding:.6rem .9rem;margin-bottom:.8rem;font-size:.78rem;color:var(--red);">
        ⚠ Cet envoi dépasserait ton quota de 1 GB. Réduis la sélection ou libère de l'espace.
      </div>` : ''}
      ${state.pendingFiles.map(f => `
        <div style="display:flex;align-items:center;gap:10px;padding:.5rem 0;border-bottom:1px solid var(--b1);">
          <span style="color:var(--t3);flex-shrink:0;">${getIcon(f.name)}</span>
          <span style="flex:1;font-size:.82rem;color:var(--t1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.name}</span>
          <span style="font-family:'JetBrains Mono',monospace;font-size:.68rem;color:var(--t3);flex-shrink:0;">${formatBytes(f.size)}</span>
        </div>`).join('')}`;
  }

  // Mettre à jour le select d'appareils
  updateDeviceSelectInModal();

  // Afficher la modal
  document.getElementById('modal-transfer')?.classList.add('open');
}

function updateDeviceSelectInModal() {
  const sel = document.getElementById('mt-dest');
  if (!sel) return;
  // Rebuild options
  sel.innerHTML = `
    <option value="__public__">🌐 Lien public (code + lien + QR disponibles)</option>
    <optgroup label="Envoyer à un appareil (pas de code public)">
      ${state.devices.map(d => {
        const isCur = d.id === state.currentDeviceId;
        return `<option value="${d.id}">${getDeviceEmoji(d.type)} ${d.name}${isCur ? ' (cet appareil)' : ''}</option>`;
      }).join('')}
    </optgroup>`;
}

/* ══ CONFIRMER ET UPLOADER ══ */
export async function confirmUploadAndSend() {
  const destVal = document.getElementById('mt-dest')?.value || '__public__';
  document.getElementById('modal-transfer')?.classList.remove('open');

  const isDevice = destVal !== '__public__';
  const targetId = isDevice ? destVal : null;

  for (const file of state.pendingFiles) {
    if (isQuotaFull(file.size)) {
      uiToast('error', `Quota plein — ${file.name} ignoré.`);
      continue;
    }
    await doUpload(file, targetId, isDevice);
  }
  state.pendingFiles = [];
}

export async function doUpload(file, targetDeviceId, isDevice) {
  if (file.size > 50 * 1024 * 1024) { uiToast('error', `${file.name} trop grand (max 50 MB)`); return; }

  const uid  = nextUid();
  const code = (!isDevice) ? genCode() : null; // Code SEULEMENT si pas un appareil

  state.activeUploads[uid] = { name: file.name, progress: 0, status: 'uploading', size: file.size, isDevice };
  renderActiveUploads();

  if (state.notifSettings.start) uiToast('info', `⬆ Envoi de ${file.name}…`);

  try {
    const ext  = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'bin';
    const path = `${state.session.user.id}/${uid}.${ext}`;
    const type = getType(file.name, file.type);

    // Progression simulée
    let fp = 0;
    const iv = setInterval(() => {
      fp = Math.min(fp + 3 + Math.random() * 12, 90);
      state.activeUploads[uid].progress = Math.round(fp);
      _updateProgCard(uid, Math.round(fp));
    }, 160);

    const { error: upErr } = await supabase.storage
      .from('creo-files')
      .upload(path, file, { upsert: true, contentType: file.type || 'application/octet-stream' });

    clearInterval(iv);
    if (upErr) throw upErr;

    _updateProgCard(uid, 100);
    const { data: urlData } = supabase.storage.from('creo-files').getPublicUrl(path);

    await supabase.from('files').insert({
      user_id:          state.session.user.id,
      name:             file.name,
      type,
      size_bytes:       file.size,
      size_label:       formatBytes(file.size),
      storage_path:     path,
      public_url:       urlData.publicUrl,
      mime_type:        file.type || 'application/octet-stream',
      status:           'done',
      share_code:       code,            // null si appareil
      target_device_id: targetDeviceId,  // null si public
      downloaded_at:    null,
      expires_at:       new Date(Date.now() + HISTORY_DAYS * 86400000).toISOString(),
    });

    state.activeUploads[uid].status = 'done';
    state.activeUploads[uid].code   = code;
    state.activeUploads[uid].url    = urlData.publicUrl;
    renderActiveUploads();

    // Recharger fichiers
    const { data } = await supabase.from('files').select('*')
      .eq('user_id', state.session.user.id).order('created_at', { ascending: false });
    state.files = data || [];

    renderTransfersTable(document.getElementById('search-input')?.value?.trim() || '');
    updateTransfersStats();

    const destLabel = targetDeviceId
      ? (state.devices.find(d => d.id === targetDeviceId)?.name || 'Appareil')
      : 'Lien public';
    if (state.notifSettings.done) {
      uiToast('success', code
        ? `✓ ${file.name} → ${destLabel} · Code: ${code}`
        : `✓ ${file.name} → ${destLabel}`);
    }

    setTimeout(() => { delete state.activeUploads[uid]; renderActiveUploads(); }, 10000);

  } catch (err) {
    console.error('[upload error]', err);
    state.activeUploads[uid].status = 'error';
    renderActiveUploads();
    if (state.notifSettings.error) uiToast('error', `✕ Erreur : ${file.name}`);
    setTimeout(() => { delete state.activeUploads[uid]; renderActiveUploads(); }, 8000);
  }
}

/* ══ RENDER UPLOADS EN COURS ══ */
export function renderActiveUploads() {
  const container = document.getElementById('active-transfers-container');
  if (!container) return;
  const entries   = Object.entries(state.activeUploads);
  const countEl   = document.getElementById('active-count');
  if (countEl) countEl.textContent = entries.filter(([,u]) => u.status === 'uploading').length + ' en cours';

  if (!entries.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:1.8rem;font-family:'JetBrains Mono',monospace;
                  font-size:.72rem;color:var(--t3);">
        Glisse des fichiers ou clique "＋ Nouveau" pour envoyer
      </div>`;
    return;
  }

  container.innerHTML = entries.map(([uid, u]) => {
    const isDone  = u.status === 'done';
    const isErr   = u.status === 'error';
    const isLoad  = u.status === 'uploading';
    return `
    <div class="transfer-card ${isDone ? 'transfer-done' : isErr ? 'transfer-err' : 'active-transfer'}">
      <div class="tc-header">
        <div class="tc-name">
          <span style="color:var(--t3);flex-shrink:0;">${getIcon(u.name)}</span>
          <span class="fname">${u.name}</span>
          ${isDone ? `<span class="badge badge-green">✓ Envoyé</span>` : ''}
          ${isErr  ? `<span class="badge badge-red">✕ Erreur</span>` : ''}
          ${isLoad ? `<span class="badge badge-blue">En cours…</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${isDone && u.code ? `
            <button onclick="window.creo.copyText('${u.code}')"
              style="font-family:'Bebas Neue',sans-serif;font-size:.95rem;color:var(--amber);
                     letter-spacing:.12em;background:none;border:none;cursor:pointer;padding:0;">
              ${u.code}
            </button>` : ''}
          ${isDone && !u.isDevice && u.url ? `
            <button class="btn btn-ghost btn-xs" onclick="window.creo.showShareSheet('${uid}')">Partager</button>` : ''}
          <button class="btn btn-ghost btn-xs" onclick="window.creo.removeUpload('${uid}')">✕</button>
        </div>
      </div>
      <div class="prog-bar">
        <div class="prog-fill ${isDone ? 'done' : isErr ? 'err' : ''}"
             id="tc-prog-${uid}" style="width:${u.progress}%;"></div>
      </div>
      <div class="tc-footer">
        <span>${formatBytes(u.size)}</span>
        <span id="tc-pct-${uid}">${isDone ? '100%' : isErr ? 'Erreur' : u.progress + '%'}</span>
      </div>
    </div>`;
  }).join('');
}

function _updateProgCard(uid, pct) {
  const bar   = document.getElementById(`tc-prog-${uid}`);
  const pctEl = document.getElementById(`tc-pct-${uid}`);
  if (bar)   bar.style.width = pct + '%';
  if (pctEl) pctEl.textContent = pct + '%';
}

/* ══ PARTAGE : code / lien / QR ══ */
export function showShareSheet(uid) {
  const u = state.activeUploads[uid];
  if (!u || !u.url) return;
  openShareModal({ url: u.url, code: u.code, name: u.name });
}

export function showShareOptions(fileId, mode) {
  const f = state.files.find(x => x.id === fileId);
  if (!f) return;
  openShareModal({ url: f.public_url, code: f.share_code, name: f.name }, mode);
}

function openShareModal({ url, code, name }, defaultMode = 'code') {
  // On ouvre la modal de partage déjà dans le HTML
  const modal = document.getElementById('modal-share');
  if (!modal) return;

  document.getElementById('share-file-name').textContent = name;

  // Onglets
  document.querySelectorAll('.share-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.mode === defaultMode);
  });
  document.querySelectorAll('.share-panel').forEach(p => {
    p.style.display = p.dataset.mode === defaultMode ? 'block' : 'none';
  });

  // Code
  const codeEl = document.getElementById('share-code-big');
  if (codeEl) codeEl.textContent = code || '—';
  document.getElementById('share-btn-copy-code')?.addEventListener('click', () => copyText(code || ''));

  // Lien
  const shareUrl = url ? `${window.location.origin}/creo/client/client.html#recuperer?code=${code}` : url;
  const linkEl = document.getElementById('share-link-value');
  if (linkEl) linkEl.textContent = url || '—';
  document.getElementById('share-btn-copy-link')?.addEventListener('click', () => copyText(url || ''));

  // QR — génère via qrserver.com
  const qrEl = document.getElementById('share-qr-img');
  if (qrEl && code) {
    const qrData = `${window.location.origin}/creo/client/client.html#code=${code}`;
    qrEl.src = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrData)}&size=200x200&bgcolor=0e0e0e&color=ffffff&margin=10`;
    qrEl.alt = 'QR Code';
  }

  // Télécharger la page de réception
  const recvLinkEl = document.getElementById('share-recv-link');
  if (recvLinkEl && code) {
    recvLinkEl.href = `${window.location.origin}/creo/client/client.html#code=${code}`;
    recvLinkEl.textContent = `Page de téléchargement →`;
  }

  modal.classList.add('open');
}

/* ══ TÉLÉCHARGEMENT DIRECT ══ */
export async function downloadFile(url, name) {
  if (!url) return;
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = name || 'fichier';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);

    // Marquer comme téléchargé
    const f = state.files.find(x => x.public_url === url);
    if (f && !f.downloaded_at) {
      await supabase.from('files').update({ downloaded_at: new Date().toISOString() }).eq('id', f.id);
      f.downloaded_at = new Date().toISOString();
      renderTransfersTable();
    }
  } catch (e) {
    // Fallback si CORS bloque le fetch
    const a = document.createElement('a');
    a.href     = url;
    a.download = name || 'fichier';
    a.target   = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

/* ══ SUPPRIMER ══ */
export async function deleteFile(id, storagePath) {
  if (!confirm('Supprimer ce fichier définitivement ?')) return;
  if (storagePath) await supabase.storage.from('creo-files').remove([storagePath]);
  await supabase.from('files').delete().eq('id', id);
  state.files = state.files.filter(f => f.id !== id);
  renderTransfersTable();
  updateTransfersStats();
  uiToast('info', 'Fichier supprimé');
}

/* ══ NETTOYAGE AUTO FICHIERS > 7 JOURS ══ */
export async function cleanExpiredFiles() {
  const cutoff  = new Date(Date.now() - HISTORY_DAYS * 86400000).toISOString();
  const expired = state.files.filter(f => f.created_at < cutoff);
  for (const f of expired) {
    if (f.storage_path) await supabase.storage.from('creo-files').remove([f.storage_path]);
    await supabase.from('files').delete().eq('id', f.id);
  }
  if (expired.length) {
    state.files = state.files.filter(f => f.created_at >= cutoff);
    uiToast('info', `${expired.length} fichier(s) expiré(s) supprimé(s)`);
  }
}

/* ── Helpers device ── */
function getDeviceIcon(type) {
  const icons = { desktop:'🖥', laptop:'💻', phone:'📱', nas:'🗄', tablet:'📟' };
  return icons[type] || '💻';
}
function getDeviceEmoji(type) {
  return getDeviceIcon(type);
}
function _html(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }
