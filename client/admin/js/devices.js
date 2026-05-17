/* devices.js — ADMIN */
import { supabase } from './supabase.js';
import { state } from './state.js';
import { detectDevice, getFingerprint, timeAgo, formatBytes, uiToast, DEVICE_SVG, realDownload } from './utils.js';

export async function checkDevice(){
  const fp=getFingerprint();
  const{data:byFp}=await supabase.from('devices').select('*').eq('user_id',state.session.user.id).eq('fingerprint',fp).maybeSingle();
  if(byFp){
    state.currentDeviceId=byFp.id;
    localStorage.setItem('creo_device_id',byFp.id);
    const info=detectDevice();
    await supabase.from('devices').update({last_seen:new Date().toISOString(),online:true,browser:info.browser,os:info.os,screen:info.screen}).eq('id',byFp.id);
    return true;
  }
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

export function isOnline(d){
  if(!d.last_seen) return false;
  return (Date.now()-new Date(d.last_seen)) < 120_000;
}

// ════════════════════════════════════════════════════
// PANEL INFO APPAREIL (admin)
// ════════════════════════════════════════════════════
export function openDeviceInfo(deviceId){
  const d = state.devices.find(x=>x.id===deviceId);
  if(!d) return;
  const online = isOnline(d);
  const isAgent = d.browser === 'Creo Agent';

  let modal = document.getElementById('modal-device-info');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'modal-device-info';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:9999;';
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if(e.target===modal) modal.style.display='none'; });
  }

  modal.innerHTML = `
    <div style="background:var(--d2);border:1px solid var(--b2);border-radius:var(--r-2xl);padding:1.6rem 1.8rem;min-width:340px;max-width:500px;width:92%;box-shadow:0 24px 60px rgba(0,0,0,.5);max-height:90vh;overflow-y:auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.4rem;">
        <div style="display:flex;align-items:center;gap:.8rem;">
          <span style="font-size:2rem;">${d.icon||'🖥️'}</span>
          <div>
            <div style="font-size:1rem;font-weight:600;color:var(--t1);" id="di-name-display">${d.name}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--blue2);">${d.client_code||'—'}</div>
          </div>
        </div>
        <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:99px;font-size:.65rem;font-family:'JetBrains Mono',monospace;
          background:${online?'rgba(0,255,136,.1)':'var(--d5)'};color:${online?'var(--green)':'var(--t3)'};border:1px solid ${online?'rgba(0,255,136,.25)':'var(--b2)'};">
          <span style="width:6px;height:6px;border-radius:50%;background:currentColor;${online?'box-shadow:0 0 6px currentColor;':''}"></span>
          ${online?'EN LIGNE':'HORS LIGNE'}
        </span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem .8rem;margin-bottom:1.2rem;">
        ${_infoRow('Système',d.os||'—')}
        ${_infoRow('Navigateur / Type',d.browser||'—')}
        ${_infoRow('Résolution',d.screen||'—')}
        ${_infoRow('Dernière activité',d.last_seen?new Date(d.last_seen).toLocaleString('fr-FR'):'—')}
        ${_infoRow('ID appareil',d.id.slice(0,8)+'…')}
        ${_infoRow('Propriétaire',d.user_id?d.user_id.slice(0,8)+'…':'Agent partagé')}
        ${d.creo_version?_infoRow('Version agent',d.creo_version):''}
        ${d.outdated?'<div style="grid-column:1/-1;background:rgba(255,184,0,.08);border:1px solid rgba(255,184,0,.22);border-radius:var(--r);padding:.5rem .8rem;font-size:.75rem;color:var(--amber);">⚠ Version obsolète — mise à jour disponible</div>':''}
      </div>

      <div style="margin-bottom:1rem;">
        <div style="font-size:.7rem;color:var(--t3);margin-bottom:.4rem;font-family:'JetBrains Mono',monospace;">RENOMMER</div>
        <div style="display:flex;gap:.5rem;">
          <input id="di-rename-input" type="text" value="${d.name}" placeholder="Nouveau nom…"
            style="flex:1;background:var(--d3);border:1px solid var(--b2);border-radius:var(--r-lg);padding:.45rem .8rem;color:var(--t1);font-size:.85rem;outline:none;"
            onfocus="this.style.borderColor='var(--blue)'" onblur="this.style.borderColor='var(--b2)'">
          <button onclick="window.creo._renameFromInfo('${d.id}')"
            style="padding:.45rem 1rem;background:var(--blue);color:#fff;border:none;border-radius:var(--r-lg);font-size:.82rem;cursor:pointer;">
            ✓
          </button>
        </div>
      </div>

      ${isAgent && d.client_code ? `
      <div style="margin-bottom:1rem;">
        <div style="font-size:.7rem;color:var(--t3);margin-bottom:.4rem;font-family:'JetBrains Mono',monospace;">DOSSIER DE TÉLÉCHARGEMENT</div>
        <div id="di-path-display" style="font-family:'JetBrains Mono',monospace;font-size:.65rem;color:var(--t2);background:var(--d3);border-radius:var(--r);padding:.5rem .8rem;margin-bottom:.4rem;min-height:1.4rem;">
          Dossier par défaut : Downloads\\Creo
        </div>
        <button onclick="window.creo._openExplorer('${d.id}')"
          style="width:100%;padding:.5rem 1rem;background:rgba(26,111,255,.08);border:1px solid rgba(26,111,255,.2);border-radius:var(--r-lg);color:var(--blue2);font-size:.8rem;cursor:pointer;text-align:left;">
          📁 Parcourir et choisir le dossier…
        </button>
      </div>` : ''}

      <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:.8rem;">
        <button onclick="window.creo.removeDevice('${d.id}');document.getElementById('modal-device-info').style.display='none';"
          style="padding:.4rem .9rem;background:rgba(255,59,92,.08);border:1px solid rgba(255,59,92,.2);border-radius:var(--r-lg);color:var(--red);font-size:.78rem;cursor:pointer;">
          ✕ Supprimer
        </button>
        <button onclick="document.getElementById('modal-device-info').style.display='none';"
          style="padding:.4rem 1.2rem;background:var(--d4);border:1px solid var(--b2);border-radius:var(--r-lg);color:var(--t2);font-size:.78rem;cursor:pointer;">
          Fermer
        </button>
      </div>
    </div>`;

  modal.style.display='flex';
}

