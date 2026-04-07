/* ══════════════════════════════════════════
   CREO — MAIN JAVASCRIPT
   Utilisé par toutes les pages
   Requiert : @supabase/supabase-js@2
══════════════════════════════════════════ */

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/* ── SUPABASE ── */
const supabase = createClient(
  "https://mpnfvrizbluhhjcfzztc.supabase.co",
  "sb_publishable_PMOkki7SEbuv11glUpmNTQ_7KTnMrEr"
);

const REDIRECT = window.location.href.split('?')[0].replace(/#.*$/, '');

/* ════════════════════════════════════════════
   PAGE ROUTING
════════════════════════════════════════════ */
window.showPage = function(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page-' + id);
  if (page) {
    page.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Re-trigger reveals on new page
    setTimeout(() => {
      page.querySelectorAll('.reveal:not(.visible)').forEach(el => {
        revealObs.observe(el);
      });
    }, 50);
  }
  // Update nav active state
  const navMap = {
    home: 'nav-home',
    'features-page': 'nav-features',
    'pricing-page': 'nav-pricing',
    about: 'nav-about',
    contact: 'nav-contact',
    'download-page': null
  };
  document.querySelectorAll('.nav-pill a').forEach(a => a.classList.remove('active'));
  const navId = navMap[id];
  if (navId) document.getElementById(navId)?.classList.add('active');
};

/* ════════════════════════════════════════════
   TOAST NOTIFICATIONS
════════════════════════════════════════════ */
window.showToast = function(msg, type = 'info') {
  const wrap = document.getElementById('toast-wrap');
  const colors = { info: '#1a6fff', success: '#00ff88', error: '#ff3b5c', warning: '#ffb800' };
  const textc  = { success: '#000', warning: '#000' };
  const icons  = { info: 'ℹ', success: '✓', error: '✕', warning: '⚠' };
  const c = colors[type] || colors.info;
  const t = document.createElement('div');
  t.className = 'toast';
  t.style.cssText = `background:${c}14;border:1px solid ${c}55;color:${textc[type] || '#e2e2e2'};`;
  t.innerHTML = `<span style="color:${c};font-size:1rem;">${icons[type]}</span> ${msg}`;
  wrap.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'toastOut .3s ease forwards';
    setTimeout(() => t.remove(), 300);
  }, 4000);
};

/* ════════════════════════════════════════════
   MODAL AUTH
════════════════════════════════════════════ */
window.openModal = function() {
  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
};

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

window.resetModal = function() {
  document.getElementById('confirm-box').style.display = 'none';
  document.getElementById('panel-reset').classList.remove('open');
  document.querySelector('.modal-tabs').style.display = '';
  document.querySelector('.modal-footer-txt').style.display = '';
  document.querySelectorAll('.form-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-login').classList.add('active');
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('[data-panel="panel-login"]').classList.add('active');
};

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// Modal Tabs
document.querySelectorAll('.modal-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.form-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.panel).classList.add('active');
    document.getElementById('panel-reset').classList.remove('open');
    document.querySelector('.modal-tabs').style.display = '';
  });
});

// Forgot password
document.getElementById('forgot-btn').addEventListener('click', () => {
  document.querySelector('.modal-tabs').style.display = 'none';
  document.querySelectorAll('.form-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-reset').classList.add('open');
});
document.getElementById('back-reset').addEventListener('click', () => {
  document.getElementById('panel-reset').classList.remove('open');
  document.querySelector('.modal-tabs').style.display = '';
  document.querySelector('[data-panel="panel-login"]').click();
});

/* ── LOADING HELPER ── */
function setLoading(btn, on) {
  if (on) {
    btn.classList.add('btn-loading');
    btn.querySelector('.btn-spinner').style.display = 'inline-block';
    btn.querySelector('.btn-label').style.display = 'none';
  } else {
    btn.classList.remove('btn-loading');
    btn.querySelector('.btn-spinner').style.display = 'none';
    btn.querySelector('.btn-label').style.display = '';
  }
}

