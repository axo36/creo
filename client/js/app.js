/* app.js */
import { supabase }                                       from './supabase.js';
import { state, nextUid }                                 from './state.js';
import { uiToast, copyText, openModal, closeModal,
         detectDevice, formatBytes, timeAgo, realDownload } from './utils.js';
import { loadFiles, loadDevices, loadSharedFiles,
         loadSyncRules, loadSyncLog, setupRealtime }       from './data.js';
import { checkDevice, addThisDevice, addOtherDevice,
         renameDevice, removeDevice, renderDevicesPage,
         updateDeviceSelect, dlAllForDevice }              from './devices.js';
import { startUpload, confirmSend, doUpload,
         renderActiveUploads, renderTransfersTable,
         updateTransfersStats, openShare, openShareForUpload,
         download, dlAllForDevice as dlAll,
         delTransfer, cleanExpired }                      from './transfers.js';
import { renderFilesPage, openFileModal }                  from './files.js';
import { redeemCode, redeemLink, sendToUser,
         acceptShared, refuseShared,
         renderSharedFiles, renderRecuperPage }            from './recuperer.js';
import { renderSyncPage, launchSync, toggleRule,
         deleteRule, addSyncRule }                         from './sync.js';
import { renderAnalyticsPage, exportCSV }                  from './analytics.js';
import { renderSettings, saveProfile, changePassword,
         uploadAvatar, removeAvatar, setLang,
         saveNotifSettings, applyNotifToggles,
         switchSettingsTab }                              from './settings.js';

/* ── Exposer globalement ── */
window.creo = {
  copyText, download, realDownload, dlAllForDevice:dlAll,
  openFileModal, delTransfer, openShare, openShareForUpload,
  removeDevice, openRenameDeviceModal, openAddThisModal,
  sendToDevice, sendToUser, acceptShared, refuseShared,
  removeUpload: uid=>{ delete state.activeUploads[uid]; renderActiveUploads(); },
  toggleRule, deleteRule, redeemCode, redeemLink,
};

/* ── Messages de chargement ── */
const LOAD_MSGS = [
  'Connexion sécurisée…',
  'Chargement du profil…',
  'Vérification de tes appareils…',
  'Chargement des fichiers…',
  '💡 Va dans Paramètres pour personnaliser CREO',
  'Synchronisation des données…',
  'Presque prêt !',
];
function startLoadMsgs(){
  let i=0;
  const el=document.getElementById('loading-txt');
  if(el)el.textContent=LOAD_MSGS[i++];
  return setInterval(()=>{if(el&&i<LOAD_MSGS.length)el.textContent=LOAD_MSGS[i++];},900);
}

/* ── INIT ── */
async function init(){
  const iv=startLoadMsgs();
  const{data:{session:s}}=await supabase.auth.getSession();
  if(!s){clearInterval(iv);window.location.href='/creo/login/login.html';return;}
  state.session=s;

  const{data:p}=await supabase.from('profiles').select('*').eq('id',s.user.id).single();
  if(!p?.username||!p?.client_code||!p?.type){clearInterval(iv);window.location.href='/creo/login/complete-profile.html';return;}
  state.profile=p;
  state.currentLang=p.lang||state.currentLang;
  if(p.notif_settings)try{state.notifSettings={...state.notifSettings,...JSON.parse(p.notif_settings)};}catch{}

  supabase.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_OUT')window.location.href='/creo/login/login.html';});

  // Vérifier si cet appareil est déjà enregistré (empreinte / localStorage)
  await checkDevice();

  await Promise.all([loadFiles(),loadDevices(),loadSharedFiles(),loadSyncRules(),loadSyncLog()]);
  await cleanExpired();

  clearInterval(iv);
  renderSidebar();renderSettings();
  showPage('transferts',null);
  applyNotifToggles();updateDeviceSelect();
  hideLoading();
  setupEvents();

  // Realtime auto-refresh
  setupRealtime(
    ()=>{ renderTransfersTable();renderFilesPage();updateTransfersStats(); },
    ()=>{ renderDevicesPage();updateDeviceSelect(); },
    (newItem)=>{ renderSharedFiles(); uiToast('info',`📥 Nouveau fichier de @${newItem.from_user_id?.slice(0,8)||'?'}`); }
  );

  // Stat vitesse simulée
  setInterval(()=>{ const e=document.getElementById('stat-speed'); if(e)e.innerHTML=`${(700+Math.random()*700).toFixed(0)} <span class="unit">MB/s</span>`; },1500);
}

