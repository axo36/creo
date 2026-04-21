/* ══ utils.js — utilitaires globaux ══ */

export const TYPE_MAP = {
  image:   ['jpg','jpeg','png','gif','webp','svg','bmp','heic','avif','tiff'],
  video:   ['mp4','mov','avi','mkv','webm','flv','m4v','wmv'],
  audio:   ['mp3','wav','flac','aac','ogg','m4a','opus','aiff'],
  doc:     ['pdf','doc','docx','txt','rtf','xls','xlsx','ppt','pptx','csv','md'],
  archive: ['zip','rar','tar','gz','7z','bz2'],
};
export const TYPE_ICONS = { image:'🖼️', video:'🎬', audio:'🎵', doc:'📄', archive:'📦', other:'📁' };
export const TYPE_COLORS = { image:'var(--blue)', video:'var(--purple)', audio:'var(--cyan)', doc:'var(--green)', archive:'var(--amber)', other:'var(--t3)' };

export function detectFileType(name = '', mime = '') {
  const ext = (name.split('.').pop() || '').toLowerCase();
  for (const [t, exts] of Object.entries(TYPE_MAP)) if (exts.includes(ext)) return t;
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'other';
}
export function fileIcon(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  for (const [t, exts] of Object.entries(TYPE_MAP)) if (exts.includes(ext)) return TYPE_ICONS[t];
  return '📁';
}
export function formatBytes(b = 0) {
  if (b >= 1e12) return (b / 1e12).toFixed(2) + ' TB';
  if (b >= 1e9)  return (b / 1e9).toFixed(2)  + ' GB';
  if (b >= 1e6)  return (b / 1e6).toFixed(1)  + ' MB';
  if (b >= 1e3)  return (b / 1e3).toFixed(0)  + ' KB';
  return (b || 0) + ' B';
}
export function timeAgo(ts) {
  if (!ts) return '—';
  const d = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (d < 60)    return "À l'instant";
  if (d < 3600)  return `Il y a ${Math.floor(d / 60)} min`;
  if (d < 86400) return `Il y a ${Math.floor(d / 3600)}h`;
  return `Il y a ${Math.floor(d / 86400)}j`;
}
export function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
export function detectDevice() {
  const ua = navigator.userAgent;
  let type = 'desktop', icon = '🖥️', os = 'Inconnu';
  if      (/iPhone/i.test(ua))               { type = 'phone';   icon = '📱'; os = 'iOS'; }
  else if (/iPad/i.test(ua))                 { type = 'tablet';  icon = '📟'; os = 'iPadOS'; }
  else if (/Android.*Mobile/i.test(ua))      { type = 'phone';   icon = '📱'; os = 'Android'; }
  else if (/Android/i.test(ua))              { type = 'tablet';  icon = '📟'; os = 'Android Tablet'; }
  else if (/Mac/i.test(ua))                  { type = 'laptop';  icon = '💻'; os = 'macOS'; }
  else if (/Windows/i.test(ua))              { type = 'desktop'; icon = '🖥️'; os = 'Windows'; }
  else if (/Linux/i.test(ua))               { type = 'desktop'; icon = '🖥️'; os = 'Linux'; }
  let browser = 'Navigateur';
  if      (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
  else if (/Firefox/i.test(ua))                     browser = 'Firefox';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Edg/i.test(ua))                        browser = 'Edge';
  return { type, icon, os, browser, screen: `${screen.width}×${screen.height}` };
}
export function uiToast(type, msg) {
  const wrap = document.getElementById('toast-wrap');
  if (!wrap) return;
  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || 'ℹ'}</span> ${msg}`;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastOut .28s ease forwards';
    setTimeout(() => el.remove(), 280);
  }, 3800);
}
export function copyText(text) {
  if (!text) return;
  navigator.clipboard.writeText(text)
    .then(() => uiToast('success', 'Copié !'))
    .catch(() => {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      uiToast('success', 'Copié !');
    });
}
export function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
export function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
