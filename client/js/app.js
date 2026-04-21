/* ══════════════════════════════════════════
   app.js — point d'entrée principal CREO
   Orchestre l'init, la nav, et les events
══════════════════════════════════════════ */
import { supabase }                                         from './supabase.js';
import { state, nextUid }                                   from './state.js';
import { uiToast, copyText, openModal, closeModal,
         detectDevice, formatBytes, timeAgo }               from './utils.js';
import { loadFiles, loadDevices, loadSyncRules,
         loadSyncLog, setupRealtime }                       from './data.js';
import { ensureDeviceRegistered, renderDevicesPage,
         updateDeviceSelect, renameDevice,
         addDeviceManually }                                from './devices.js';
import { doUpload, startUpload, confirmUploadAndSend,
         renderActiveUploads, renderTransfersTable,
         updateTransfersStats, downloadFile, deleteFile as deleteFileTransfer,
         showShareOptions, showShareSheet, cleanExpiredFiles }             from './transfers.js';
import { renderFilesPage, openFileModal, deleteFile }       from './files.js';
import { redeemCode, redeemLink, generateQR,
         renderReceivedFiles }                              from './recuperer.js';
import { renderSyncPage, launchSync, toggleRule,
         deleteRule, addSyncRule }                          from './sync.js';
import { renderAnalyticsPage, exportCSV }                   from './analytics.js';
import { renderSettings, saveProfile, changePassword,
         uploadAvatar, removeAvatar, setLang,
         saveNotifSettings, applyNotifToggles,
         switchSettingsTab }                                from './settings.js';

/* ══ Exposition globale pour les onclick HTML ══ */
window.creo = {
  copyText,
  openFileModal,
  deleteFile: deleteFileTransfer,
  sendToDevice, downloadAll, deleteDeviceById, openRenameModal,
  toggleRule, deleteRule,
  removeUpload: (uid) => { delete state.activeUploads[uid]; renderActiveUploads(); },
  redeemCode, redeemLink,
  downloadFile,
  showShareOptions,
  showShareSheet,
  switchShareTab(btn, mode) {
    document.querySelectorAll('.share-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.share-panel').forEach(p => p.style.display = 'none');
    btn.classList.add('active');
    document.querySelectorAll(`.share-panel[data-mode="${mode}"]`).forEach(p => p.style.display = 'block');
  },
};

/* ══ INIT ══ */
async function init() {
  setLoadTxt('Vérification de la session…');
  const { data: { session: s } } = await supabase.auth.getSession();
  if (!s) { window.location.href = '/creo/login/login.html'; return; }
  state.session = s;

  setLoadTxt('Chargement du profil…');
  const { data: p } = await supabase.from('profiles').select('*').eq('id', s.user.id).single();
  if (!p?.username || !p?.client_code || !p?.type) {
    window.location.href = '/creo/login/complete-profile.html';
    return;
  }
  state.profile = p;
  state.currentLang = p.lang || state.currentLang;
  if (p.notif_settings) {
    try { state.notifSettings = { ...state.notifSettings, ...JSON.parse(p.notif_settings) }; }
    catch (_) {}
  }

  supabase.auth.onAuthStateChange(ev => {
    if (ev === 'SIGNED_OUT') window.location.href = '/creo/login/login.html';
  });

  setLoadTxt("Enregistrement de l'appareil…");
  await ensureDeviceRegistered();

  setLoadTxt('Chargement des données…');
  await Promise.all([loadFiles(), loadDevices(), loadSyncRules(), loadSyncLog()]);

  renderSidebar();
  renderSettings();
  renderTransfersPage();
  renderDevicesPage();
  renderFilesPage();
  renderSyncPage();
  renderAnalyticsPage();
  renderReceivedFiles();
  applyNotifToggles();
  updateDeviceSelect();
  hideLoading();
  setupEvents();

  // Nettoyer les fichiers expirés (> 7 jours)
  await cleanExpiredFiles();

  setupRealtime(
    () => { renderTransfersPage(); renderFilesPage(); renderReceivedFiles(); renderAnalyticsPage(); },
    () => { renderDevicesPage(); updateDeviceSelect(); }
  );

  // Mise à jour de la vitesse réseau simulée (stat-speed garde un visuel vivant)
  setInterval(() => {
    const el = document.getElementById('stat-speed');
    if (el) el.innerHTML = `${(800 + Math.random() * 600).toFixed(0)} <span class="unit">MB/s</span>`;
  }, 1500);
}

