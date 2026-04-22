/* transfers.js */
import { supabase } from './supabase.js';
import { state, nextUid } from './state.js';
import { getFileType, getFileSVG, formatBytes, genCode, uiToast, copyText, realDownload, TYPE_COLORS } from './utils.js';
import { updateDeviceSelect, isOnline } from './devices.js';

const FREE_QUOTA = 1*1024*1024*1024; // 1 GB
const DAYS = 7;

function usedBytes(){return state.files.filter(f=>f.status==='done').reduce((s,f)=>s+(f.size_bytes||0),0);}
function pct(){return Math.min(100,Math.round(usedBytes()/FREE_QUOTA*100));}
function over(sz=0){return usedBytes()+sz>FREE_QUOTA;}
function recent(){const c=Date.now()-DAYS*86400000;return state.files.filter(f=>new Date(f.created_at)>c);}

/* ── Stats ── */
export function updateTransfersStats(){
  const p=pct(),color=p>=90?'var(--red)':p>=70?'var(--amber)':'var(--green)';
  const online=state.devices.filter(isOnline).length;
  const done=state.files.filter(f=>f.status==='done');
  const rate=state.files.length?Math.round(done.length/state.files.length*100):100;

  _h('stat-total',`${recent().length} <span class="unit">cette semaine</span>`);
  _h('stat-size',`<div style="font-family:'Bebas Neue',sans-serif;font-size:1.9rem;color:var(--white);line-height:1;">${formatBytes(usedBytes())}</div><div style="height:4px;background:var(--d5);border-radius:99px;margin-top:4px;overflow:hidden;"><div style="width:${p}%;height:100%;background:${color};border-radius:99px;transition:width .5s;"></div></div><div style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:${color};margin-top:3px;">${p}% / 1 GB${p>=100?' — PLEIN':''}</div>`);
  _h('stat-devices',`${online} <span class="unit" style="color:var(--green);">en ligne</span>`);
  _h('stat-success',`${rate} <span class="unit">%</span>`);

  const alertEl=document.getElementById('quota-alert');
  if(alertEl){alertEl.style.display=p>=90?'flex':'none';if(p>=90)alertEl.textContent=p>=100?'⛔ Stockage plein — supprime des fichiers pour uploader.':`⚠ Stockage à ${p}% — ${formatBytes(FREE_QUOTA-usedBytes())} restants.`;}
}

/* ── Table historique ── */
export function renderTransfersTable(q=''){
  let data=recent();
  if(state.transferFilter==='public')  data=data.filter(f=>!f.target_device_id);
  if(state.transferFilter==='device')  data=data.filter(f=>!!f.target_device_id);
  if(state.transferFilter==='received')data=data.filter(f=>f.target_device_id===state.currentDeviceId);
  if(state.transferFilter==='error')   data=data.filter(f=>f.status==='error');
  if(q){const ql=q.toLowerCase();data=data.filter(f=>f.name.toLowerCase().includes(ql));}
  data.sort((a,b)=>{
    if(state.transferSort==='date-desc')return new Date(b.created_at)-new Date(a.created_at);
    if(state.transferSort==='date-asc') return new Date(a.created_at)-new Date(b.created_at);
    if(state.transferSort==='size-desc')return(b.size_bytes||0)-(a.size_bytes||0);
    if(state.transferSort==='name-asc') return a.name.localeCompare(b.name);
    return 0;
  });
  const tbody=document.getElementById('transfers-tbody');
  if(!data.length){tbody.innerHTML=`<tr><td colspan="6" class="table-empty">${q?`Aucun résultat pour « ${q} »`:'Aucun fichier cette semaine.'}</td></tr>`;return;}
  const tbody_html=data.map(f=>{
    const hl=q?f.name.replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),m=>`<span class="hl">${m}</span>`):f.name;
    const date=new Date(f.created_at).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    const destDev=f.target_device_id?state.devices.find(d=>d.id===f.target_device_id):null;
    const destHtml=destDev?`<span style="font-size:.8rem;color:var(--t1);">${destDev.name}</span>`:`<span style="font-size:.76rem;color:var(--t2);">Lien public</span>`;
    let status;
    if(f.status==='error') status=`<span class="status st-err">✕ Erreur</span>`;
    else if(f.target_device_id) status=f.downloaded_at?`<span class="status st-done">✓ Reçu</span>`:`<span class="status st-wait">⏳ Pas encore reçu</span>`;
    else status=`<span class="status st-done">✓ Disponible</span>`;
    const shareHtml=!f.target_device_id&&f.share_code?`
      <button class="pill-code" onclick="window.creo.openShare('${f.id}','code')">Code</button>
      <button class="pill-link" onclick="window.creo.openShare('${f.id}','link')">Lien</button>
      <button class="pill-qr"   onclick="window.creo.openShare('${f.id}','qr')">QR</button>
    `:'';
    return`<tr>
      <td><div class="td-name"><span style="color:var(--t3);flex-shrink:0;display:flex;">${getFileSVG(f.name)}</span><div><div class="td-fname">${hl}</div><div class="td-fmeta">${(f.type||'other').toUpperCase()} · ${f.size_label||formatBytes(f.size_bytes)}</div></div></div></td>
      <td>${destHtml}</td>
      <td>${status}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.64rem;color:var(--t3);">${date}</td>
      <td><div style="display:flex;gap:3px;flex-wrap:wrap;">${shareHtml}</div></td>
      <td><div style="display:flex;gap:4px;">
        ${f.public_url?`<button class="btn btn-primary btn-xs" onclick="window.creo.download('${f.public_url}','${encodeURIComponent(f.name)}')">⬇</button>`:''}
        <button class="btn btn-ghost btn-xs" onclick="window.creo.delTransfer('${f.id}','${f.storage_path||''}')">✕</button>
      </div></td>
    </tr>`;
  }).join('');
  tbody.innerHTML=tbody_html;
}