/* ── LOGIN ── */
document.getElementById('loginBtn').addEventListener('click', async () => {
  const btn   = document.getElementById('loginBtn');
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  if (!email || !pass) { showToast('Remplissez tous les champs.', 'warning'); return; }
  setLoading(btn, true);
  const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
  setLoading(btn, false);
  if (error) {
    const m = error.message;
    if (m.includes('Invalid login credentials')) showToast('Email ou mot de passe incorrect.', 'error');
    else if (m.includes('Email not confirmed'))  showToast('Confirmez votre email avant de vous connecter.', 'warning');
    else showToast('Connexion impossible. Réessayez.', 'error');
    return;
  }
  showToast('Connexion réussie ! Bienvenue sur Creo.', 'success');
  closeModal();
});
document.getElementById('login-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('loginBtn').click();
});

/* ── SIGNUP ── */
document.getElementById('signupBtn').addEventListener('click', async () => {
  const btn   = document.getElementById('signupBtn');
  const first = document.getElementById('signup-firstname').value.trim();
  const last  = document.getElementById('signup-lastname').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const pass  = document.getElementById('signup-password').value;
  if (!email || !pass) { showToast('Remplissez les champs obligatoires.', 'warning'); return; }
  if (pass.length < 8) { showToast('Mot de passe trop court (8 min).', 'warning'); return; }
  setLoading(btn, true);
  const fullName = [first, last].filter(Boolean).join(' ') || email.split('@')[0];
  const { data, error } = await supabase.auth.signUp({
    email, password: pass,
    options: { data: { full_name: fullName }, emailRedirectTo: REDIRECT }
  });
  setLoading(btn, false);
  if (error) { showToast(error.message, 'error'); return; }
  if (!data.session) {
    document.querySelector('.modal-tabs').style.display = 'none';
    document.querySelectorAll('.form-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-reset').classList.remove('open');
    document.querySelector('.modal-footer-txt').style.display = 'none';
    document.getElementById('confirm-box').style.display = 'block';
  } else {
    showToast('Compte créé ! Bienvenue sur Creo.', 'success');
    closeModal();
  }
});

/* ── RESET PASSWORD ── */
document.getElementById('resetBtn').addEventListener('click', async () => {
  const btn   = document.getElementById('resetBtn');
  const email = document.getElementById('reset-email').value.trim();
  if (!email) { showToast('Entrez votre email.', 'warning'); return; }
  setLoading(btn, true);
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: REDIRECT });
  setLoading(btn, false);
  if (error) { showToast(error.message, 'error'); return; }
  showToast('Email envoyé ! Vérifiez votre boîte.', 'success');
  document.getElementById('back-reset').click();
});

/* ── OAUTH ── */
async function oauth(provider) {
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: REDIRECT } });
  if (error) showToast(error.message, 'error');
}
document.getElementById('googleBtn').addEventListener('click',       () => oauth('google'));
document.getElementById('githubBtn').addEventListener('click',       () => oauth('github'));
document.getElementById('googleSignupBtn').addEventListener('click', () => oauth('google'));
document.getElementById('githubSignupBtn').addEventListener('click', () => oauth('github'));

/* ════════════════════════════════════════════
   NAV SCROLL GLASS
════════════════════════════════════════════ */
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.style.background = scrollY > 50 ? 'rgba(0,0,0,.95)' : 'rgba(0,0,0,.6)';
}, { passive: true });

/* ════════════════════════════════════════════
   SCROLL REVEAL
════════════════════════════════════════════ */
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('visible'); revealObs.unobserve(e.target); }
  });
}, { threshold: .07 });
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