function hideLoading(){
  document.getElementById('loading-screen').style.display='none';
  document.getElementById('app-shell').style.display='block';
  updateMobStrip();
}

/* ── Sidebar ── */
function renderSidebar(){
  const av=state.profile?.avatar_url;
  const avEl=document.getElementById('sidebar-avatar');
  if(avEl){if(av)avEl.innerHTML=`<img src="${av}" alt="">`;else avEl.textContent=initials();}
  _t('sidebar-name',displayName());_t('sidebar-role',cap(state.profile?.type||''));
  updateMobStrip();
}
function updateMobStrip(){
  const av=state.profile?.avatar_url;
  const m=document.getElementById('mob-strip-av');
  if(m){if(av)m.innerHTML=`<img src="${av}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;else m.textContent=initials();}
  _t('mob-strip-name',displayName());_t('mob-strip-role',cap(state.profile?.type||''));
}
function displayName(){
  if(state.profile?.first_name&&state.profile?.last_name)return`${state.profile.first_name} ${state.profile.last_name}`;
  if(state.profile?.username)return`@${state.profile.username}`;
  return state.session?.user?.email?.split('@')[0]||'Utilisateur';
}
function initials(){return displayName().split(' ').map(w=>w[0]||'').slice(0,2).join('').toUpperCase()||'?';}
function cap(s){return s?s.charAt(0).toUpperCase()+s.slice(1):'';}

/* ── Nav ── */
const META={
  transferts: {title:'TRANSFERTS', bc:'// envoyer · recevoir', btn:'⬆ Envoyer'},
  appareils:  {title:'APPAREILS',  bc:'// mes appareils',      btn:'＋ Ajouter'},
  fichiers:   {title:'FICHIERS',   bc:'// tous mes fichiers',  btn:'⬆ Uploader'},
  recuperer:  {title:'RÉCUPÉRER',  bc:'// code · user · express', btn:'↺ Actualiser'},
  parametres: {title:'PARAMÈTRES', bc:'// compte',             btn:'✓ Sauvegarder'},
  analytiques:{title:'ANALYTIQUES',bc:'// statistiques',       btn:'↓ Exporter CSV'},
};

window.showPage=function(id,el){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-link,.bn-item').forEach(l=>l.classList.remove('active'));
  const page=document.getElementById('page-'+id);if(!page)return;
  page.classList.add('active');
  if(el)el.classList.add('active');
  state.currentPage=id;
  const m=META[id]||{title:id.toUpperCase(),bc:'',btn:''};
  _t('topbar-title',m.title);_t('topbar-bc',m.bc);
  const ab=document.getElementById('action-btn');if(ab)ab.textContent=m.btn;
  document.getElementById('notif-panel')?.classList.remove('open');
  // Re-render
  if(id==='transferts'){renderActiveUploads();renderTransfersTable();updateTransfersStats();}
  if(id==='appareils') renderDevicesPage();
  if(id==='fichiers')  renderFilesPage();
  if(id==='recuperer') renderRecuperPage();
  if(id==='parametres')renderSettings();
  if(id==='analytiques')renderAnalyticsPage();
};

/* ── Modals appareils ── */
function openAddThisModal(){
  const info=detectDevice();
  const inp=document.getElementById('add-this-name');
  if(inp)inp.value=`${info.browser} — ${info.os}`;
  const det=document.getElementById('add-this-det');
  if(det)det.textContent=`${info.os} · ${info.browser} · ${info.screen}`;
  openModal('modal-add-this');
}
function openRenameDeviceModal(id,curName){
  const inp=document.getElementById('rename-input');if(inp)inp.value=curName||'';
  document.getElementById('rename-confirm')._devId=id;
  openModal('modal-rename');
}
function sendToDevice(devId){
  updateDeviceSelect();
  const sel=document.getElementById('mt-dest');if(sel)sel.value=devId;
  document.getElementById('file-input-hidden')?.click();
}

/* ── Events ── */
function setupEvents(){
  // File input
  let fi=document.getElementById('file-input-hidden');
  if(!fi){fi=document.createElement('input');fi.type='file';fi.id='file-input-hidden';fi.multiple=true;fi.style.display='none';document.body.appendChild(fi);}
  fi.addEventListener('change',function(){if(this.files.length)startUpload(this.files);this.value='';});

  // Nav
  document.querySelectorAll('.nav-link').forEach(l=>l.addEventListener('click',()=>showPage(l.dataset.page,l)));
  document.getElementById('user-card')?.addEventListener('click',()=>showPage('parametres',document.querySelector('[data-page="parametres"]')));
  document.getElementById('logout-btn')?.addEventListener('click',signOut);

  // Action btn
  document.getElementById('action-btn')?.addEventListener('click',()=>{
    const p=state.currentPage;
    if(p==='transferts'||p==='fichiers')fi.click();
    else if(p==='appareils')openModal('modal-add-device');
    else if(p==='parametres')saveProfile().then(()=>{renderSidebar();renderSettings();});
    else if(p==='analytiques')exportCSV();
    else if(p==='recuperer')renderRecuperPage();
    else fi.click();
  });

  // Zone upload
  const zone=document.getElementById('upload-zone');
  zone?.addEventListener('click',()=>fi.click());
  zone?.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('drag-over');});
  zone?.addEventListener('dragleave',()=>zone.classList.remove('drag-over'));
  zone?.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('drag-over');startUpload(e.dataTransfer.files);});

  // Modal transfer
  document.getElementById('modal-cancel')?.addEventListener('click',()=>{closeModal('modal-transfer');state.pendingFiles=[];});
  document.getElementById('modal-confirm')?.addEventListener('click',confirmSend);
  document.getElementById('modal-transfer')?.addEventListener('click',e=>{if(e.target===e.currentTarget){closeModal('modal-transfer');state.pendingFiles=[];}});

  // Modal ajouter cet appareil
  document.getElementById('add-this-cancel')?.addEventListener('click',()=>closeModal('modal-add-this'));
  document.getElementById('add-this-confirm')?.addEventListener('click',async()=>{
    const name=document.getElementById('add-this-name')?.value?.trim();
    const btn=document.getElementById('add-this-confirm');btn.classList.add('btn-loading');
    await addThisDevice(name);btn.classList.remove('btn-loading');
    closeModal('modal-add-this');renderDevicesPage();updateDeviceSelect();
  });
  document.getElementById('modal-add-this')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal('modal-add-this');});

  // Modal ajouter autre appareil
  document.getElementById('btn-add-device')?.addEventListener('click',()=>openModal('modal-add-device'));
  document.getElementById('add-dev-cancel')?.addEventListener('click',()=>closeModal('modal-add-device'));
  document.getElementById('add-dev-confirm')?.addEventListener('click',async()=>{
    const name=document.getElementById('add-dev-name')?.value?.trim();
    const type=document.getElementById('add-dev-type')?.value||'desktop';
    const os=document.getElementById('add-dev-os')?.value?.trim()||'';
    if(!name)return uiToast('warning','Entre un nom.');
    const btn=document.getElementById('add-dev-confirm');btn.classList.add('btn-loading');
    await addOtherDevice(name,type,os);btn.classList.remove('btn-loading');
    closeModal('modal-add-device');if(document.getElementById('add-dev-name'))document.getElementById('add-dev-name').value='';
    renderDevicesPage();updateDeviceSelect();
  });
  document.getElementById('modal-add-device')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal('modal-add-device');});

  // Modal renommer
  document.getElementById('rename-confirm')?.addEventListener('click',async function(){
    const name=document.getElementById('rename-input')?.value?.trim();const id=this._devId||state.currentDeviceId;
    if(!name)return;
    await renameDevice(id,name);closeModal('modal-rename');renderDevicesPage();updateDeviceSelect();renderSettings();uiToast('success',`✓ Renommé "${name}"`);
  });
  document.getElementById('rename-cancel')?.addEventListener('click',()=>closeModal('modal-rename'));
  document.getElementById('rename-input')?.addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('rename-confirm').click();});
  document.getElementById('modal-rename')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal('modal-rename');});

  // Modal file
  document.getElementById('modal-file-close')?.addEventListener('click',()=>closeModal('modal-file'));
  document.getElementById('modal-file')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal('modal-file');});

  // Modal share
  document.getElementById('modal-share')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal('modal-share');});
  document.getElementById('share-modal-close')?.addEventListener('click',()=>closeModal('modal-share'));
  // Tabs partage
  document.querySelectorAll('.share-tab').forEach(t=>t.addEventListener('click',()=>{
    document.querySelectorAll('.share-tab').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.share-panel').forEach(x=>x.style.display='none');
    t.classList.add('active');
    document.querySelectorAll(`.share-panel[data-mode="${t.dataset.mode}"]`).forEach(x=>x.style.display='block');
  }));

  // Filters transferts
  document.querySelectorAll('#page-transferts .filter-chip').forEach(c=>c.addEventListener('click',function(){
    document.querySelectorAll('#page-transferts .filter-chip').forEach(x=>x.classList.remove('active'));
    this.classList.add('active');state.transferFilter=this.dataset.filter;
    renderTransfersTable(document.getElementById('search-input')?.value?.trim()||'');
  }));
  document.getElementById('transfers-sort')?.addEventListener('change',function(){state.transferSort=this.value;renderTransfersTable();});

  // Filters fichiers
  document.querySelectorAll('#page-fichiers .filter-chip').forEach(c=>c.addEventListener('click',function(){
    document.querySelectorAll('#page-fichiers .filter-chip').forEach(x=>x.classList.remove('active'));
    this.classList.add('active');state.fileFilter=this.dataset.filter;renderFilesPage();
  }));
  document.getElementById('files-sort')?.addEventListener('change',function(){state.fileSort=this.value;renderFilesPage();});
  document.getElementById('view-grid-btn')?.addEventListener('click',function(){state.fileView='grid';this.classList.add('active');document.getElementById('view-list-btn')?.classList.remove('active');renderFilesPage();});
  document.getElementById('view-list-btn')?.addEventListener('click',function(){state.fileView='list';this.classList.add('active');document.getElementById('view-grid-btn')?.classList.remove('active');renderFilesPage();});

  // Search
  const si=document.getElementById('search-input');
  si?.addEventListener('input',function(){
    const q=this.value.trim();
    document.getElementById('search-clear').style.display=q?'block':'none';
    if(state.currentPage==='transferts')renderTransfersTable(q);
    if(state.currentPage==='fichiers')renderFilesPage(q);
  });
  document.getElementById('search-clear')?.addEventListener('click',function(){si.value='';this.style.display='none';renderTransfersTable();renderFilesPage();});

  // Notif
  document.getElementById('notif-btn')?.addEventListener('click',async e=>{
    e.stopPropagation();
    document.getElementById('notif-panel')?.classList.toggle('open');
    const{data}=await supabase.from('notifications').select('*').eq('user_id',state.session.user.id).order('created_at',{ascending:false}).limit(8);
    const list=document.getElementById('notif-list');if(!list)return;
    list.innerHTML=!data?.length?`<div style="padding:1.2rem;text-align:center;font-family:'JetBrains Mono',monospace;font-size:.72rem;color:var(--t3);">Aucune notification</div>`
      :data.map(n=>`<div class="notif-item"><div class="notif-dot" style="background:${n.color||'var(--blue)'};"></div><div><div class="notif-text">${n.text}</div><div class="notif-time">${timeAgo(n.created_at)}</div></div></div>`).join('');
    document.getElementById('notif-dot').style.display='none';
    await supabase.from('notifications').update({read:true}).eq('user_id',state.session.user.id);
  });
  document.getElementById('notif-read-all')?.addEventListener('click',()=>document.getElementById('notif-panel')?.classList.remove('open'));
  document.addEventListener('click',e=>{const p=document.getElementById('notif-panel');if(p&&!p.contains(e.target)&&!e.target.closest('#notif-btn'))p.classList.remove('open');});

  // Settings
  document.querySelectorAll('.s-nav-item').forEach(i=>i.addEventListener('click',()=>switchSettingsTab(i.dataset.tab)));
  document.getElementById('btn-save-profile')?.addEventListener('click',async()=>{await saveProfile();renderSidebar();renderSettings();});
  document.getElementById('btn-change-pw')?.addEventListener('click',changePassword);
  document.getElementById('btn-signout-all')?.addEventListener('click',signOut);
  document.getElementById('avatar-input')?.addEventListener('change',function(){if(this.files[0])uploadAvatar(this.files[0]).then(()=>{renderSidebar();renderSettings();});this.value='';});
  document.getElementById('btn-remove-avatar')?.addEventListener('click',async()=>{await removeAvatar();renderSidebar();renderSettings();});
  document.querySelectorAll('.lang-btn').forEach(b=>b.addEventListener('click',()=>setLang(b.dataset.lang)));
  document.querySelectorAll('.toggle').forEach(t=>t.addEventListener('click',function(){this.classList.toggle('on');}));
  document.getElementById('btn-save-notif')?.addEventListener('click',saveNotifSettings);
  document.getElementById('btn-save-network')?.addEventListener('click',()=>uiToast('success','✓ Réseau appliqué'));
  document.getElementById('btn-clear-cache')?.addEventListener('click',()=>{_t('cache-size','0 MB');uiToast('success','✓ Cache vidé');});
  document.getElementById('btn-reset-settings')?.addEventListener('click',()=>{if(confirm('Réinitialiser ?')){document.querySelectorAll('.toggle').forEach(t=>t.classList.remove('on'));uiToast('info','Paramètres réinitialisés');}});

  // Récupérer
  document.getElementById('code-input')?.addEventListener('input',function(){this.value=this.value.toUpperCase();});
  document.getElementById('code-input')?.addEventListener('keydown',e=>{if(e.key==='Enter')redeemCode();});
  document.getElementById('btn-redeem-code')?.addEventListener('click',redeemCode);
  document.getElementById('btn-redeem-link')?.addEventListener('click',redeemLink);
  document.getElementById('btn-send-to-user')?.addEventListener('click',sendToUser);

  // Sync
  document.getElementById('btn-launch-sync')?.addEventListener('click',launchSync);
  document.getElementById('btn-clear-log')?.addEventListener('click',async()=>{await supabase.from('sync_log').delete().eq('user_id',state.session.user.id);state.syncLog=[];renderSyncPage();uiToast('info','Journal effacé');});
  document.getElementById('btn-add-rule')?.addEventListener('click',()=>{const n=prompt('Nom de la règle :');if(n)addSyncRule(n,'Cet appareil','Supabase Storage','Manuel');});
  document.getElementById('btn-new-transfer')?.addEventListener('click',()=>fi.click());

  // Mobile bottom nav
  document.querySelectorAll('.bn-item[data-page]').forEach(item=>item.addEventListener('click',()=>{
    showPage(item.dataset.page,document.querySelector(`[data-page="${item.dataset.page}"].nav-link`));
    document.querySelectorAll('.bn-item').forEach(b=>b.classList.remove('active'));item.classList.add('active');
  }));
  const bnMore=document.getElementById('bn-more-btn'),bnPanel=document.getElementById('bn-more-panel'),bnOvl=document.getElementById('bn-more-overlay');
  bnMore?.addEventListener('click',()=>{bnPanel?.classList.toggle('open');bnOvl?.classList.toggle('open');});
  bnOvl?.addEventListener('click',()=>{bnPanel?.classList.remove('open');bnOvl?.classList.remove('open');});
  ['settings','analytics'].forEach(key=>{
    document.getElementById(`more-${key}`)?.addEventListener('click',()=>{
      bnPanel?.classList.remove('open');bnOvl?.classList.remove('open');
      showPage(key==='settings'?'parametres':'analytiques',null);
    });
  });
  document.getElementById('more-logout')?.addEventListener('click',()=>{bnPanel?.classList.remove('open');bnOvl?.classList.remove('open');signOut();});
  document.getElementById('mobile-fab')?.addEventListener('click',()=>fi.click());

  // Mobile search
  const mOvl=document.getElementById('mobile-search-overlay'),mInp=document.getElementById('mob-search-input'),mRes=document.getElementById('mob-search-results');
  document.getElementById('mobile-search-btn')?.addEventListener('click',()=>{mOvl?.classList.add('open');setTimeout(()=>mInp?.focus(),80);});
  document.getElementById('mob-search-close')?.addEventListener('click',()=>{mOvl?.classList.remove('open');if(mInp)mInp.value='';if(mRes)mRes.innerHTML='';});
  mInp?.addEventListener('input',function(){
    const q=this.value.trim();if(!q){if(mRes)mRes.innerHTML='';return;}
    const ql=q.toLowerCase();
    const re=new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi');
    const hl=str=>str.replace(re,m=>`<span class="hl">${m}</span>`);
    const results=state.files.filter(f=>f.name.toLowerCase().includes(ql)).slice(0,10);
    if(mRes)mRes.innerHTML=results.length?results.map(f=>`<div class="mob-result-item" onclick="window.creo.openFileModal('${f.id}');document.getElementById('mobile-search-overlay').classList.remove('open')"><div style="font-family:'JetBrains Mono',monospace;font-size:.65rem;color:var(--t3);margin-right:8px;">${''}</div><div><div class="mob-result-name">${hl(f.name)}</div><div class="mob-result-meta">${f.size_label||formatBytes(f.size_bytes)} · ${f.type||'other'}</div></div></div>`).join(''):`<div style="padding:2rem;text-align:center;font-family:'JetBrains Mono',monospace;font-size:.75rem;color:var(--t3);">Aucun résultat pour « ${q} »</div>`;
  });
  document.getElementById('mob-profile-strip')?.addEventListener('click',()=>showPage('parametres',document.querySelector('[data-page="parametres"]')));

  // Swipe mobile
  let tx=0,ty=0;const pages=['transferts','appareils','fichiers','recuperer'];
  document.querySelector('.page-content')?.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY;},{passive:true});
  document.querySelector('.page-content')?.addEventListener('touchend',e=>{
    if(window.innerWidth>768)return;
    const dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;
    if(Math.abs(dx)<55||Math.abs(dy)>Math.abs(dx))return;
    const cur=pages.indexOf(state.currentPage);if(cur===-1)return;
    const next=dx<-55?pages[cur+1]:pages[cur-1];
    if(next){showPage(next,document.querySelector(`[data-page="${next}"].nav-link`));
    document.querySelectorAll('.bn-item').forEach(b=>b.classList.remove('active'));
    document.querySelector(`.bn-item[data-page="${next}"]`)?.classList.add('active');}
  },{passive:true});
}

async function signOut(){
  if(state.currentDeviceId)await supabase.from('devices').update({online:false}).eq('id',state.currentDeviceId);
  await supabase.auth.signOut();window.location.href='/creo/login/login.html';
}
function _t(id,v){const e=document.getElementById(id);if(e)e.textContent=v;}
init();