/* ── Ouvrir modal d'envoi ── */
export function startUpload(files){
  if(!files?.length)return;
  const arr=Array.from(files);
  if(over(arr.reduce((s,f)=>s+f.size,0))){uiToast('error',`Stockage plein. Supprime des fichiers.`);return;}
  state.pendingFiles=arr;
  updateDeviceSelect();

  // Preview
  const prev=document.getElementById('modal-dest-preview');
  if(prev)prev.innerHTML=arr.map(f=>`<div style="display:flex;align-items:center;gap:8px;padding:.4rem 0;border-bottom:1px solid var(--b1);"><span style="color:var(--t3);display:flex;">${getFileSVG(f.name)}</span><span style="flex:1;font-size:.82rem;color:var(--t1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.name}</span><span style="font-family:'JetBrains Mono',monospace;font-size:.66rem;color:var(--t3);">${formatBytes(f.size)}</span></div>`).join('');

  // Case "télécharger automatiquement" si appareil en ligne sélectionné
  const onlineOthers=state.devices.filter(d=>d.id!==state.currentDeviceId&&isOnline(d));
  const autoSection=document.getElementById('auto-dl-wrap');
  if(autoSection){
    autoSection.style.display='none';
    if(onlineOthers.length===1){
      // pré-sélectionner cet appareil et cocher la case
      const sel=document.getElementById('mt-dest');
      if(sel)sel.value=onlineOthers[0].id;
      autoSection.style.display='block';
      const cb=document.getElementById('auto-dl-cb');
      if(cb)cb.checked=true;
      document.getElementById('auto-dl-name').textContent=onlineOthers[0].name;
    }
  }
  // Event: quand on change la destination, montrer/cacher la case
  const sel=document.getElementById('mt-dest');
  if(sel){
    sel.onchange=()=>{
      const devId=sel.value;
      if(devId!=='__public__'&&autoSection){
        const dev=state.devices.find(d=>d.id===devId);
        autoSection.style.display='block';
        document.getElementById('auto-dl-name').textContent=dev?.name||'Appareil';
        const cb=document.getElementById('auto-dl-cb');
        if(cb)cb.checked=!!isOnline(dev);
      } else if(autoSection){autoSection.style.display='none';}
    };
  }
  document.getElementById('modal-transfer')?.classList.add('open');
}

export async function confirmSend(){
  const dest=document.getElementById('mt-dest')?.value||'__public__';
  document.getElementById('modal-transfer')?.classList.remove('open');
  const isDevice=dest!=='__public__';
  const targetId=isDevice?dest:null;
  const autoDl=isDevice&&document.getElementById('auto-dl-cb')?.checked;
  for(const file of state.pendingFiles){
    if(over(file.size)){uiToast('error',`Quota plein — ${file.name} ignoré.`);continue;}
    await doUpload(file,targetId,autoDl);
  }
  state.pendingFiles=[];
}

