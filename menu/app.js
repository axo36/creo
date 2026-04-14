/* ══════════════════════════════════════════
   app.js — Creo · JS global
══════════════════════════════════════════ */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/* ── SUPABASE ──────────────────────────── */
export const supabase = createClient(
  "https://mpnfvrizbluhhjcfzztc.supabase.co",
  "sb_publishable_PMOkki7SEbuv11glUpmNTQ_7KTnMrEr"
);

function getBase() {
  const p = window.location.pathname;
  return window.location.origin + p.substring(0, p.lastIndexOf('/') + 1);
}

/* ── AUTH ──────────────────────────────── */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}
export async function requireAuth() {
  const s = await getSession();
  if (!s) { window.location.href = '../login/login.html'; return null; }
  return s;
}
export async function redirectIfAuth() {
  const s = await getSession();
  if (s) window.location.href = '../menu/index.html';
}
export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = '../login/login.html';
}
export function getDisplayName(s) {
  if (!s) return 'Invité';
  const m = s.user.user_metadata;
  return m?.full_name || m?.name || s.user.email?.split('@')[0] || 'Utilisateur';
}
export function getInitials(s) {
  return getDisplayName(s).split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
export function getAvatar(s) {
  return s?.user?.user_metadata?.avatar_url ?? null;
}

/* ── OAUTH ─────────────────────────────── */
export async function oauthLogin(provider) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: getBase() + 'oauth-callback.html' }
  });
  if (error) toast(error.message, 'error');
}

/* ── LOGIN (email ou pseudo) ───────────── */
export async function emailLogin(emailOrUsername, password) {
  let email = emailOrUsername.trim();

  if (!email.includes('@')) {
    const { data: p } = await supabase
      .from('profiles').select('email')
      .eq('username', email.toLowerCase()).single();
    if (!p) return 'Pseudo ou mot de passe incorrect.';
    email = p.email;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const m = error.message;
    if (m.includes('Invalid login credentials')) return 'Email/pseudo ou mot de passe incorrect.';
    if (m.includes('Email not confirmed'))       return 'Confirmez votre email avant de vous connecter.';
    return 'Connexion impossible. Réessayez.';
  }
  return null;
}

/* ── SIGNUP ────────────────────────────── */
export async function emailSignup(email, password, fullName) {
  const firstName = fullName.trim().split(' ')[0] || '';
  const lastName  = fullName.trim().split(' ').slice(1).join(' ') || '';

  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: {
      emailRedirectTo: getBase() + 'email-confirmed.html',
      data: { full_name: fullName, first_name: firstName, last_name: lastName }
    }
  });

  if (error) return { error: error.message };
  const user = data.user;
  if (!user) return { error: 'Erreur lors de la création du compte.' };

  await supabase.from('profiles').upsert({
    id: user.id, email,
    email_verified: false,
    first_name: firstName,
    last_name: lastName
  }, { onConflict: 'id' });

  return { needsConfirm: true, userId: user.id };
}

/* ── CODE TEMP 4 CHARS ─────────────────── */
export async function generateTempCode(userId) {
  await supabase.from('temp_codes').delete().eq('user_id', userId);
  let code, exists = true;
  while (exists) {
    code = Math.random().toString(36).substring(2, 6).toUpperCase();
    const { data } = await supabase.from('temp_codes').select('code').eq('code', code).maybeSingle();
    exists = !!data;
  }
  await supabase.from('temp_codes').insert({ code, user_id: userId });
  return code;
}

/* ── RESET PASSWORD ────────────────────── */
export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getBase() + 'reset-password.html'
  });
  return error ? error.message : null;
}

