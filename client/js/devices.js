/* devices.js */
import { supabase } from './supabase.js';
import { state } from './state.js';
import { detectDevice, getFingerprint, timeAgo, formatBytes, uiToast, DEVICE_SVG, realDownload } from './utils.js';

/* Vérifier si cet appareil est déjà enregistré (par empreinte ou localStorage) */
export async function checkDevice(){
  const fp=getFingerprint();
  // 1. chercher par empreinte
  const{data:byFp}=await supabase.from('devices').select('*').eq('user_id',state.session.user.id).eq('fingerprint',fp).maybeSingle();
  if(byFp){
    state.currentDeviceId=byFp.id;
    localStorage.setItem('creo_device_id',byFp.id);
    const info=detectDevice();
    await supabase.from('devices').update({last_seen:new Date().toISOString(),online:true,browser:info.browser,os:info.os,screen:info.screen}).eq('id',byFp.id);
    return true;
  }
  // 2. fallback localStorage
  const saved=localStorage.getItem('creo_device_id');
  if(saved){
    const{data:byId}=await supabase.from('devices').select('*').eq('id',saved).eq('user_id',state.session.user.id).maybeSingle();
    if(byId){
      state.currentDeviceId=byId.id;
      await supabase.from('devices').update({last_seen:new Date().toISOString(),online:true,fingerprint:fp}).eq('id',byId.id);
      return true;
    }
  }
  state.currentDeviceId=null;
  return false;
}

export async function addThisDevice(name){
  const info=detectDevice();
  const{data,error}=await supabase.from('devices').insert({
    user_id:state.session.user.id,name:name||`${info.browser} — ${info.os}`,
    type:info.type,os:info.os,browser:info.browser,screen:info.screen,
    fingerprint:info.fingerprint,online:true,last_seen:new Date().toISOString(),
  }).select().single();
  if(error){uiToast('error',error.message);return null;}
  state.currentDeviceId=data.id;localStorage.setItem('creo_device_id',data.id);
  state.devices.unshift(data);
  uiToast('success',`✓ "${data.name}" ajouté`);
  return data;
}
export async function addOtherDevice(name,type,os){
  const{data,error}=await supabase.from('devices').insert({
    user_id:state.session.user.id,name,type:type||'desktop',os:os||'—',online:false,last_seen:new Date().toISOString(),
  }).select().single();
  if(error){uiToast('error',error.message);return null;}
  state.devices.push(data);uiToast('success',`✓ "${name}" ajouté`);return data;
}
export async function renameDevice(id,name){
  await supabase.from('devices').update({name}).eq('id',id);
  const d=state.devices.find(x=>x.id===id);if(d)d.name=name;
}
export async function removeDevice(id){
  if(!confirm('Supprimer cet appareil ?'))return;
  await supabase.from('devices').delete().eq('id',id);
  state.devices=state.devices.filter(d=>d.id!==id);
  if(state.currentDeviceId===id){state.currentDeviceId=null;localStorage.removeItem('creo_device_id');}
  uiToast('info','Appareil supprimé');
}

export function isOnline(d){return d.last_seen&&(Date.now()-new Date(d.last_seen))<600000;}