export async function doUpload(file,targetDeviceId,autoDownload=false){
  if(file.size>50*1024*1024){uiToast('error',`${file.name} trop grand (max 50 MB)`);return;}
  const uid=nextUid();
  const code=targetDeviceId?null:genCode(); // code QUE si lien public
  state.activeUploads[uid]={name:file.name,progress:0,status:'uploading',size:file.size,isDevice:!!targetDeviceId};
  renderActiveUploads();
  if(state.notifSettings.start)uiToast('info',`Envoi de ${file.name}…`);
  try{
    const ext=(file.name.includes('.')?file.name.split('.').pop():'bin').toLowerCase();
    const path=`${state.session.user.id}/${uid}.${ext}`;
    const type=getFileType(file.name,file.type);
    let fp=0;
    const iv=setInterval(()=>{fp=Math.min(fp+3+Math.random()*12,90);_progCard(uid,Math.round(fp));},160);
    const{error:upErr}=await supabase.storage.from('creo-files').upload(path,file,{upsert:true,contentType:file.type||'application/octet-stream'});
    clearInterval(iv);if(upErr)throw upErr;
    _progCard(uid,100);
    const{data:ud}=supabase.storage.from('creo-files').getPublicUrl(path);
    const{data:row,error:dbErr}=await supabase.from('files').insert({
      user_id:state.session.user.id,name:file.name,type,size_bytes:file.size,size_label:formatBytes(file.size),
      storage_path:path,public_url:ud.publicUrl,mime_type:file.type||'application/octet-stream',
      status:'done',share_code:code,target_device_id:targetDeviceId||null,downloaded_at:null,
      expires_at:new Date(Date.now()+DAYS*86400000).toISOString(),
    }).select().single();
    if(dbErr)throw dbErr;
    state.activeUploads[uid].status='done';state.activeUploads[uid].code=code;state.activeUploads[uid].url=ud.publicUrl;
    if(row)state.files.unshift(row);
    renderActiveUploads();updateTransfersStats();renderTransfersTable();
    const dest=targetDeviceId?(state.devices.find(d=>d.id===targetDeviceId)?.name||'Appareil'):'Lien public';
    if(state.notifSettings.done)uiToast('success',code?`✓ ${file.name} → ${dest} · Code: ${code}`:`✓ ${file.name} → ${dest}`);
    // Téléchargement automatique si case cochée et c'est cet appareil
    if(autoDownload&&targetDeviceId===state.currentDeviceId&&row){
      await realDownload(ud.publicUrl,file.name);
      await supabase.from('files').update({downloaded_at:new Date().toISOString()}).eq('id',row.id);
      row.downloaded_at=new Date().toISOString();
    }
    setTimeout(()=>{delete state.activeUploads[uid];renderActiveUploads();},10000);
  }catch(err){
    console.error(err);state.activeUploads[uid].status='error';renderActiveUploads();
    if(state.notifSettings.error)uiToast('error',`✕ Erreur : ${file.name}`);
    setTimeout(()=>{delete state.activeUploads[uid];renderActiveUploads();},8000);
  }
}

function _progCard(uid,p){
  const b=document.getElementById(`tc-prog-${uid}`);if(b)b.style.width=p+'%';
  const t=document.getElementById(`tc-pct-${uid}`);if(t)t.textContent=p+'%';
  if(state.activeUploads[uid])state.activeUploads[uid].progress=p;
}

export function renderActiveUploads(){
  const c=document.getElementById('active-transfers-container');if(!c)return;
  const entries=Object.entries(state.activeUploads);
  const countEl=document.getElementById('active-count');
  if(countEl)countEl.textContent=entries.filter(([,u])=>u.status==='uploading').length+' en cours';
  if(!entries.length){c.innerHTML=`<div style="text-align:center;padding:1.5rem;font-family:'JetBrains Mono',monospace;font-size:.72rem;color:var(--t3);">Glisse des fichiers ici ou clique ＋ Nouveau</div>`;return;}
  c.innerHTML=entries.map(([uid,u])=>`
    <div class="transfer-card ${u.status==='done'?'transfer-done':u.status==='error'?'transfer-err':'active-transfer'}">
      <div class="tc-header">
        <div class="tc-name">
          <span style="color:var(--t3);display:flex;">${getFileSVG(u.name)}</span>
          <span class="fname">${u.name}</span>
          ${u.status==='done'?`<span class="badge badge-green">✓ Envoyé</span>`:''}
          ${u.status==='error'?`<span class="badge badge-red">✕ Erreur</span>`:''}
          ${u.status==='uploading'?`<span class="badge badge-blue">En cours…</span>`:''}
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          ${u.status==='done'&&u.code?`<button onclick="window.creo.openShareForUpload('${uid}')" style="font-family:'Bebas Neue',sans-serif;font-size:.9rem;color:var(--amber);letter-spacing:.12em;background:none;border:none;cursor:pointer;padding:0;">${u.code}</button>`:''}
          ${u.status==='done'&&!u.isDevice?`<button class="btn btn-ghost btn-xs" onclick="window.creo.openShareForUpload('${uid}')">Partager</button>`:''}
          <button class="btn btn-ghost btn-xs" onclick="window.creo.removeUpload('${uid}')">✕</button>
        </div>
      </div>
      <div class="prog-bar"><div class="prog-fill ${u.status==='done'?'done':u.status==='error'?'err':''}" id="tc-prog-${uid}" style="width:${u.progress}%;"></div></div>
      <div class="tc-footer"><span>${formatBytes(u.size)}</span><span id="tc-pct-${uid}">${u.status==='done'?'100%':u.status==='error'?'Erreur':u.progress+'%'}</span></div>
    </div>`).join('');
}

