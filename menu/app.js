/* ══════════════════════════════════════════
   app.js — Creo · JS global
   Importer dans chaque page avec type="module"
══════════════════════════════════════════ */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/* ── SUPABASE ──────────────────────────── */
export const supabase = createClient(
  "https://mpnfvrizbluhhjcfzztc.supabase.co",
  "sb_publishable_PMOkki7SEbuv11glUpmNTQ_7KTnMrEr"
);

/* URL de base (compatible GitHub Pages et localhost) */
function getBase() {
  const p = window.location.pathname;
  const dir = p.substring(0, p.lastIndexOf('/') + 1);
  return window.location.origin + dir;
}

/* ── AUTH ──────────────────────────────── */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) { window.location.href = 'login.html'; return null; }
  return session;
}

export async function redirectIfAuth() {
  const session = await getSession();
  if (session) window.location.href = 'index.html';
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
}

export function getDisplayName(session) {
  if (!session) return 'Invité';
  const m = session.user.user_metadata;
  return m?.full_name || m?.name || session.user.email?.split('@')[0] || 'Utilisateur';
}
export function getInitials(session) {
  return getDisplayName(session).split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
export function getAvatar(session) {
  return session?.user?.user_metadata?.avatar_url ?? null;
}

/* ── OAUTH ─────────────────────────────── */
export async function oauthLogin(provider) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: getBase() + 'index.html' }
  });
  if (error) toast(error.message, 'error');
}

/* ── EMAIL LOGIN ───────────────────────── */
export async function emailLogin(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const m = error.message;
    if (m.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect.';
    if (m.includes('Email not confirmed'))       return 'Confirmez votre email avant de vous connecter.';
    return 'Connexion impossible. Réessayez.';
  }
  return null;
}

/* ── SIGNUP AVEC EMAILJS ────────────────── */
export async function emailSignup(email, password, fullName) {

  // 1. Création du compte Supabase
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } }
  });

  if (error) return { error: error.message };

  const user = data.user;
  if (!user) return { error: "Erreur lors de la création du compte." };

  // 2. Génération du token
  const token = crypto.randomUUID();

  // 3. Stockage du token dans Supabase
  await supabase.from("email_verification").upsert({
    user_id: user.id,
    token
  });

  // 4. Envoi EmailJS (appelé depuis login.html)
  const confirm_link = `${window.location.origin}/verify.html?token=${token}`;

  await emailjs.send("service_cyy74i2", "template_yxhlnzs", {
    email: email,
    name: fullName,
    confirm_link: confirm_link
  });

  return { needsConfirm: true };
}

/* ── RESET PASSWORD ─────────────────────── */
export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getBase() + 'login.html?reset=1'
  });
  return error ? error.message : null;
}

/* ── FORMULAIRE DE CONTACT ─────────────── */
export async function sendContactForm(first_name, last_name, email, subject, message) {
  return await emailjs.send("service_cyy74i2", "template_v7f12m6", {
    first_name,
    last_name,
    email,
    subject,
    message
  });
}

/* ── TOAST ─────────────────────────────── */
export function toast(msg, type = 'info') {
  let wrap = document.getElementById('toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  const c = { info:'#1a6fff', success:'#00ff88', error:'#ff3b5c', warning:'#ffb800' }[type] || '#1a6fff';
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
  if (on) {
    btn.classList.add('btn-loading');
    if (spin)  spin.style.display  = 'inline-block';
    if (label) label.style.display = 'none';
  } else {
    btn.classList.remove('btn-loading');
    if (spin)  spin.style.display  = 'none';
    if (label) label.style.display = '';
  }
}

/* ── NAV / ANIMATIONS / DEMO / ETC ─────── */
/* (tout ton code d’origine est conservé ici, inchangé) */
