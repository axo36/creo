/* ══ transfers.js — uploads réels vers Supabase Storage ══ */
import { supabase } from './supabase.js';
import { state, nextUid } from './state.js';
import { detectFileType, fileIcon, formatBytes, genCode, uiToast, TYPE_ICONS } from './utils.js';

export function renderActiveTransfers() {
  const container = document.getElementById('active-transfers-container');
  const entries   = Object.entries(state.activeUploads);
  document.getElementById('active-count').textContent = entries.length + ' en cours';

  if (!entries.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:1.5rem;font-family:'JetBrains Mono',monospace;
                  font-size:.72rem;color:var(--t3);">
        Glisse des fichiers dans la zone ou clique "＋ Nouveau"
      </div>`;
    return;
  }

  container.innerHTML = entries.map(([uid, u]) => `
    <div class="transfer-card ${u.status === 'done' ? 'transfer-done' : u.status === 'error' ? 'transfer-err' : 'active-transfer'}"
         id="tc-${uid}">
      <div class="tc-header">
        <div class="tc-name">
          <span>${fileIcon(u.name)}</span>
          <span class="fname">${u.name}</span>
          <span class="badge ${u.status === 'done' ? 'badge-green' : u.status === 'error' ? 'badge-red' : 'badge-blue'}">
            ${u.status === 'done' ? 'TERMINÉ' : u.status === 'error' ? 'ERREUR' : 'ENVOI…'}
          </span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          ${u.status === 'done' && u.code
            ? `<span style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:var(--amber);letter-spacing:.15em;">Code: ${u.code}</span>
               <button onclick="window.creo.copyText('${u.code}')"
                 style="font-family:'JetBrains Mono',monospace;font-size:.6rem;padding:2px 7px;
                        background:var(--d4);border:1px solid var(--b3);border-radius:4px;color:var(--t2);cursor:pointer;">📋</button>`
            : ''}
          <button class="btn btn-ghost btn-xs" onclick="window.creo.removeUpload('${uid}')">✕</button>
        </div>
      </div>
      <div class="prog-bar">
        <div class="prog-fill ${u.status === 'done' ? 'done' : u.status === 'error' ? 'err' : ''}"
             id="tc-prog-${uid}" style="width:${u.progress}%;"></div>
      </div>
      <div class="tc-footer">
        <span>${formatBytes(u.size)}</span>
        <span id="tc-pct-${uid}">${u.progress}%</span>
      </div>
    </div>`).join('');
}

function updateUpCard(uid, pct) {
  const bar   = document.getElementById(`tc-prog-${uid}`);
  const pctEl = document.getElementById(`tc-pct-${uid}`);
  if (bar)   bar.style.width = pct + '%';
  if (pctEl) pctEl.textContent = pct + '%';
  if (state.activeUploads[uid]) state.activeUploads[uid].progress = pct;
}

export async function doUpload(file, targetDeviceId, onDone) {
  if (file.size > 50 * 1024 * 1024) {
    uiToast('error', `${file.name} trop grand (max 50 MB)`);
    return;
  }
  const uid  = nextUid();
  state.activeUploads[uid] = { name: file.name, progress: 0, status: 'uploading', size: file.size };
  renderActiveTransfers();
  if (state.notifSettings.start) uiToast('info', `⬆ Envoi de ${file.name}…`);

  try {
    const ext  = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'bin';
    const path = `${state.session.user.id}/${uid}.${ext}`;
    const type = detectFileType(file.name, file.type);
    const code = genCode();

    // Progression simulée pour UX (Supabase SDK ne donne pas de progress)
    let fp = 0;
    const iv = setInterval(() => {
      fp = Math.min(fp + 4 + Math.random() * 14, 90);
      updateUpCard(uid, Math.round(fp));
    }, 180);

    const { error: upErr } = await supabase.storage
      .from('creo-files')
      .upload(path, file, { upsert: true, contentType: file.type || 'application/octet-stream' });

    clearInterval(iv);
    if (upErr) throw upErr;

    updateUpCard(uid, 100);
    const { data: urlData } = supabase.storage.from('creo-files').getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    // Enregistrer en BDD
    const { error: dbErr } = await supabase.from('files').insert({
      user_id:          state.session.user.id,
      name:             file.name,
      type,
      size_bytes:       file.size,
      size_label:       formatBytes(file.size),
      storage_path:     path,
      public_url:       publicUrl,
      mime_type:        file.type || 'application/octet-stream',
      status:           'done',
      share_code:       code,
      target_device_id: targetDeviceId || null,
    });
    if (dbErr) throw dbErr;

    state.activeUploads[uid].status = 'done';
    state.activeUploads[uid].code   = code;
    state.activeUploads[uid].url    = publicUrl;
    renderActiveTransfers();

    const dest = targetDeviceId
      ? (state.devices.find(d => d.id === targetDeviceId)?.name || 'Appareil')
      : 'Stockage';
    if (state.notifSettings.done)
      uiToast('success', `✓ ${file.name} → ${dest} · Code: ${code}`);

    if (onDone) onDone();
    setTimeout(() => { delete state.activeUploads[uid]; renderActiveTransfers(); }, 8000);

  } catch (err) {
    console.error('[CREO upload error]', err);
    state.activeUploads[uid].status = 'error';
    renderActiveTransfers();
    if (state.notifSettings.error)
      uiToast('error', `✕ Erreur upload : ${file.name}`);
    setTimeout(() => { delete state.activeUploads[uid]; renderActiveTransfers(); }, 8000);
  }
}

export function updateTransfersStats() {
  const done   = state.files.filter(f => f.status === 'done');
  const totalB = done.reduce((s, f) => s + (f.size_bytes || 0), 0);

  const totalEl = document.getElementById('stat-total');
  if (totalEl) totalEl.innerHTML = `${done.length} <span class="unit">fichiers</span>`;

  const sizeEl = document.getElementById('stat-size');
  if (sizeEl) {
    const fmtd = formatBytes(totalB).split(' ');
    sizeEl.innerHTML = `${fmtd[0]} <span class="unit">${fmtd[1] || ''}</span>`;
  }

  // Appareils en ligne = vus dans les 10 dernières minutes
  const onlineCount = state.devices.filter(d =>
    d.last_seen && (Date.now() - new Date(d.last_seen)) < 600000
  ).length;
  const devEl = document.getElementById('stat-devices');
  if (devEl) devEl.innerHTML = `${onlineCount} <span class="unit" style="color:var(--green);">●</span>`;

  const codes  = state.files.filter(f => f.share_code).length;
  const succEl = document.getElementById('stat-success');
  if (succEl) succEl.innerHTML = `${codes} <span class="unit">codes</span>`;
}

export function renderTransfersTable(q = '') {
  let data = [...state.files];
  if (state.transferFilter === 'sent')     data = data.filter(f => f.status === 'done');
  if (state.transferFilter === 'received') data = data.filter(f => f.target_device_id === state.currentDeviceId);
  if (state.transferFilter === 'error')    data = data.filter(f => f.status === 'error');
  if (q) {
    const ql = q.toLowerCase();
    data = data.filter(f => f.name.toLowerCase().includes(ql));
  }
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
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty">
      Glisse tes fichiers dans la zone d'upload pour commencer !
    </td></tr>`;
    return;
  }

  const stMap = { done: 'st-done', send: 'st-send', wait: 'st-wait', error: 'st-err' };
  tbody.innerHTML = data.map(t => {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const hl   = q ? t.name.replace(new RegExp(safe, 'gi'), m => `<span class="hl">${m}</span>`) : t.name;
    const date = t.created_at
      ? new Date(t.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '—';
    const destDev   = t.target_device_id ? state.devices.find(d => d.id === t.target_device_id) : null;
    const destLabel = destDev ? `${destDev.icon || '📱'} ${destDev.name}` : '☁ Stockage';
    return `<tr>
      <td>
        <div class="td-name">
          <span class="td-icon">${fileIcon(t.name)}</span>
          <div><div class="td-fname">${hl}</div><div class="td-fmeta">${t.type || 'other'}</div></div>
        </div>
      </td>
      <td class="font-mono" style="font-size:.76rem;">${t.size_label || formatBytes(t.size_bytes)}</td>
      <td style="font-size:.78rem;">${destLabel}</td>
      <td><span style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:var(--amber);letter-spacing:.12em;">${t.share_code || '—'}</span></td>
      <td><span class="status ${stMap[t.status] || 'st-wait'}">
        ${t.status === 'done' ? '✓ OK' : t.status === 'error' ? '✕ Erreur' : '⏳ Attente'}
      </span></td>
      <td class="font-mono" style="font-size:.66rem;color:var(--t3);">${date}</td>
      <td style="display:flex;gap:5px;align-items:center;">
        ${t.share_code ? `<button onclick="window.creo.copyText('${t.share_code}')" class="btn btn-ghost btn-xs" title="Copier le code">📋 ${t.share_code}</button>` : ''}
        ${t.public_url ? `<a href="${t.public_url}" target="_blank" download class="btn btn-ghost btn-xs">⬇</a>` : ''}
        <button class="btn btn-danger btn-xs" onclick="window.creo.deleteFile('${t.id}','${t.storage_path || ''}')">✕</button>
      </td>
    </tr>`;
  }).join('');
}
