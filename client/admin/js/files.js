/* ══ files.js — page fichiers + modal fichier ══ */
import { supabase } from './supabase.js';
import { state } from './state.js';
import { formatBytes, timeAgo, TYPE_ICONS, uiToast, openModal } from './utils.js';

export function renderFilesPage(q = '') {
  let data = [...state.files];
  if (state.fileFilter !== 'all') data = data.filter(f => f.type === state.fileFilter);
  if (q) {
    const ql = q.toLowerCase();
    data = data.filter(f => f.name.toLowerCase().includes(ql));
  }
  data.sort((a, b) => {
    if (state.fileSort === 'date-desc') return new Date(b.created_at) - new Date(a.created_at);
    if (state.fileSort === 'date-asc')  return new Date(a.created_at) - new Date(b.created_at);
    if (state.fileSort === 'size-desc') return (b.size_bytes || 0) - (a.size_bytes || 0);
    if (state.fileSort === 'name-asc')  return a.name.localeCompare(b.name);
    return 0;
  });

  // Stats
  const totalB = data.reduce((s, f) => s + (f.size_bytes || 0), 0);
  const fmtd   = formatBytes(totalB).split(' ');
  _set('files-count', data.length);
  _setHTML('files-size', `${fmtd[0]} <span class="unit">${fmtd[1] || ''}</span>`);
  _set('files-shared', data.filter(f => f.share_code).length);
  if (data.length) {
    _set('files-lastmod', new Date(data[0].created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    _set('files-lastmod-name', data[0].name.length > 16 ? data[0].name.slice(0, 16) + '…' : data[0].name);
  }

  // Grille récents
  const grid = document.getElementById('files-grid');
  if (!data.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;
      font-family:'JetBrains Mono',monospace;font-size:.75rem;color:var(--t3);">
      Aucun fichier — upload depuis la page Transferts !
    </div>`;
    _setHTML('files-tbody', '<tr><td colspan="6" class="table-empty">Aucun fichier</td></tr>');
    return;
  }

  grid.className = state.fileView === 'list' ? 'files-grid list-view' : 'files-grid';
  const recent = data.slice(0, 12);

  if (state.fileView === 'list') {
    grid.innerHTML = recent.map(f => `
      <div class="file-card list-view" onclick="window.creo.openFileModal('${f.id}')">
        <div class="file-card-icon">${TYPE_ICONS[f.type] || '📁'}</div>
        <div class="file-card-info" style="flex:1;min-width:0;">
          <div class="file-card-name">${f.name}</div>
          <div class="file-card-meta">${(f.type || 'other').toUpperCase()} · ${f.size_label || formatBytes(f.size_bytes)}</div>
        </div>
        ${f.share_code
          ? `<span style="font-family:'Bebas Neue',sans-serif;font-size:.9rem;color:var(--amber);letter-spacing:.1em;flex-shrink:0;">${f.share_code}</span>`
          : ''}
        <div style="display:flex;gap:5px;" onclick="event.stopPropagation()">
          ${f.public_url ? `<a href="${f.public_url}" download target="_blank" class="btn btn-ghost btn-xs">⬇</a>` : ''}
          <button class="btn btn-danger btn-xs"
            onclick="window.creo.deleteFile('${f.id}','${f.storage_path || ''}')">✕</button>
        </div>
      </div>`).join('');
  } else {
    grid.innerHTML = recent.map(f => `
      <div class="file-card" onclick="window.creo.openFileModal('${f.id}')">
        <div class="file-actions">
          ${f.public_url
            ? `<a href="${f.public_url}" download target="_blank" class="btn btn-ghost btn-xs" onclick="event.stopPropagation()">⬇</a>`
            : ''}
          <button class="btn btn-danger btn-xs"
            onclick="event.stopPropagation();window.creo.deleteFile('${f.id}','${f.storage_path || ''}')">✕</button>
        </div>
        <div class="file-card-icon">${TYPE_ICONS[f.type] || '📁'}</div>
        <div class="file-card-name" title="${f.name}">${f.name}</div>
        <div class="file-card-meta">${(f.type || 'other').toUpperCase()} · ${f.size_label || formatBytes(f.size_bytes)}</div>
        ${f.share_code
          ? `<div style="font-family:'Bebas Neue',sans-serif;font-size:.85rem;color:var(--amber);margin-top:4px;letter-spacing:.1em;">${f.share_code}</div>`
          : ''}
      </div>`).join('');
  }

  // Tableau complet
  _setHTML('files-tbody', data.map(f => `
    <tr onclick="window.creo.openFileModal('${f.id}')" style="cursor:pointer;">
      <td>
        <div class="td-name">
          <span style="font-size:1rem;">${TYPE_ICONS[f.type] || '📁'}</span>
          <div><div class="td-fname">${f.name}</div><div class="td-fmeta">${f.mime_type || ''}</div></div>
        </div>
      </td>
      <td><span style="font-family:'JetBrains Mono',monospace;font-size:.6rem;padding:2px 6px;
                       border-radius:99px;background:var(--d4);border:1px solid var(--b2);color:var(--t2);">
        ${(f.type || 'other').toUpperCase()}
      </span></td>
      <td class="font-mono" style="font-size:.76rem;">${f.size_label || formatBytes(f.size_bytes)}</td>
      <td><span style="font-family:'Bebas Neue',sans-serif;font-size:.9rem;color:var(--amber);letter-spacing:.1em;">
        ${f.share_code || '—'}
      </span></td>
      <td class="font-mono" style="font-size:.7rem;color:var(--t3);">${timeAgo(f.created_at)}</td>
      <td onclick="event.stopPropagation();" style="display:flex;gap:5px;">
        ${f.public_url ? `<a href="${f.public_url}" class="btn btn-ghost btn-xs" target="_blank" download>⬇</a>` : ''}
        <button class="btn btn-danger btn-xs"
          onclick="window.creo.deleteFile('${f.id}','${f.storage_path || ''}')">✕</button>
      </td>
    </tr>`).join(''));
}

export function openFileModal(id) {
  const f = state.files.find(x => x.id === id);
  if (!f) return;

  document.getElementById('modal-file-title').textContent = f.name;

  // Preview
  const prev = document.getElementById('modal-file-preview');
  if (f.type === 'image' && f.public_url) {
    prev.innerHTML = `<img src="${f.public_url}" style="max-height:200px;max-width:100%;border-radius:var(--r-lg);object-fit:contain;"
      onerror="this.style.display='none'">`;
  } else if (f.type === 'video' && f.public_url) {
    prev.innerHTML = `<video src="${f.public_url}" controls style="max-height:180px;max-width:100%;border-radius:var(--r-lg);" preload="metadata"></video>`;
  } else if (f.type === 'audio' && f.public_url) {
    prev.innerHTML = `<audio src="${f.public_url}" controls style="width:100%;"></audio>`;
  } else {
    prev.innerHTML = `<div style="font-size:3rem;margin:1rem 0;">${TYPE_ICONS[f.type] || '📁'}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:.72rem;color:var(--t3);">${f.size_label || formatBytes(f.size_bytes)}</div>`;
  }

  // Code de partage
  const codeEl      = document.getElementById('modal-share-code');
  const codeSection = document.getElementById('modal-code-section');
  if (f.share_code) {
    codeEl.textContent = f.share_code;
    codeSection.style.display = 'block';
  } else {
    codeSection.style.display = 'none';
  }
  document.getElementById('modal-copy-code').onclick = () => window.creo.copyText(f.share_code || '');

  // Lien direct
  document.getElementById('modal-file-url').textContent = f.public_url || '—';
  document.getElementById('modal-copy-link').onclick = () => window.creo.copyText(f.public_url || '');

  // Bouton télécharger — force le téléchargement réel dans le dossier Téléchargements
  const dlBtn = document.getElementById('modal-download-btn');
  if (dlBtn) {
    dlBtn.href     = f.public_url || '#';
    dlBtn.download = f.name;
    dlBtn.target   = '_blank';
  }

  openModal('modal-file');
}

export async function deleteFile(id, storagePath) {
  if (!confirm('Supprimer ce fichier définitivement ?')) return;
  if (storagePath) {
    await supabase.storage.from('creo-files').remove([storagePath]);
  }
  await supabase.from('files').delete().eq('id', id);
  state.files = state.files.filter(f => f.id !== id);
  uiToast('info', 'Fichier supprimé');
}

// Helpers
function _set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function _setHTML(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }
