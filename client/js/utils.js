/* utils.js */
export const TYPE_MAP = {
  image:   ['jpg','jpeg','png','gif','webp','svg','bmp','heic','avif'],
  video:   ['mp4','mov','avi','mkv','webm','flv','m4v','wmv'],
  audio:   ['mp3','wav','flac','aac','ogg','m4a','opus','aiff'],
  doc:     ['pdf','doc','docx','txt','rtf','xls','xlsx','ppt','pptx','csv','md'],
  archive: ['zip','rar','tar','gz','7z','bz2'],
};
export const TYPE_ICONS  = { image:'🖼️',video:'🎬',audio:'🎵',doc:'📄',archive:'📦',other:'📁' };
export const TYPE_COLORS = { image:'var(--blue)',video:'var(--purple)',audio:'var(--cyan)',doc:'var(--green)',archive:'var(--amber)',other:'var(--t3)' };

// SVG icons (pas d'emoji dans l'UI)
export const FILE_SVG = {
  image:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="18" height="18"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>`,
  video:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="18" height="18"><path d="m15 10 4.553-2.277A1 1 0 0 1 21 8.68v6.64a1 1 0 0 1-1.447.901L15 14M3 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`,
  audio:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="18" height="18"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  doc:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="18" height="18"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  archive: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="18" height="18"><polyline points="21,8 21,21 3,21 3,8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
  other:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="18" height="18"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>`,
};
export const DEVICE_SVG = {
  desktop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="22" height="22"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  laptop:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="22" height="22"><path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9"/><path d="M2 16h20"/></svg>`,
  phone:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="22" height="22"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
  tablet:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="22" height="22"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
  nas:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="22" height="22"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`,
};

export function getFileSVG(name='') {
  const ext=(name.split('.').pop()||'').toLowerCase();
  for(const[t,exts]of Object.entries(TYPE_MAP))if(exts.includes(ext))return FILE_SVG[t];
  return FILE_SVG.other;
}
export function getFileType(name='',mime='') {
  const ext=(name.split('.').pop()||'').toLowerCase();
  for(const[t,exts]of Object.entries(TYPE_MAP))if(exts.includes(ext))return t;
  if(mime.startsWith('image/'))return'image';
  if(mime.startsWith('video/'))return'video';
  if(mime.startsWith('audio/'))return'audio';
  return'other';
}
export function formatBytes(b=0){
  if(b>=1e12)return(b/1e12).toFixed(2)+' TB';
  if(b>=1e9) return(b/1e9).toFixed(2)+' GB';
  if(b>=1e6) return(b/1e6).toFixed(1)+' MB';
  if(b>=1e3) return(b/1e3).toFixed(0)+' KB';
  return(b||0)+' B';
}
export function timeAgo(ts){
  if(!ts)return'—';
  const d=Math.floor((Date.now()-new Date(ts))/1000);
  if(d<60)return"À l'instant";
  if(d<3600)return`Il y a ${Math.floor(d/60)} min`;
  if(d<86400)return`Il y a ${Math.floor(d/3600)}h`;
  return`Il y a ${Math.floor(d/86400)}j`;
}
export function genCode(){return Math.random().toString(36).slice(2,8).toUpperCase();}

/* Empreinte navigateur → reconnexion même si localStorage vide */
export function getFingerprint(){
  const str=`${navigator.userAgent}|${screen.width}x${screen.height}|${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
  let h=0;for(let i=0;i<str.length;i++){h=Math.imul(31,h)+str.charCodeAt(i)|0;}
  return Math.abs(h).toString(36).toUpperCase();
}
export function detectDevice(){
  const ua=navigator.userAgent;
  let type='desktop',os='Inconnu';
  if(/iPhone/i.test(ua)){type='phone';os='iOS';}
  else if(/iPad/i.test(ua)){type='tablet';os='iPadOS';}
  else if(/Android.*Mobile/i.test(ua)){type='phone';os='Android';}
  else if(/Android/i.test(ua)){type='tablet';os='Android Tablet';}
  else if(/Mac/i.test(ua)){type='laptop';os='macOS';}
  else if(/Windows/i.test(ua)){type='desktop';os='Windows';}
  else if(/Linux/i.test(ua)){type='desktop';os='Linux';}
  let browser='Navigateur';
  if(/Chrome/i.test(ua)&&!/Edg/i.test(ua))browser='Chrome';
  else if(/Firefox/i.test(ua))browser='Firefox';
  else if(/Safari/i.test(ua)&&!/Chrome/i.test(ua))browser='Safari';
  else if(/Edg/i.test(ua))browser='Edge';
  return{type,os,browser,screen:`${screen.width}×${screen.height}`,fingerprint:getFingerprint()};
}

export function uiToast(type,msg){
  const wrap=document.getElementById('toast-wrap');if(!wrap)return;
  const el=document.createElement('div');
  el.className=`toast ${type}`;el.textContent=msg;
  wrap.appendChild(el);
  setTimeout(()=>{el.style.transition='opacity .3s';el.style.opacity='0';setTimeout(()=>el.remove(),300);},3500);
}
export function copyText(text){
  if(!text)return;
  navigator.clipboard.writeText(text).then(()=>uiToast('success','Copié !')).catch(()=>{
    const el=document.createElement('textarea');el.value=text;document.body.appendChild(el);el.select();document.execCommand('copy');document.body.removeChild(el);uiToast('success','Copié !');
  });
}
export function openModal(id){document.getElementById(id)?.classList.add('open');}
export function closeModal(id){document.getElementById(id)?.classList.remove('open');}

/* Télécharge vraiment dans le dossier Téléchargements */
export async function realDownload(url,filename){
  try{
    const r=await fetch(url);
    if(!r.ok)throw new Error();
    const blob=await r.blob();
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download=filename||'fichier';
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
  }catch{
    const a=document.createElement('a');a.href=url;a.download=filename||'fichier';a.target='_blank';
    document.body.appendChild(a);a.click();document.body.removeChild(a);
  }
}