/* ── TOAST ─────────────────────────────── */
export function toast(msg, type = 'info') {
  let wrap = document.getElementById('toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  const c  = { info:'#1a6fff', success:'#00ff88', error:'#ff3b5c', warning:'#ffb800' }[type] || '#1a6fff';
  const tx = { success:'#000', warning:'#000' }[type] || '#e2e2e2';
  const ic = { info:'ℹ', success:'✓', error:'✕', warning:'⚠' }[type];
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.style.cssText = `background:${c}14;border:1px solid ${c}55;color:${tx};`;
  el.innerHTML = `<span style="color:${c};font-size:1rem;">${ic}</span> ${msg}`;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastOut .3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 4200);
}

/* ── LOADING BTN ───────────────────────── */
export function setLoading(btn, on) {
  const label = btn.querySelector('.btn-label');
  const spin  = btn.querySelector('.btn-spin');
  btn.classList.toggle('btn-loading', on);
  if (spin)  spin.style.display  = on ? 'inline-block' : 'none';
  if (label) label.style.display = on ? 'none' : '';
}

/* ── NAV ───────────────────────────────── */
export async function buildNav(activePage) {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const session = await getSession();
  const links = [
    { id:'index',    label:'Accueil',        href:'index.html' },
    { id:'features', label:'Fonctionnalités', href:'features.html' },
    { id:'pricing',  label:'Tarifs',          href:'pricing.html' },
    { id:'about',    label:'À propos',        href:'about.html' },
    { id:'contact',  label:'Contact',         href:'contact.html' },
    { id:'express',  label:'Express',         href:'express.html' },
  ];
  const pill = links.map(l =>
    `<a href="${l.href}"${activePage===l.id?' class="active"':''}>${l.label}</a>`
  ).join('');
  let right;
  if (session) {
    const av = getAvatar(session);
    right = `
      <span class="nav-user-name">${getDisplayName(session)}</span>
      <div class="nav-avatar" id="nav-av">
        ${av ? `<img src="${av}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : getInitials(session)}
      </div>`;
  } else {
    right = `
      <a href="../login/login.html" class="btn btn-ghost">Connexion</a>
      <a href="../login/login.html?tab=signup" class="btn btn-primary"><span class="glow-dot"></span> Commencer</a>`;
  }
  nav.innerHTML = `
    <a href="index.html" class="nav-logo">CR<span class="logo-e">E</span>O<div class="logo-dot"></div></a>
    <div class="nav-pill">${pill}</div>
    <div class="nav-actions">${right}</div>`;
  const avBtn = document.getElementById('nav-av');
  if (avBtn) {
    avBtn.addEventListener('click', e => {
      e.stopPropagation();
      const old = document.getElementById('nav-dropdown');
      if (old) { old.remove(); return; }
      const drop = document.createElement('div');
      drop.id = 'nav-dropdown';
      drop.className = 'nav-dropdown';
      drop.innerHTML = `
        <div class="nav-dropdown-head">
          <div class="nav-dropdown-name">${getDisplayName(session)}</div>
          <div class="nav-dropdown-email">${session.user.email}</div>
        </div>
        <a href="download.html">↓ Télécharger l'app</a>
        <button class="signout-btn" id="do-signout">⏻ Se déconnecter</button>`;
      document.body.appendChild(drop);
      document.getElementById('do-signout').addEventListener('click', signOut);
      setTimeout(() => document.addEventListener('click', function h(ev) {
        if (!drop.contains(ev.target)) { drop.remove(); document.removeEventListener('click', h); }
      }), 30);
    });
  }
  window.addEventListener('scroll', () => {
    nav.style.background = scrollY > 40 ? 'rgba(0,0,0,.95)' : 'rgba(0,0,0,.6)';
  }, { passive: true });
}

/* ── SCROLL REVEAL ─────────────────────── */
export function initReveal() {
  const io = new IntersectionObserver(entries =>
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
    }), { threshold: 0.07 }
  );
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
}

/* ── FAQ ───────────────────────────────── */
export function initFAQ() {
  document.querySelectorAll('.faq-item').forEach(item => {
    item.addEventListener('click', () => {
      const was = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!was) item.classList.add('open');
    });
  });
}

/* ── DEMO ANIMATION ────────────────────── */
export function initDemo() {
  const sRows  = [...document.querySelectorAll('.device-pane.source .file-row')];
  const tRows  = [...document.querySelectorAll('.device-pane.target .file-row')];
  const fills  = [...document.querySelectorAll('.device-pane.source .prog-fill')];
  const speedEl = document.querySelector('.pipe-speed');
  const spds   = ['1.8','2.1','0.9','2.4'];
  if (!sRows.length) return;
  function reset() {
    sRows.forEach(r => r.classList.remove('active','done'));
    tRows.forEach(r => { r.classList.remove('active','done'); r.classList.add('queued'); });
    fills.forEach(f => { f.style.transition='none'; f.style.width='0%'; });
  }
  function runFile(i) {
    if (i >= sRows.length) { setTimeout(() => { reset(); setTimeout(() => runFile(0),600); },2200); return; }
    if (i>0) { sRows[i-1].classList.replace('active','done'); tRows[i-1].classList.replace('active','done'); }
    sRows[i].classList.add('active');
    tRows[i].classList.remove('queued'); tRows[i].classList.add('active');
    if (speedEl) speedEl.innerHTML = spds[i%spds.length]+'<span class="pipe-unit">GB/s</span>';
    const f = fills[i];
    if (f) { f.style.transition='none'; f.style.width='0%'; requestAnimationFrame(() => { f.style.transition='width 2.8s cubic-bezier(.4,0,.2,1)'; f.style.width='100%'; }); }
    setTimeout(() => runFile(i+1), 3100);
  }
  const demo = document.getElementById('demo');
  let started = false;
  if (demo) {
    new IntersectionObserver(e => {
      if (e[0].isIntersecting && !started) { started=true; setTimeout(() => runFile(0),800); }
    }, { threshold:.2 }).observe(demo);
  } else { setTimeout(() => runFile(0),600); }
}

/* ── FEATURE CARD GLOW ─────────────────── */
export function initFeatureGlow() {
  document.querySelectorAll('.feat-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((e.clientX-r.left)/r.width*100)+'%');
      card.style.setProperty('--my', ((e.clientY-r.top)/r.height*100)+'%');
    });
  });
}

/* ── MARQUEE ───────────────────────────── */
export function initMarquee() {}

/* ── SIDEBAR ───────────────────────────── */
export function initSidebar() {
  document.querySelectorAll('.sidebar-link').forEach(l => {
    l.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-link').forEach(x => x.classList.remove('active'));
      l.classList.add('active');
    });
  });
}

/* ── COUNT-UP ──────────────────────────── */
export function initCountUp(selector = '.hero-stats') {
  const container = document.querySelector(selector);
  if (!container) return;
  function countUp(el, to, dec, suf, dur=1400) {
    let t0;
    const step = ts => {
      if (!t0) t0=ts;
      const p = Math.min((ts-t0)/dur,1), ease=1-Math.pow(1-p,3);
      el.textContent = (to*ease).toFixed(dec)+suf;
      if (p<1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  new IntersectionObserver(e => {
    if (!e[0].isIntersecting) return;
    document.querySelectorAll('[data-count]').forEach(el => {
      countUp(el, parseFloat(el.dataset.count), +el.dataset.dec||0, el.dataset.suf||'');
    });
  }, { threshold:.4 }).observe(container);
}

/* ── PAGE FADE ─────────────────────────── */
export function pageFade() {
  document.body.style.opacity = '0';
  document.body.style.transition = 'opacity .4s ease';
  window.addEventListener('load', () => { document.body.style.opacity='1'; });
}

/* ── DOWNLOAD ──────────────────────────── */
export function downloadApp(platform) {
  const links = {
    windows:'downloads/creo-win.exe', mac:'downloads/creo-mac.dmg',
    linux:'downloads/creo-linux.AppImage', android:'downloads/creo.apk'
  };
  const a = document.createElement('a');
  a.href = links[platform]; a.download = '';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
