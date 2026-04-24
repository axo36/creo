/* recuperer.js */
import { supabase } from './supabase.js';
import { state } from './state.js';
import { getFileSVG, formatBytes, timeAgo, uiToast, realDownload } from './utils.js';

/* ── Par code ── */
export async function redeemCode(){
  const code=(document.getElementById('code-input')?.value||'').trim().toUpperCase();
  if(code.length<4){uiToast('warning','Code de 6 caractères requis.');return;}
  const btn=document.getElementById('btn-redeem-code');btn?.classList.add('btn-loading');
  const{data,error}=await supabase.from('files').select('*').eq('share_code',code).maybeSingle();
  btn?.classList.remove('btn-loading');
  if(error||!data){
    const el=document.getElementById('code-result');
    if(el)el.innerHTML=`<div class="result-err">❌ Code <strong>${code}</strong> introuvable.</div>`;
    return;
  }
  // Sécurité : vérifier que le fichier est public ou appartient à l'utilisateur
  if(data.user_id !== state.session.user.id && !data.public_url && !data.share_code){
    uiToast('error','Accès refusé à ce fichier.');return;
  }
  _showCodeResult(data,null,code);
}
function _showCodeResult(data,error,code){
  const el=document.getElementById('code-result');if(!el)return;
  if(error||!data){el.innerHTML=`<div class="result-err">❌ Code <strong>${code}</strong> introuvable. Vérifie et réessaie.</div>`;return;}
  el.innerHTML=_fileCard(data);
}

/* ── Par lien ── */
export async function redeemLink(){
  const url=(document.getElementById('link-input')?.value||'').trim();
  if(!url.startsWith('http')){uiToast('warning','Entre une URL valide.');return;}
  const el=document.getElementById('link-result');if(!el)return;
  // Cherche d'abord dans nos fichiers
  const{data}=await supabase.from('files').select('*').eq('public_url',url).maybeSingle();
  if(data){el.innerHTML=_fileCard(data);return;}
  // Lien externe — téléchargement direct
  el.innerHTML=`<div style="background:var(--d3);border:1px solid var(--b2);border-radius:var(--r-xl);padding:1.2rem;">
    <div style="font-size:.85rem;color:var(--t1);margin-bottom:.8rem;">Lien externe détecté</div>
    <button class="btn btn-primary btn-sm" onclick="window.creo.realDownload('${url}','fichier')">⬇ Télécharger</button>
  </div>`;
}

function _fileCard(f){
  return`<div style="background:var(--d3);border:1px solid rgba(0,255,136,.2);border-radius:var(--r-xl);padding:1.2rem;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:.9rem;">
      <span style="color:var(--t2);display:flex;">${getFileSVG(f.name)}</span>
      <div>
        <div style="font-size:.9rem;font-weight:500;color:var(--t1);">${f.name}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:.65rem;color:var(--t3);">${f.size_label||formatBytes(f.size_bytes)} · ${(f.type||'other').toUpperCase()}</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-primary btn-sm" onclick="window.creo.download('${f.public_url}','${encodeURIComponent(f.name)}')">⬇ Télécharger</button>
    </div>
  </div>`;
}

/* ── Envoyer à un user ── */
export async function sendToUser(){
  const selEl=document.getElementById('send-file-sel');
  const usernameEl=document.getElementById('send-username');
  const fileId=selEl?.value;
  const username=(usernameEl?.value||'').trim().replace(/^@/,'');
  if(!fileId){uiToast('warning','Choisis un fichier à envoyer.');return;}
  if(!username){uiToast('warning','Entre un pseudo @utilisateur.');return;}
  // Recherche par username exact (insensible casse), puis par email en fallback
  let target = null;
  const{data:byUser}=await supabase.from('profiles')
    .select('id,username,first_name,last_name')
    .ilike('username', username)
    .maybeSingle();
  if(byUser){ target=byUser; }
  else{
    const{data:byEmail}=await supabase.from('profiles')
      .select('id,username,first_name,last_name')
      .ilike('email', username)
      .maybeSingle();
    target=byEmail||null;
  }
  if(!target){uiToast('error',`Utilisateur "${username}" introuvable. Entre le pseudo exact, sans @.`);return;}
  const f=state.files.find(x=>x.id===fileId);
  if(!f){uiToast('error','Fichier introuvable.');return;}
  const btn=document.getElementById('btn-send-to-user');btn?.classList.add('btn-loading');
  const{error}=await supabase.from('shared_files').insert({
    from_user_id:state.session.user.id,to_user_id:target.id,
    file_id:f.id,file_name:f.name,file_url:f.public_url,file_size:f.size_bytes,status:'pending',
  });
  btn?.classList.remove('btn-loading');
  if(error){uiToast('error',error.message);return;}
  const name=target.first_name?`${target.first_name} ${target.last_name||''}`.trim():`@${target.username}`;
  uiToast('success',`✓ ${f.name} envoyé à ${name}`);
  if(usernameEl)usernameEl.value='';
}

