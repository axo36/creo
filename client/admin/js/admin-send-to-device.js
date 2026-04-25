/* ══════════════════════════════════════════
   send-to-device.js
   Panneau admin — Envoyer un fichier
   vers n'importe quel appareil agent
══════════════════════════════════════════ */
import { supabase } from './supabase.js';

// ── Charger tous les appareils agents ────────
export async function loadAgentDevices() {
  const { data, error } = await supabase
    .from('devices')
    .select('id, name, client_code, os, online, last_seen, icon, user_id, profiles(username, email)')
    .order('online', { ascending: false })
    .order('last_seen', { ascending: false });

  if (error) { console.error(error); return []; }
  return data || [];
}

// ── Envoyer un fichier vers un appareil ──────
// Le fichier doit déjà être dans Supabase Storage.
// On crée juste la ligne dans `files` avec target_device_id rempli.
export async function sendFileToDevice({ deviceId, fileUrl, fileName, fileSizeBytes, mimeType, fromUserId }) {
  const { data, error } = await supabase.from('files').insert({
    user_id:          fromUserId,
    name:             fileName,
    type:             guessType(mimeType, fileName),
    size_bytes:       fileSizeBytes || 0,
    size_label:       formatBytes(fileSizeBytes || 0),
    status:           'done',
    public_url:       fileUrl,
    mime_type:        mimeType || null,
    target_device_id: deviceId,
    created_at:       new Date().toISOString(),
  }).select().single();

  if (error) throw new Error(error.message);
  return data;
}

// ── Upload + envoi en une seule étape ────────
// Prend un File (input[type=file]) et l'envoie vers l'appareil cible
export async function uploadAndSend({ file, deviceId, fromUserId }) {
  // 1. Upload dans Supabase Storage
  const ext      = file.name.split('.').pop();
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const stoPath  = `agent-sends/${safeName}`;

  const { error: upErr } = await supabase.storage
    .from('files')
    .upload(stoPath, file, { contentType: file.type, upsert: false });

  if (upErr) throw new Error(`Upload échoué : ${upErr.message}`);

  // 2. URL publique
  const { data: urlData } = supabase.storage.from('files').getPublicUrl(stoPath);
  const publicUrl = urlData?.publicUrl;
  if (!publicUrl) throw new Error('URL publique introuvable');

  // 3. Créer la ligne files
  return sendFileToDevice({
    deviceId,
    fileUrl:       publicUrl,
    fileName:      file.name,
    fileSizeBytes: file.size,
    mimeType:      file.type,
    fromUserId,
  });
}

// ── Render : sélecteur d'appareils ──────────
// Injecte le HTML dans `containerEl`
export async function renderDevicePicker(containerEl, { onSend, fromUserId }) {
  const devices = await loadAgentDevices();

  containerEl.innerHTML = `
    <div style="margin-bottom:1.2rem;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.6rem;">
        Choisir l'appareil destinataire
      </div>
      <div id="device-picker-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:1.2rem;">
        ${devices.length
          ? devices.map(d => _deviceCard(d)).join('')
          : `<div style="font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--t3);padding:.5rem;">Aucun appareil connecté.</div>`
        }
      </div>
      <div id="device-picker-file" style="display:none;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--t3);text-transform:uppercase;margin-bottom:.5rem;">Fichier à envoyer</div>
        <input type="file" id="device-file-input" multiple style="display:none;">
        <div id="device-drop-zone"
          style="border:2px dashed var(--b3);border-radius:var(--r-xl);padding:2rem;text-align:center;cursor:pointer;transition:all .2s;background:var(--d2);"
          onmouseenter="this.style.borderColor='rgba(26,111,255,.5)';this.style.background='rgba(26,111,255,.04)'"
          onmouseleave="this.style.borderColor='var(--b3)';this.style.background='var(--d2)'">
          <div style="font-size:1.8rem;margin-bottom:.5rem;">📁</div>
          <div style="font-size:.85rem;color:var(--t1);margin-bottom:.3rem;">Glisse ou clique pour choisir</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--t3);">Tous formats — envoi immédiat</div>
        </div>
        <div id="device-send-progress" style="margin-top:.8rem;"></div>
      </div>
    </div>
  `;

  // Sélection d'appareil
  let selectedDeviceId = null;
  containerEl.querySelectorAll('.device-card').forEach(card => {
    card.addEventListener('click', () => {
      containerEl.querySelectorAll('.device-card').forEach(c => {
        c.style.borderColor = 'var(--b2)';
        c.style.background  = 'var(--d2)';
      });
      card.style.borderColor = 'rgba(26,111,255,.4)';
      card.style.background  = 'rgba(26,111,255,.06)';
      selectedDeviceId = card.dataset.id;
      containerEl.querySelector('#device-picker-file').style.display = 'block';
    });
  });

  // Drop zone
  const dropZone = containerEl.querySelector('#device-drop-zone');
  const fileInp  = containerEl.querySelector('#device-file-input');
  const progress = containerEl.querySelector('#device-send-progress');

  dropZone?.addEventListener('click',     () => fileInp?.click());
  dropZone?.addEventListener('dragover',  e => { e.preventDefault(); dropZone.style.borderColor = 'rgba(26,111,255,.6)'; });
  dropZone?.addEventListener('dragleave', () => { dropZone.style.borderColor = 'var(--b3)'; });
  dropZone?.addEventListener('drop', async e => {
    e.preventDefault();
    const files = [...e.dataTransfer.files];
    if (files.length && selectedDeviceId) await sendFiles(files, selectedDeviceId);
  });
  fileInp?.addEventListener('change', async () => {
    const files = [...fileInp.files];
    if (files.length && selectedDeviceId) await sendFiles(files, selectedDeviceId);
  });

  async function sendFiles(files, devId) {
    if (!progress) return;
    for (const file of files) {
      progress.innerHTML = `
        <div style="font-family:'JetBrains Mono',monospace;font-size:.72rem;color:var(--blue2);">
          ⬆ Envoi de ${file.name}…
        </div>
        <div style="height:3px;background:var(--d5);border-radius:99px;overflow:hidden;margin-top:.4rem;">
          <div style="height:100%;width:60%;background:linear-gradient(90deg,var(--blue),var(--cyan));border-radius:99px;animation:prog .8s ease infinite alternate;"></div>
        </div>`;
      try {
        await uploadAndSend({ file, deviceId: devId, fromUserId });
        progress.innerHTML = `
          <div style="background:rgba(0,255,136,.06);border:1px solid rgba(0,255,136,.2);border-radius:var(--r-lg);padding:.6rem .9rem;font-size:.8rem;color:var(--green);">
            ✓ ${file.name} envoyé — l'appareil va le télécharger automatiquement
          </div>`;
        onSend?.({ file, deviceId: devId });
      } catch (err) {
        progress.innerHTML = `
          <div style="background:rgba(255,59,92,.06);border:1px solid rgba(255,59,92,.2);border-radius:var(--r-lg);padding:.6rem .9rem;font-size:.8rem;color:var(--red);">
            ✗ Erreur : ${err.message}
          </div>`;
      }
    }
  }
}