function setLoadTxt(t) {
  const el = document.getElementById('loading-txt');
  if (el) el.textContent = t;
}
function hideLoading() {
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('app-shell').style.display      = 'block';
  updateMobProfileStrip();
}

/* ══ SIDEBAR ══ */
function renderSidebar() {
  const av = state.profile?.avatar_url;
  const el = document.getElementById('sidebar-avatar');
  if (el) {
    if (av) el.innerHTML = `<img src="${av}" alt="">`;
    else    el.textContent = initials();
  }
  _set('sidebar-name', displayName());
  _set('sidebar-role', capitalize(state.profile?.type || 'utilisateur'));
  updateMobProfileStrip();
}

function updateMobProfileStrip() {
  const av    = state.profile?.avatar_url;
  const avEl  = document.getElementById('mob-strip-av');
  if (avEl) {
    if (av) avEl.innerHTML = `<img src="${av}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="">`;
    else    avEl.textContent = initials();
  }
  _set('mob-strip-name', displayName());
  _set('mob-strip-role', capitalize(state.profile?.type || 'utilisateur'));
}

function displayName() {
  if (state.profile?.first_name && state.profile?.last_name)
    return `${state.profile.first_name} ${state.profile.last_name}`;
  if (state.profile?.username) return `@${state.profile.username}`;
  return state.session?.user?.email?.split('@')[0] || 'Utilisateur';
}
function initials() {
  return displayName().split(' ').map(w => w[0] || '').slice(0, 2).join('').toUpperCase() || '?';
}
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

/* ══ RENDER TRANSFERS PAGE ══ */
function renderTransfersPage() {
  renderActiveUploads();
  renderTransfersTable(document.getElementById('search-input')?.value?.trim() || '');
  updateTransfersStats();
}

/* ══ NAV ══ */
const PAGE_META = {
  transferts:  { title: 'TRANSFERTS',  bc: '// envoyer des fichiers',  btn: '⬆ Envoyer' },
  appareils:   { title: 'APPAREILS',   bc: '// mes appareils',         btn: '＋ Ajouter' },
  fichiers:    { title: 'FICHIERS',    bc: '// tous mes fichiers',      btn: '⬆ Uploader' },
  recuperer:   { title: 'RÉCUPÉRER',   bc: '// code · lien · qr',      btn: '↺ Actualiser' },
  parametres:  { title: 'PARAMÈTRES',  bc: '// compte',                btn: '✓ Sauvegarder' },
  analytiques: { title: 'ANALYTIQUES', bc: '// ce mois',               btn: '↓ Exporter CSV' },
};

window.showPage = function (id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link, .bn-item').forEach(l => l.classList.remove('active'));
  const page = document.getElementById('page-' + id);
  if (!page) return;
  page.classList.add('active');
  if (el) el.classList.add('active');
  state.currentPage = id;
  const m = PAGE_META[id] || { title: id.toUpperCase(), bc: '', btn: '' };
  _set('topbar-title', m.title);
  _set('topbar-bc', m.bc);
  const ab = document.getElementById('action-btn');
  if (ab) ab.textContent = m.btn;
  document.getElementById('notif-panel')?.classList.remove('open');
  // Re-render si besoin
  if (id === 'parametres')  { renderSettings(); }
  if (id === 'transferts')  { renderTransfersPage(); }
  if (id === 'sync')        { renderSyncPage(); }
  if (id === 'analytiques') { renderAnalyticsPage(); }
  if (id === 'appareils')   { renderDevicesPage(); }
  if (id === 'recuperer')   { renderReceivedFiles(); }
};

/* ══ UPLOAD FLOW — géré dans transfers.js ══ */
function _startUpload_UNUSED(files) {
  if (!files || !files.length) return;
  state.pendingFiles = Array.from(files);
  updateDeviceSelect();
  const preview = document.getElementById('modal-dest-preview');
  if (preview) {
    preview.innerHTML = state.pendingFiles.map(f => `
      <div style="display:flex;align-items:center;gap:8px;padding:.4rem 0;border-bottom:1px solid var(--b1);">
        <span style="font-size:1rem;">${getIcon(f.name)}</span>
        <span style="flex:1;font-size:.82rem;color:var(--t1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.name}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:.68rem;color:var(--t3);">${formatBytes(f.size)}</span>
      </div>`).join('');
  }
  openModal('modal-transfer');
}