/* ── Accepter / Refuser ── */
export async function acceptShared(id){
  const item=state.sharedFiles.find(x=>x.id===id);if(!item)return;
  await realDownload(item.file_url,item.file_name);
  await supabase.from('shared_files').update({status:'accepted',accepted_at:new Date().toISOString()}).eq('id',id);
  item.status='accepted';renderSharedFiles();
  uiToast('success',`✓ ${item.file_name} téléchargé`);
}
export async function refuseShared(id){
  if(!confirm('Refuser ce fichier ?'))return;
  await supabase.from('shared_files').update({status:'refused'}).eq('id',id);
  state.sharedFiles=state.sharedFiles.filter(x=>x.id!==id);
  renderSharedFiles();uiToast('info','Fichier refusé');
}

/* ── Render ── */
export function renderSharedFiles(){
  const el=document.getElementById('shared-list');if(!el)return;
  const items=state.sharedFiles.filter(f=>f.status!=='refused');
  const pending=items.filter(f=>f.status==='pending').length;
  // Badge sur nav
  const badge=document.getElementById('recup-badge');
  if(badge){badge.textContent=pending||'';badge.style.display=pending?'inline-flex':'none';}
  if(!items.length){el.innerHTML=`<div style="padding:1.5rem;text-align:center;font-family:'JetBrains Mono',monospace;font-size:.75rem;color:var(--t3);">Aucun fichier reçu.</div>`;return;}
  el.innerHTML=items.map(f=>{
    const sender=f.sender?.first_name?`${f.sender.first_name} ${f.sender.last_name||''}`.trim():`@${f.sender?.username||'?'}`;
    const isPending=f.status==='pending';
    return`<div style="display:flex;align-items:center;gap:10px;padding:.8rem;background:var(--d3);border:1px solid ${isPending?'rgba(26,111,255,.2)':'var(--b1)'};border-radius:var(--r-lg);margin-bottom:.5rem;">
      <span style="color:var(--t2);display:flex;">${getFileSVG(f.file_name||'')}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:.84rem;color:var(--t1);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.file_name||'Fichier'}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--t3);">De ${sender} · ${formatBytes(f.file_size||0)} · ${timeAgo(f.created_at)}</div>
      </div>
      ${isPending?`<button class="btn btn-primary btn-xs" onclick="window.creo.acceptShared('${f.id}')">✓ Accepter</button><button class="btn btn-ghost btn-xs" onclick="window.creo.refuseShared('${f.id}')">✕</button>`:`<span class="status st-done">✓ Accepté</span>`}
    </div>`;
  }).join('');
}

export function renderRecuperPage(){
  renderSharedFiles();
  // Remplir le select des fichiers à envoyer
  const sel=document.getElementById('send-file-sel');
  if(sel){sel.innerHTML=`<option value="">— Choisir un fichier uploadé —</option>`+state.files.filter(f=>f.public_url).map(f=>`<option value="${f.id}">${f.name} (${f.size_label||formatBytes(f.size_bytes)})</option>`).join('');}
  // Fichiers Express reçus sur cet appareil
  const tbody=document.getElementById('express-tbody');
  if(tbody){
    const myFiles=state.files.filter(f=>f.target_device_id===state.currentDeviceId);
    tbody.innerHTML=myFiles.length?myFiles.map(f=>`<tr>
      <td><div class="td-name"><span style="color:var(--t3);display:flex;">${getFileSVG(f.name)}</span><div><div class="td-fname">${f.name}</div><div class="td-fmeta">${f.size_label||formatBytes(f.size_bytes)}</div></div></div></td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--amber);">${f.share_code||'—'}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.66rem;color:var(--t3);">${timeAgo(f.created_at)}</td>
      <td>${f.public_url?`<button class="btn btn-primary btn-xs" onclick="window.creo.download('${f.public_url}','${encodeURIComponent(f.name)}')">⬇ Télécharger</button>`:''}</td>
    </tr>`).join(''):
    `<tr><td colspan="4" class="table-empty">${state.currentDeviceId?'Aucun fichier reçu sur cet appareil.':'Enregistre cet appareil pour voir les fichiers reçus.'}</td></tr>`;
  }
}