function _infoRow(label,val){
  return `<div style="background:var(--d3);border-radius:var(--r);padding:.5rem .7rem;">
    <div style="font-family:'JetBrains Mono',monospace;font-size:.55rem;color:var(--t3);margin-bottom:2px;">${label.toUpperCase()}</div>
    <div style="font-size:.78rem;color:var(--t1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${val}">${val}</div>
  </div>`;
}

// ════════════════════════════════════════════════════
// EXPLORATEUR DE DOSSIERS DISTANT (admin seulement)
// ════════════════════════════════════════════════════
export async function openExplorer(deviceId){
  window._creoExplorer = { deviceId, path: null };

  let modal = document.getElementById('modal-explorer');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'modal-explorer';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:10000;';
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if(e.target===modal) modal.style.display='none'; });
  }

  _renderExplorerShell(modal);
  modal.style.display='flex';
  await _explorerNav(deviceId, null);
}

function _renderExplorerShell(modal){
  modal.innerHTML = `
    <div style="background:var(--d2);border:1px solid var(--b2);border-radius:var(--r-2xl);padding:1.4rem;width:min(540px,94vw);box-shadow:0 24px 60px rgba(0,0,0,.5);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
        <div style="font-size:.9rem;font-weight:600;color:var(--t1);">📁 Choisir le dossier de destination</div>
        <button onclick="document.getElementById('modal-explorer').style.display='none'"
          style="background:none;border:none;color:var(--t3);font-size:1.2rem;cursor:pointer;line-height:1;">✕</button>
      </div>
      <div id="exp-breadcrumb" style="font-family:'JetBrains Mono',monospace;font-size:.65rem;color:var(--t3);background:var(--d3);border-radius:var(--r);padding:.5rem .8rem;margin-bottom:.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
        Chargement…
      </div>
      <div id="exp-drives" style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.6rem;"></div>
      <div id="exp-list" style="max-height:280px;overflow-y:auto;border:1px solid var(--b2);border-radius:var(--r-lg);background:var(--d3);">
        <div style="padding:2rem;text-align:center;font-size:.78rem;color:var(--t3);">⟳ Connexion à l'agent…</div>
      </div>
      <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:1rem;">
        <button onclick="document.getElementById('modal-explorer').style.display='none'"
          style="padding:.45rem 1rem;background:var(--d4);border:1px solid var(--b2);border-radius:var(--r-lg);color:var(--t2);font-size:.8rem;cursor:pointer;">
          Annuler
        </button>
        <button id="exp-confirm" disabled
          style="padding:.45rem 1.2rem;background:var(--blue);border:none;border-radius:var(--r-lg);color:#fff;font-size:.8rem;cursor:pointer;opacity:.4;"
          onclick="window.creo._explorerConfirm()">
          ✓ Choisir ce dossier
        </button>
      </div>
    </div>`;
}