/* ════════════════════════════════════════════
   COUNT-UP ANIMATION
════════════════════════════════════════════ */
function countUp(el, to, dec, suf, dur = 1400) {
  let t0;
  const step = ts => {
    if (!t0) t0 = ts;
    const p = Math.min((ts - t0) / dur, 1), ease = 1 - Math.pow(1 - p, 3);
    el.textContent = (to * ease).toFixed(dec) + suf;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
const cObs = new IntersectionObserver(e => {
  if (!e[0].isIntersecting) return; cObs.disconnect();
  document.querySelectorAll('[data-count]').forEach(el => {
    countUp(el, parseFloat(el.dataset.count), el.dataset.dec || 0, el.dataset.suf || '');
  });
}, { threshold: .4 });
const hs = document.querySelector('.hero-stats');
if (hs) cObs.observe(hs);

/* ════════════════════════════════════════════
   DEMO ANIMATION
════════════════════════════════════════════ */
const sRows  = [...document.querySelectorAll('.device-pane.source .file-row')];
const tRows  = [...document.querySelectorAll('.device-pane.target .file-row')];
const fills  = [...document.querySelectorAll('.device-pane.source .prog-fill')];
const speedEl = document.querySelector('.pipe-speed');
const spds    = ['1.8', '2.1', '0.9', '2.4'];

function resetDemo() {
  sRows.forEach(r  => { r.classList.remove('active', 'done'); });
  tRows.forEach(r  => { r.classList.remove('active', 'done'); r.classList.add('queued'); });
  fills.forEach(f  => { f.style.transition = 'none'; f.style.width = '0%'; });
}

function runFile(i) {
  if (i >= sRows.length) {
    setTimeout(() => { resetDemo(); setTimeout(() => runFile(0), 600); }, 2200);
    return;
  }
  if (i > 0) {
    sRows[i - 1].classList.remove('active'); sRows[i - 1].classList.add('done');
    tRows[i - 1].classList.remove('active'); tRows[i - 1].classList.add('done');
  }
  sRows[i].classList.add('active');
  tRows[i].classList.remove('queued'); tRows[i].classList.add('active');
  if (speedEl) speedEl.innerHTML = spds[i % spds.length] + '<span class="pipe-unit">GB/s</span>';
  const f = fills[i];
  if (f) {
    f.style.transition = 'none'; f.style.width = '0%';
    requestAnimationFrame(() => {
      f.style.transition = 'width 2.8s cubic-bezier(.4,0,.2,1)';
      f.style.width = '100%';
    });
  }
  setTimeout(() => runFile(i + 1), 3100);
}

const demoSection = document.getElementById('demo');
let demoGo = false;
if (demoSection) {
  new IntersectionObserver(e => {
    if (e[0].isIntersecting && !demoGo) { demoGo = true; setTimeout(() => runFile(0), 800); }
  }, { threshold: .2 }).observe(demoSection);
}

/* ════════════════════════════════════════════
   FAQ ACCORDION
════════════════════════════════════════════ */
document.querySelectorAll('.faq-item').forEach(item => {
  item.addEventListener('click', () => {
    const was = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
    if (!was) item.classList.add('open');
  });
});

/* ════════════════════════════════════════════
   FEATURE CARD MOUSE GLOW
════════════════════════════════════════════ */
window.trackMouse = function(el, e) {
  const r = el.getBoundingClientRect();
  el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
  el.style.setProperty('--my', ((e.clientY - r.top)  / r.height * 100) + '%');
};

/* ════════════════════════════════════════════
   SIDEBAR LINKS (dashboard preview)
════════════════════════════════════════════ */
document.querySelectorAll('.sidebar-link').forEach(l => {
  l.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-link').forEach(x => x.classList.remove('active'));
    l.classList.add('active');
  });
});

/* ════════════════════════════════════════════
   MARQUEE CLONE (boucle infinie)
════════════════════════════════════════════ */
const track = document.querySelector('.marquee-track');
if (track) {
  const clone = track.cloneNode(true);
  track.parentElement.appendChild(clone);
}

/* ════════════════════════════════════════════
   CONTACT FORM SEND
════════════════════════════════════════════ */
window.sendContact = function() {
  const btn = document.getElementById('contact-send-btn');
  btn.classList.add('btn-loading');
  btn.querySelector('.btn-spinner').style.display = 'inline-block';
  btn.querySelector('.btn-label').style.display = 'none';
  setTimeout(() => {
    btn.classList.remove('btn-loading');
    btn.querySelector('.btn-spinner').style.display = 'none';
    btn.querySelector('.btn-label').style.display = '';
    showToast('Message envoyé ! Nous vous répondrons sous 48h.', 'success');
  }, 1800);
};