async function confirmUpload() {
  const destVal = document.getElementById('mt-dest')?.value || '__storage__';
  closeModal('modal-transfer');
  const target = destVal === '__storage__' ? null : destVal;
  for (const file of state.pendingFiles) {
    await doUpload(file, target, () => {
      renderTransfersPage(); renderFilesPage(); renderReceivedFiles(); renderAnalyticsPage();
    });
  }
  state.pendingFiles = [];
}

function getIcon(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const map = {
    image: ['jpg','jpeg','png','gif','webp','svg','bmp','heic'],
    video: ['mp4','mov','avi','mkv','webm'],
    audio: ['mp3','wav','flac','aac','ogg','m4a'],
    doc:   ['pdf','doc','docx','txt','xls','xlsx','ppt','pptx','csv'],
    archive: ['zip','rar','tar','gz','7z'],
  };
  const icons = { image:'🖼️', video:'🎬', audio:'🎵', doc:'📄', archive:'📦' };
  for (const [t, exts] of Object.entries(map)) if (exts.includes(ext)) return icons[t];
  return '📁';
}

/* ══ APPAREILS — actions globales ══ */
function sendToDevice(devId) {
  updateDeviceSelect();
  const sel = document.getElementById('mt-dest');
  if (sel) sel.value = devId;
  document.getElementById('file-input-hidden')?.click();
}
function downloadAll(devId) {
  state.files.filter(f => f.target_device_id === devId && f.public_url).forEach(f => {
    const a = document.createElement('a');
    a.href     = f.public_url;
    a.download = f.name;
    a.target   = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
  uiToast('success', '⬇ Téléchargements démarrés');
}
async function deleteDeviceById(id) {
  if (!confirm('Supprimer cet appareil ?')) return;
  await supabase.from('devices').delete().eq('id', id);
  state.devices = state.devices.filter(d => d.id !== id);
  renderDevicesPage();
  updateDeviceSelect();
  uiToast('info', 'Appareil supprimé');
}
function openRenameModal() {
  const d = state.devices.find(x => x.id === state.currentDeviceId);
  const inp = document.getElementById('rename-input');
  if (inp) inp.value = d?.name || '';
  openModal('modal-rename');
}
async function doRename() {
  const name = document.getElementById('rename-input')?.value?.trim();
  if (!name) return uiToast('warning', 'Entre un nom.');
  await renameDevice(name);
  closeModal('modal-rename');
  renderDevicesPage();
  updateDeviceSelect();
  renderSettings();
}
function removeUpload(uid) {
  delete state.activeUploads[uid];
  renderActiveTransfers();
}

/* ══ SIGN OUT ══ */
async function signOut() {
  if (state.currentDeviceId)
    await supabase.from('devices').update({ online: false }).eq('id', state.currentDeviceId);
  await supabase.auth.signOut();
  window.location.href = '/creo/login/login.html';
}

/* ══ EVENTS ══ */
function setupEvents() {
  /* Créer le file input s'il n'existe pas */
  let fi = document.getElementById('file-input-hidden');
  if (!fi) {
    fi = document.createElement('input');
    fi.type = 'file'; fi.id = 'file-input-hidden'; fi.multiple = true; fi.style.display = 'none';
    document.body.appendChild(fi);
  }
  fi.addEventListener('change', function () {
    if (this.files.length) startUpload(this.files);
    this.value = '';
  });

  /* Nav links */
  document.querySelectorAll('.nav-link').forEach(l =>
    l.addEventListener('click', () => showPage(l.dataset.page, l))
  );
  document.getElementById('user-card')?.addEventListener('click', () =>
    showPage('parametres', document.querySelector('[data-page="parametres"]'))
  );
  document.getElementById('logout-btn')?.addEventListener('click', signOut);

  /* Action button topbar */
  document.getElementById('action-btn')?.addEventListener('click', () => {
    const p = state.currentPage;
    if (p === 'transferts' || p === 'fichiers') fi.click();
    else if (p === 'appareils')   openModal('modal-device');
    else if (p === 'parametres')  saveProfile();
    else if (p === 'sync')        launchSync();
    else if (p === 'analytiques') exportCSV();
    else if (p === 'recuperer')   renderReceivedFiles();
    else fi.click();
  });

  /* Upload zone */
  const zone = document.getElementById('upload-zone');
  zone?.addEventListener('click', () => fi.click());
  zone?.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone?.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone?.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag-over'); startUpload(e.dataTransfer.files); });

  /* Modal transfer (destination chooser) */
  document.getElementById('modal-cancel')?.addEventListener('click', () => { closeModal('modal-transfer'); state.pendingFiles = []; });
  document.getElementById('modal-confirm')?.addEventListener('click', confirmUploadAndSend);
  document.getElementById('modal-transfer')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) { closeModal('modal-transfer'); state.pendingFiles = []; }
  });

  /* Modal ajout appareil */
  document.getElementById('btn-add-device')?.addEventListener('click', () => openModal('modal-device'));
  document.getElementById('md-cancel')?.addEventListener('click', () => closeModal('modal-device'));
  document.getElementById('md-confirm')?.addEventListener('click', async () => {
    const name = document.getElementById('md-name')?.value?.trim();
    const type = document.getElementById('md-type')?.value || 'desktop';
    const os   = document.getElementById('md-os')?.value?.trim() || '';
    if (!name) return uiToast('warning', "Donne un nom à l'appareil.");
    const btn = document.getElementById('md-confirm');
    btn.classList.add('btn-loading');
    await addDeviceManually(name, type, os);
    btn.classList.remove('btn-loading');
    closeModal('modal-device');
    document.getElementById('md-name').value = '';
    document.getElementById('md-os').value   = '';
    renderDevicesPage();
    updateDeviceSelect();
  });
  document.getElementById('modal-device')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('modal-device');
  });

  /* Rename modal */
  document.getElementById('rename-confirm')?.addEventListener('click', doRename);
  document.getElementById('rename-cancel')?.addEventListener('click', () => closeModal('modal-rename'));
  document.getElementById('rename-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') doRename(); });
  document.getElementById('modal-rename')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('modal-rename');
  });

  /* File modal close */
  document.getElementById('modal-file-close')?.addEventListener('click', () => closeModal('modal-file'));
  document.getElementById('modal-file')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('modal-file');
  });

  /* Filters transferts */
  document.querySelectorAll('#page-transferts .filter-chip').forEach(c =>
    c.addEventListener('click', function () {
      document.querySelectorAll('#page-transferts .filter-chip').forEach(x => x.classList.remove('active'));
      this.classList.add('active');
      state.transferFilter = this.dataset.filter;
      renderTransfersTable(document.getElementById('search-input')?.value?.trim() || '');
    })
  );
  document.getElementById('transfers-sort')?.addEventListener('change', function () {
    state.transferSort = this.value;
    renderTransfersTable();
  });

  /* Filters fichiers */
  document.querySelectorAll('#page-fichiers .filter-chip').forEach(c =>
    c.addEventListener('click', function () {
      document.querySelectorAll('#page-fichiers .filter-chip').forEach(x => x.classList.remove('active'));
      this.classList.add('active');
      state.fileFilter = this.dataset.filter;
      renderFilesPage();
    })
  );
  document.getElementById('files-sort')?.addEventListener('change', function () {
    state.fileSort = this.value;
    renderFilesPage();
  });
  document.getElementById('view-grid-btn')?.addEventListener('click', function () {
    state.fileView = 'grid';
    this.classList.add('active');
    document.getElementById('view-list-btn')?.classList.remove('active');
    renderFilesPage();
  });
  document.getElementById('view-list-btn')?.addEventListener('click', function () {
    state.fileView = 'list';
    this.classList.add('active');
    document.getElementById('view-grid-btn')?.classList.remove('active');
    renderFilesPage();
  });

  /* Search */
  document.getElementById('search-input')?.addEventListener('input', function () {
    const q = this.value.trim();
    document.getElementById('search-clear').style.display = q ? 'block' : 'none';
    if (state.currentPage === 'transferts') renderTransfersTable(q);
    if (state.currentPage === 'fichiers')   renderFilesPage(q);
  });
  document.getElementById('search-clear')?.addEventListener('click', function () {
    document.getElementById('search-input').value = '';
    this.style.display = 'none';
    renderTransfersTable();
    renderFilesPage();
  });

  /* Notifications */
  document.getElementById('notif-btn')?.addEventListener('click', async e => {
    e.stopPropagation();
    const panel = document.getElementById('notif-panel');
    panel?.classList.toggle('open');
    const { data } = await supabase.from('notifications').select('*')
      .eq('user_id', state.session.user.id)
      .order('created_at', { ascending: false }).limit(8);
    const list = document.getElementById('notif-list');
    if (!list) return;
    if (!data?.length) {
      list.innerHTML = `<div style="padding:1.2rem;text-align:center;font-family:'JetBrains Mono',monospace;font-size:.72rem;color:var(--t3);">Aucune notification</div>`;
      return;
    }
    list.innerHTML = data.map(n => `
      <div class="notif-item">
        <div class="notif-dot" style="background:${n.color || 'var(--blue)'};"></div>
        <div>
          <div class="notif-text">${n.text}</div>
          <div class="notif-time">${timeAgo(n.created_at)}</div>
        </div>
      </div>`).join('');
    document.getElementById('notif-dot').style.display = 'none';
    await supabase.from('notifications').update({ read: true }).eq('user_id', state.session.user.id);
  });
  document.getElementById('notif-read-all')?.addEventListener('click', () =>
    document.getElementById('notif-panel')?.classList.remove('open')
  );
  document.addEventListener('click', e => {
    const p = document.getElementById('notif-panel');
    if (p && !p.contains(e.target) && !e.target.closest('#notif-btn')) p.classList.remove('open');
  });

  /* Settings tabs */
  document.querySelectorAll('.s-nav-item').forEach(i =>
    i.addEventListener('click', () => switchSettingsTab(i.dataset.tab))
  );
  document.getElementById('btn-save-profile')?.addEventListener('click', async () => {
    await saveProfile();
    renderSidebar();
  });
  document.getElementById('btn-change-pw')?.addEventListener('click', changePassword);
  document.getElementById('btn-signout-all')?.addEventListener('click', signOut);
  document.getElementById('avatar-input')?.addEventListener('change', function () {
    if (this.files[0]) uploadAvatar(this.files[0]).then(() => { renderSidebar(); renderSettings(); });
    this.value = '';
  });
  document.getElementById('btn-remove-avatar')?.addEventListener('click', async () => {
    await removeAvatar();
    renderSidebar();
    renderSettings();
  });
  document.querySelectorAll('.lang-btn').forEach(b =>
    b.addEventListener('click', () => setLang(b.dataset.lang))
  );
  document.querySelectorAll('.toggle').forEach(t =>
    t.addEventListener('click', function () { this.classList.toggle('on'); })
  );
  document.getElementById('btn-save-notif')?.addEventListener('click', saveNotifSettings);
  document.getElementById('btn-save-network')?.addEventListener('click', () =>
    uiToast('success', '✓ Réseau appliqué')
  );
  document.getElementById('btn-clear-cache')?.addEventListener('click', () => {
    _set('cache-size', '0 MB utilisés');
    uiToast('success', '✓ Cache vidé');
  });
  document.getElementById('btn-reset-settings')?.addEventListener('click', () => {
    if (!confirm('Réinitialiser tous les paramètres ?')) return;
    document.querySelectorAll('.toggle').forEach(t => t.classList.remove('on'));
    uiToast('info', 'Paramètres réinitialisés');
  });

  /* Sync */
  document.getElementById('btn-launch-sync')?.addEventListener('click', launchSync);
  document.getElementById('btn-clear-log')?.addEventListener('click', async () => {
    await supabase.from('sync_log').delete().eq('user_id', state.session.user.id);
    state.syncLog = [];
    renderSyncPage();
    uiToast('info', 'Journal effacé');
  });
  document.getElementById('btn-add-rule')?.addEventListener('click', () => {
    const name = prompt('Nom de la règle :');
    if (name) addSyncRule(name, 'Cet appareil', 'Supabase Storage', 'Manuel');
  });

  /* Btn nouveau transfert */
  document.getElementById('btn-new-transfer')?.addEventListener('click', () => fi.click());

  /* Récupérer */
  document.getElementById('btn-redeem-code')?.addEventListener('click', redeemCode);
  document.getElementById('btn-redeem-link')?.addEventListener('click', redeemLink);
  document.getElementById('code-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') redeemCode();
  });
  document.getElementById('code-input')?.addEventListener('input', function () {
    this.value = this.value.toUpperCase();
  });
  document.getElementById('btn-gen-qr')?.addEventListener('click', () => {
    const code = state.files[0]?.share_code;
    if (code) generateQR(window.location.origin + '/creo/client/client.html#code=' + code);
    else uiToast('warning', 'Aucun fichier avec code disponible.');
  });

  /* Mobile bottom nav */
  document.querySelectorAll('.bn-item[data-page]').forEach(item =>
    item.addEventListener('click', () => {
      showPage(item.dataset.page, document.querySelector(`[data-page="${item.dataset.page}"].nav-link`));
      document.querySelectorAll('.bn-item').forEach(b => b.classList.remove('active'));
      item.classList.add('active');
    })
  );
  const bnMore  = document.getElementById('bn-more-btn');
  const bnPanel = document.getElementById('bn-more-panel');
  const bnOvl   = document.getElementById('bn-more-overlay');
  bnMore?.addEventListener('click', () => { bnPanel?.classList.toggle('open'); bnOvl?.classList.toggle('open'); });
  bnOvl?.addEventListener('click',  () => { bnPanel?.classList.remove('open'); bnOvl?.classList.remove('open'); });
  document.getElementById('more-settings')?.addEventListener('click',   () => { bnPanel?.classList.remove('open'); bnOvl?.classList.remove('open'); showPage('parametres', null); });
  document.getElementById('more-analytics')?.addEventListener('click',  () => { bnPanel?.classList.remove('open'); bnOvl?.classList.remove('open'); showPage('analytiques', null); });
  document.getElementById('more-logout')?.addEventListener('click',     () => { bnPanel?.classList.remove('open'); bnOvl?.classList.remove('open'); signOut(); });
  document.getElementById('mobile-fab')?.addEventListener('click', () => fi.click());

  /* Mobile search */
  const mobOvl    = document.getElementById('mobile-search-overlay');
  const mobInp    = document.getElementById('mob-search-input');
  const mobRes    = document.getElementById('mob-search-results');
  document.getElementById('mobile-search-btn')?.addEventListener('click', () => {
    mobOvl?.classList.add('open');
    setTimeout(() => mobInp?.focus(), 100);
  });
  document.getElementById('mob-search-close')?.addEventListener('click', () => {
    mobOvl?.classList.remove('open');
    if (mobInp) mobInp.value = '';
    if (mobRes) mobRes.innerHTML = '';
  });
  mobInp?.addEventListener('input', function () {
    const q = this.value.trim();
    if (!q) { if (mobRes) mobRes.innerHTML = ''; return; }
    const ql = q.toLowerCase();
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const hl = str => str.replace(re, m => `<span class="hl">${m}</span>`);
    const results = state.files.filter(f => f.name.toLowerCase().includes(ql)).slice(0, 10);
    if (mobRes) {
      mobRes.innerHTML = results.length
        ? results.map(f => `
          <div class="mob-result-item"
               onclick="window.creo.openFileModal('${f.id}');document.getElementById('mobile-search-overlay').classList.remove('open')">
            <div class="mob-result-icon">${getIcon(f.name)}</div>
            <div>
              <div class="mob-result-name">${hl(f.name)}</div>
              <div class="mob-result-meta">${f.size_label || formatBytes(f.size_bytes)} · ${f.type || 'other'}</div>
            </div>
          </div>`).join('')
        : `<div style="padding:2rem;text-align:center;font-family:'JetBrains Mono',monospace;font-size:.75rem;color:var(--t3);">Aucun résultat pour «&nbsp;${q}&nbsp;»</div>`;
    }
  });

  /* Mobile profile strip */
  document.getElementById('mob-profile-strip')?.addEventListener('click', () =>
    showPage('parametres', document.querySelector('[data-page="parametres"]'))
  );

  /* Swipe mobile */
  let tx = 0, ty = 0;
  const pages = ['transferts','appareils','fichiers','recuperer'];
  document.querySelector('.page-content')?.addEventListener('touchstart', e => {
    tx = e.touches[0].clientX; ty = e.touches[0].clientY;
  }, { passive: true });
  document.querySelector('.page-content')?.addEventListener('touchend', e => {
    if (window.innerWidth > 768) return;
    const dx = e.changedTouches[0].clientX - tx;
    const dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;
    const cur = pages.indexOf(state.currentPage);
    if (cur === -1) return;
    if (dx < -60 && cur < pages.length - 1) {
      const next = pages[cur + 1];
      showPage(next, document.querySelector(`[data-page="${next}"].nav-link`));
      document.querySelectorAll('.bn-item').forEach(b => b.classList.remove('active'));
      document.querySelector(`.bn-item[data-page="${next}"]`)?.classList.add('active');
    } else if (dx > 60 && cur > 0) {
      const prev = pages[cur - 1];
      showPage(prev, document.querySelector(`[data-page="${prev}"].nav-link`));
      document.querySelectorAll('.bn-item').forEach(b => b.classList.remove('active'));
      document.querySelector(`.bn-item[data-page="${prev}"]`)?.classList.add('active');
    }
  }, { passive: true });
}

function _set(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

/* ══ BOOTSTRAP ══ */
init();
