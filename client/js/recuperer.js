/* ══ recuperer.js — page récupérer fichier par code / lien / QR ══ */
import { supabase } from './supabase.js';
import { state } from './state.js';
import { formatBytes, uiToast, TYPE_ICONS } from './utils.js';

/* ── Recherche par code ── */
export async function redeemCode() {
  const input = document.getElementById('code-input');
  if (!input) return;
  const code = input.value.trim().toUpperCase();
  if (code.length < 4) { uiToast('warning', 'Entre un code valide (6 caractères).'); return; }

  const btn = document.getElementById('btn-redeem-code');
  btn?.classList.add('btn-loading');
  const { data, error } = await supabase.from('files').select('*').eq('share_code', code).maybeSingle();
  btn?.classList.remove('btn-loading');

  const result = document.getElementById('code-result');
  if (!result) return;

  if (error || !data) {
    result.innerHTML = `
      <div style="background:rgba(255,59,92,.04);border:1px solid rgba(255,59,92,.2);
                  border-radius:var(--r-xl);padding:1rem 1.4rem;font-size:.82rem;color:var(--red);">
        ❌ Code <strong>${code}</strong> introuvable. Vérifie le code et réessaie.
      </div>`;
    return;
  }
  renderFoundFile(result, data);
}

/* ── Recherche par lien direct ── */
export async function redeemLink() {
  const input = document.getElementById('link-input');
  if (!input) return;
  const url = input.value.trim();
  if (!url.startsWith('http')) { uiToast('warning', 'Entre une URL valide.'); return; }

  // Cherche dans nos fichiers si le lien correspond
  const { data } = await supabase.from('files').select('*').eq('public_url', url).maybeSingle();
  const result = document.getElementById('link-result');
  if (!data) {
    // Lien externe — proposer téléchargement direct
    result.innerHTML = `
      <div style="background:var(--d3);border:1px solid var(--b3);border-radius:var(--r-xl);padding:1.4rem;">
        <div style="font-size:.88rem;color:var(--t1);margin-bottom:.8rem;">Lien externe détecté</div>
        <a href="${url}" target="_blank" download class="btn btn-primary btn-sm">⬇ Télécharger</a>
      </div>`;
    return;
  }
  renderFoundFile(result, data);
}

function renderFoundFile(container, data) {
  container.innerHTML = `
    <div style="background:var(--d3);border:1px solid rgba(0,255,136,.2);border-radius:var(--r-xl);padding:1.4rem;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:1rem;">
        <span style="font-size:2rem;">${TYPE_ICONS[data.type] || '📁'}</span>
        <div>
          <div style="font-size:.95rem;font-weight:500;color:var(--t1);">${data.name}</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:.68rem;color:var(--t3);">
            ${data.size_label || formatBytes(data.size_bytes)} · ${(data.type || 'other').toUpperCase()}
          </div>
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <a href="${data.public_url}" target="_blank" download="${data.name}" class="btn btn-primary btn-sm">⬇ Télécharger</a>
        <button onclick="window.creo.copyText('${data.public_url}')" class="btn btn-ghost btn-sm">🔗 Copier le lien</button>
        ${data.share_code
          ? `<button onclick="window.creo.copyText('${data.share_code}')" class="btn btn-ghost btn-sm">📋 Copier le code</button>`
          : ''}
      </div>
    </div>`;
}

/* ── QR Code generator (basé sur l'API qr-server) ── */
export function generateQR(text) {
  if (!text) return;
  const url = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(text)}&size=180x180&bgcolor=0e0e0e&color=ffffff&margin=10`;
  const container = document.getElementById('qr-display');
  if (container) {
    container.innerHTML = `<img src="${url}" alt="QR Code" style="border-radius:var(--r-lg);border:1px solid var(--b2);" width="180" height="180">`;
  }
}

/* ── Fichiers reçus sur cet appareil ── */
export function renderReceivedFiles() {
  const myFiles = state.files.filter(f => f.target_device_id === state.currentDeviceId);
  const tbody   = document.getElementById('received-tbody');
  if (!tbody) return;

  if (!myFiles.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty">
      ${state.currentDeviceId
        ? 'Aucun fichier reçu pour cet appareil.'
        : 'Enregistre cet appareil (page Appareils) pour voir les fichiers reçus.'}
    </td></tr>`;
    return;
  }

  tbody.innerHTML = myFiles.map(f => `<tr>
    <td>
      <div class="td-name">
        <span style="font-size:1rem;">${TYPE_ICONS[f.type] || '📁'}</span>
        <div><div class="td-fname">${f.name}</div>
        <div class="td-fmeta">${f.size_label || formatBytes(f.size_bytes)}</div></div>
      </div>
    </td>
    <td><span style="font-family:'Bebas Neue',sans-serif;font-size:.9rem;color:var(--amber);letter-spacing:.1em;">${f.share_code || '—'}</span></td>
    <td class="font-mono" style="font-size:.7rem;color:var(--t3);">${f.created_at ? new Date(f.created_at).toLocaleString('fr-FR') : '—'}</td>
    <td style="display:flex;gap:5px;">
      ${f.public_url
        ? `<a href="${f.public_url}" target="_blank" download="${f.name}" class="btn btn-primary btn-sm">⬇ Télécharger</a>`
        : ''}
    </td>
  </tr>`).join('');
}