async function _explorerNav(deviceId, folderPath){
  const breadcrumb = document.getElementById('exp-breadcrumb');
  const list = document.getElementById('exp-list');
  if(breadcrumb) breadcrumb.textContent = folderPath || 'Racine — sélectionne un lecteur';
  if(list) list.innerHTML = `<div style="padding:1.5rem;text-align:center;font-size:.78rem;color:var(--t3);">⟳ Chargement…</div>`;

  const btn = document.getElementById('exp-confirm');
  if(btn){ btn.disabled=true; btn.style.opacity='.4'; }

  // Envoyer commande browse
  const{data:cmd} = await supabase.from('agent_commands').insert({
    device_id: deviceId,
    type: 'browse',
    payload: { path: folderPath },
    status: 'pending',
  }).select().single().catch(()=>({data:null}));

  if(!cmd){ if(list) list.innerHTML=`<div style="padding:1.5rem;text-align:center;font-size:.78rem;color:var(--red);">✗ Impossible d'envoyer la commande</div>`; return; }

  // Attendre la réponse (max 15s, polling 500ms)
  let attempts=0;
  const poll = setInterval(async()=>{
    attempts++;
    const{data:res} = await supabase.from('agent_commands').select('status,result').eq('id',cmd.id).single().catch(()=>({data:null}));
    if(res?.status==='done'){
      clearInterval(poll);
      try{
        const r = JSON.parse(res.result||'{}');
        window._creoExplorer.path = r.current;
        _renderExplorerContent(r);
      } catch { if(list) list.innerHTML=`<div style="padding:1.5rem;text-align:center;font-size:.78rem;color:var(--red);">✗ Réponse invalide</div>`; }
    } else if(attempts>30){
      clearInterval(poll);
      if(list) list.innerHTML=`<div style="padding:1.5rem;text-align:center;font-size:.78rem;color:var(--red);">✗ Timeout — l'agent ne répond pas. Est-il en ligne ?</div>`;
    }
  }, 500);

  // Exposer pour les boutons onclick inline
  window._creoExplorerNav = (p) => _explorerNav(deviceId, p);
}

function _renderExplorerContent(r){
  const drives  = r.drives  || [];
  const folders = r.folders || [];
  const current = r.current || null;
  const parent  = r.parent  || null;

  const breadcrumb = document.getElementById('exp-breadcrumb');
  const driveEl    = document.getElementById('exp-drives');
  const list       = document.getElementById('exp-list');
  const btn        = document.getElementById('exp-confirm');

  if(breadcrumb) breadcrumb.textContent = current || 'Sélectionne un lecteur';

  if(driveEl){
    driveEl.innerHTML = drives.map(dr=>`
      <button onclick="window._creoExplorerNav('${dr.replace(/\\/g,'\\\\')}')"
        style="padding:.32rem .65rem;background:var(--d4);border:1px solid var(--b2);border-radius:var(--r);color:var(--t1);font-family:'JetBrains Mono',monospace;font-size:.7rem;cursor:pointer;"
        onmouseenter="this.style.background='var(--d5)'" onmouseleave="this.style.background='var(--d4)'">
        💾 ${dr}
      </button>`).join('');
  }

  if(list){
    let html = '';
    if(parent !== null){
      html += `<div onclick="window._creoExplorerNav('${parent.replace(/\\/g,'\\\\')}')"
        style="display:flex;align-items:center;gap:.6rem;padding:.6rem .8rem;cursor:pointer;border-bottom:1px solid var(--b1);transition:background .15s;"
        onmouseenter="this.style.background='var(--d4)'" onmouseleave="this.style.background=''">
        <span style="color:var(--t3);">📂</span>
        <span style="font-size:.82rem;color:var(--t2);">.. (dossier parent)</span>
      </div>`;
    }
    html += folders.length
      ? folders.map(f=>`
        <div onclick="window._creoExplorerNav('${f.path.replace(/\\/g,'\\\\')}')"
          style="display:flex;align-items:center;gap:.6rem;padding:.55rem .8rem;cursor:pointer;border-bottom:1px solid var(--b1);transition:background .15s;"
          onmouseenter="this.style.background='var(--d4)'" onmouseleave="this.style.background=''">
          <span style="color:var(--amber);">📁</span>
          <span style="font-size:.82rem;color:var(--t1);">${f.name}</span>
        </div>`).join('')
      : `<div style="padding:1.5rem;text-align:center;font-size:.78rem;color:var(--t3);">Aucun sous-dossier</div>`;
    list.innerHTML = html;
  }

  if(btn && current){
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

export async function explorerConfirm(){
  const exp = window._creoExplorer;
  if(!exp?.path || !exp?.deviceId) return;

  const{data:cmd} = await supabase.from('agent_commands').insert({
    device_id: exp.deviceId,
    type: 'set_download_path',
    payload: { path: exp.path },
    status: 'pending',
  }).select().single().catch(()=>({data:null}));

  document.getElementById('modal-explorer').style.display='none';

  const pathEl = document.getElementById('di-path-display');
  if(pathEl) pathEl.textContent = exp.path;
  uiToast('success', `✓ Dossier défini : ${exp.path}`);
}

// ════════════════════════════════════════════════════
// RENDER APPAREILS
// ════════════════════════════════════════════════════
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
        <button class="btn btn-ghost btn-sm" onclick="window.creo.openDeviceInfo('${d.id}')" title="Infos">ℹ</button>
        <button class="btn btn-danger btn-xs" onclick="window.creo.removeDevice('${d.id}')">✕</button>
      </div>
    </div>`;
  }).join('');
  grid.innerHTML=html;
}

export function updateDeviceSelect(){
  const sel=document.getElementById('mt-dest');if(!sel)return;
  const cur=sel.value;
  sel.innerHTML=`<option value="__public__">🌐 Lien public (code + lien + QR)</option>`;
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