// ── Card HTML d'un appareil ──────────────────
function _deviceCard(d) {
  const online   = d.online;
  const lastSeen = d.last_seen ? _timeAgo(new Date(d.last_seen)) : '—';
  const code     = d.client_code || '—';
  const owner    = d.profiles?.username ? `@${d.profiles.username}` : 'Agent partagé';

  return `
    <div class="device-card" data-id="${d.id}"
      style="background:var(--d2);border:1px solid var(--b2);border-radius:var(--r-xl);
             padding:1rem 1.1rem;cursor:pointer;transition:all .18s;user-select:none;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.6rem;">
        <span style="font-size:1.3rem;">${d.icon || '🖥️'}</span>
        <span style="display:inline-flex;align-items:center;gap:4px;
          font-family:'JetBrains Mono',monospace;font-size:.58rem;
          padding:2px 7px;border-radius:99px;
          background:${online ? 'rgba(0,255,136,.1)' : 'var(--d5)'};
          color:${online ? 'var(--green)' : 'var(--t3)'};
          border:1px solid ${online ? 'rgba(0,255,136,.25)' : 'var(--b2)'};">
          <span style="width:5px;height:5px;border-radius:50%;background:currentColor;${online ? 'box-shadow:0 0 5px currentColor;' : ''}"></span>
          ${online ? 'EN LIGNE' : 'HORS LIGNE'}
        </span>
      </div>
      <div style="font-size:.86rem;color:var(--t1);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;">
        ${d.name}
      </div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:.65rem;color:var(--blue2);margin-bottom:4px;">${code}</div>
      <div style="font-size:.7rem;color:var(--t3);">${d.os || '—'}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--t3);margin-top:4px;">
        ${online ? '● actif' : `vu ${lastSeen}`}
      </div>
    </div>`;
}

// ── Helpers ──────────────────────────────────
function _timeAgo(date) {
  const s = Math.round((Date.now() - date) / 1000);
  if (s < 60)  return `il y a ${s}s`;
  if (s < 3600) return `il y a ${Math.round(s/60)}min`;
  if (s < 86400) return `il y a ${Math.round(s/3600)}h`;
  return `il y a ${Math.round(s/86400)}j`;
}

function guessType(mime, name) {
  if (!mime && name) {
    const ext = name.split('.').pop().toLowerCase();
    if (['mp4','mov','avi','mkv'].includes(ext)) return 'video';
    if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return 'image';
    if (['mp3','wav','ogg','flac'].includes(ext)) return 'audio';
    if (['zip','rar','7z','tar','gz'].includes(ext)) return 'archive';
    if (['pdf','doc','docx','xls','xlsx','ppt','pptx','txt'].includes(ext)) return 'doc';
  }
  if (!mime) return 'other';
  if (mime.startsWith('video/'))       return 'video';
  if (mime.startsWith('image/'))       return 'image';
  if (mime.startsWith('audio/'))       return 'audio';
  if (mime.includes('pdf') || mime.includes('word') || mime.includes('document')) return 'doc';
  if (mime.includes('zip') || mime.includes('archive') || mime.includes('compressed')) return 'archive';
  return 'other';
}

function formatBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024**2) return `${(b/1024).toFixed(1)} KB`;
  if (b < 1024**3) return `${(b/1024**2).toFixed(1)} MB`;
  return `${(b/1024**3).toFixed(2)} GB`;
}