export function renderDevicesPage(){
  const info=detectDevice();
  const curDev=state.devices.find(d=>d.id===state.currentDeviceId);
  const weekAgo=Date.now()-7*86400000;
  const weekBytes=state.files.filter(f=>new Date(f.created_at)>weekAgo).reduce((s,f)=>s+(f.size_bytes||0),0);
  const onlineNow=state.devices.filter(isOnline).length;

  _h('dev-online',`${onlineNow} <span class="unit" style="color:var(--green);">en ligne</span>`);
  _t('dev-total',curDev?.name||'Non enregistré');
  _h('dev-bw',`${(weekBytes/1e9).toFixed(3)} <span class="unit">GB / sem.</span>`);
  _t('dev-last-sync',curDev?.last_seen?new Date(curDev.last_seen).toTimeString().slice(0,5):'—');

  const grid=document.getElementById('devices-grid');if(!grid)return;

  // Bannière si pas encore enregistré
  let html='';
  if(!state.currentDeviceId){
    html+=`<div style="grid-column:1/-1;background:rgba(26,111,255,.06);border:1px solid rgba(26,111,255,.25);
      border-radius:var(--r-xl);padding:1.2rem 1.4rem;display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:.5rem;">
      <div style="color:var(--blue2);">${DEVICE_SVG[info.type]||DEVICE_SVG.desktop}</div>
      <div style="flex:1;min-width:160px;">
        <div style="font-size:.88rem;color:var(--t1);font-weight:500;">Cet appareil n'est pas dans ta liste</div>
        <div style="font-size:.76rem;color:var(--t2);margin-top:2px;">${info.browser} · ${info.os} · ${info.screen}</div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="window.creo.openAddThisModal()">＋ Ajouter cet appareil</button>
    </div>`;
  }
  if(!state.devices.length){
    html+=`<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--t3);font-family:'JetBrains Mono',monospace;font-size:.75rem;">Clique sur ＋ pour enregistrer des appareils.</div>`;
    grid.innerHTML=html;return;
  }
  html+=state.devices.map(d=>{
    const isCur=d.id===state.currentDeviceId;
    const online=isOnline(d)||isCur;
    const pending=state.files.filter(f=>f.target_device_id===d.id&&!f.downloaded_at);
    return`<div class="device-card ${online?'online':'offline'}${isCur?' cur-device':''}">
      <div class="dc-head">
        <div class="dc-icon" style="color:var(--t2);">${DEVICE_SVG[d.type||'desktop']||DEVICE_SVG.desktop}</div>
        <div class="dc-dot ${online?'on':'off'}"></div>
      </div>
      <div class="dc-name">${d.name}${isCur?'<span style="font-family:\'JetBrains Mono\',monospace;font-size:.55rem;color:var(--blue2);margin-left:6px;">cet appareil</span>':''}</div>
      <div class="dc-type">${d.os||'—'} · ${d.browser||'—'}</div>
      <div class="dc-stats">
        <div class="dc-stat"><div class="dc-stat-val" style="font-size:.65rem;">${d.screen||'—'}</div><div class="dc-stat-key">Résolution</div></div>
        <div class="dc-stat"><div class="dc-stat-val" style="font-size:.65rem;">${timeAgo(d.last_seen)}</div><div class="dc-stat-key">Vu</div></div>
      </div>
      ${pending.length&&isCur?`<div style="background:rgba(255,184,0,.08);border:1px solid rgba(255,184,0,.22);border-radius:var(--r);padding:.5rem .8rem;margin-bottom:.8rem;font-size:.78rem;color:var(--amber);display:flex;align-items:center;justify-content:space-between;">
        📥 ${pending.length} fichier(s) en attente
        <button onclick="window.creo.dlAllForDevice('${d.id}')" style="background:rgba(0,255,136,.1);color:var(--green);border:1px solid rgba(0,255,136,.25);padding:2px 8px;border-radius:4px;font-size:.7rem;cursor:pointer;">Tout télécharger</button>
      </div>`:''}
      <div class="dc-actions">
        ${!isCur?`<button class="btn btn-primary btn-sm" onclick="window.creo.sendToDevice('${d.id}')">⬆ Envoyer ici</button>`:''}
        <button class="btn btn-ghost btn-sm" onclick="window.creo.openRenameDeviceModal('${d.id}','${d.name.replace(/'/g,"\\'").replace(/"/g,'\\"')}')">✏</button>
        <button class="btn btn-danger btn-xs" onclick="window.creo.removeDevice('${d.id}')">✕</button>
      </div>
    </div>`;
  }).join('');
  grid.innerHTML=html;
}

/* Met à jour le select dans la modal d'envoi */
export function updateDeviceSelect(){
  const sel=document.getElementById('mt-dest');if(!sel)return;
  const cur=sel.value;
  sel.innerHTML=`<option value="__public__">🌐 Lien public (code + lien + QR)</option>`;
  // Tous les appareils SAUF cet appareil
  const others=state.devices.filter(d=>d.id!==state.currentDeviceId);
  if(others.length){
    const grp=document.createElement('optgroup');grp.label='Envoyer à un appareil';
    others.forEach(d=>{
      const on=isOnline(d);
      const opt=document.createElement('option');opt.value=d.id;
      opt.textContent=`${d.name}${on?' ● en ligne':''}`;
      grp.appendChild(opt);
    });
    sel.appendChild(grp);
  }
  if(cur&&sel.querySelector(`option[value="${cur}"]`))sel.value=cur;
}

function _h(id,h){const e=document.getElementById(id);if(e)e.innerHTML=h;}
function _t(id,t){const e=document.getElementById(id);if(e)e.textContent=t;}