/* ── Modal partage (code / lien / QR) ── */
export function openShare(fileId,mode){
  const f=state.files.find(x=>x.id===fileId);if(!f)return;
  _showShareModal(f.share_code,f.public_url,f.name,mode);
}
export function openShareForUpload(uid){
  const u=state.activeUploads[uid];if(!u)return;
  _showShareModal(u.code,u.url,u.name,'code');
}
function _showShareModal(code,url,name,mode='code'){
  const m=document.getElementById('modal-share');if(!m)return;
  _t('share-file-name',name||'');
  _t('share-code-big',code||'—');
  // Relier les boutons copier (remplacer les listeners)
  ['share-btn-copy-code','share-btn-copy-link'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    const newEl=el.cloneNode(true);el.parentNode.replaceChild(newEl,el);
  });
  document.getElementById('share-btn-copy-code')?.addEventListener('click',()=>copyText(code||''));
  document.getElementById('share-btn-copy-link')?.addEventListener('click',()=>copyText(url||''));
  _t('share-link-value',url||'—');
  // QR → pointe vers express.html?code=XXX (sans login requis)
  const qrEl=document.getElementById('share-qr-img');
  if(qrEl&&code){
    const base=window.location.origin;
    const expressUrl=`${base}/creo/menu/express.html?code=${code}`;
    qrEl.src=`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(expressUrl)}&size=200x200&bgcolor=080808&color=e2e2e2&margin=12&format=png`;
    qrEl.onerror=()=>{qrEl.alt='QR Code indisponible';};
  }
  const recvLink=document.getElementById('share-recv-link');
  if(recvLink&&code){
    const base=window.location.origin;
    recvLink.href=`${base}/creo/menu/express.html?code=${code}`;
    recvLink.textContent='Ouvrir la page de téléchargement →';
  }
  // Onglet actif
  document.querySelectorAll('.share-tab').forEach(t=>t.classList.toggle('active',t.dataset.mode===mode));
  document.querySelectorAll('.share-panel').forEach(p=>p.style.display=p.dataset.mode===mode?'block':'none');
  m.classList.add('open');
}

/* ── Télécharger ── */
export async function download(url,encodedName){
  const name=decodeURIComponent(encodedName);
  await realDownload(url,name);
  // Marquer reçu
  const f=state.files.find(x=>x.public_url===url);
  if(f&&!f.downloaded_at){
    f.downloaded_at=new Date().toISOString();
    await supabase.from('files').update({downloaded_at:f.downloaded_at}).eq('id',f.id);
    renderTransfersTable();
  }
}
export async function dlAllForDevice(devId){
  const files=state.files.filter(f=>f.target_device_id===devId&&f.public_url&&!f.downloaded_at);
  for(const f of files)await realDownload(f.public_url,f.name);
  if(files.length){
    await supabase.from('files').update({downloaded_at:new Date().toISOString()}).in('id',files.map(f=>f.id));
    files.forEach(f=>f.downloaded_at=new Date().toISOString());
    renderTransfersTable();uiToast('success',`⬇ ${files.length} fichier(s) téléchargé(s)`);
  }
}

/* ── Supprimer ── */
export async function delTransfer(id,path){
  if(!confirm('Supprimer ce fichier définitivement ?'))return;
  if(path)await supabase.storage.from('creo-files').remove([path]);
  await supabase.from('files').delete().eq('id',id);
  state.files=state.files.filter(f=>f.id!==id);
  updateTransfersStats();renderTransfersTable();uiToast('info','Fichier supprimé');
}

/* ── Nettoyage auto des expirés ── */
export async function cleanExpired(){
  const cutoff=new Date(Date.now()-DAYS*86400000).toISOString();
  const old=state.files.filter(f=>f.created_at<cutoff);
  for(const f of old){if(f.storage_path)await supabase.storage.from('creo-files').remove([f.storage_path]);await supabase.from('files').delete().eq('id',f.id);}
  if(old.length)state.files=state.files.filter(f=>f.created_at>=cutoff);
}

function _h(id,h){const e=document.getElementById(id);if(e)e.innerHTML=h;}
function _t(id,t){const e=document.getElementById(id);if(e)e.textContent=t;}
