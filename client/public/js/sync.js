/* ══ sync.js — page Sync ══ */
import { supabase } from './supabase.js';
import { state } from './state.js';
import { loadFiles } from './data.js';
import { uiToast, timeAgo } from './utils.js';

export function renderSyncPage() {
  const done  = state.files.filter(f => f.status === 'done').length;
  const errs  = state.files.filter(f => f.status === 'error').length;
  const total = done + errs;
  const pct   = total ? Math.round((done / total) * 100) : 100;

  document.getElementById('sync-pct').textContent = pct + '%';
  document.getElementById('sync-circle-prog').style.strokeDashoffset = 339.29 * (1 - pct / 100);
  document.getElementById('sync-synced').textContent   = done;
  document.getElementById('sync-pending').textContent  = Object.keys(state.activeUploads).length;
  document.getElementById('sync-conflicts').textContent = errs;
  document.getElementById('sync-last-update').textContent = 'Dernière MAJ ' + new Date().toTimeString().slice(0, 5);
  renderSyncLog();
  renderSyncRules();
}

export function renderSyncLog() {
  const c = document.getElementById('sync-log');
  if (!state.syncLog.length) {
    c.innerHTML = `<div style="padding:1.5rem;text-align:center;font-family:'JetBrains Mono',monospace;font-size:.72rem;color:var(--t3);">Journal vide</div>`;
    return;
  }
  c.innerHTML = state.syncLog.slice(0, 8).map(l => `
    <div class="feed-item">
      <div class="feed-dot" style="background:${l.color || 'var(--blue)'};"></div>
      <div style="flex:1;">
        <div class="feed-text">${l.text}</div>
        <div class="feed-time">${l.time || timeAgo(l.created_at)}</div>
      </div>
    </div>`).join('');
}

export function renderSyncRules() {
  const tbody = document.getElementById('sync-rules-tbody');
  if (!state.syncRules.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Aucune règle — cliquez "＋ Ajouter"</td></tr>`;
    return;
  }
  tbody.innerHTML = state.syncRules.map(r => `<tr>
    <td style="color:var(--t1);font-weight:500;">${r.name}</td>
    <td style="color:var(--t2);">${r.source || '—'}</td>
    <td style="color:var(--t2);">${r.dest || '—'}</td>
    <td class="font-mono" style="font-size:.7rem;color:var(--t3);">${r.freq || 'Manuel'}</td>
    <td><span class="status ${r.active ? 'st-done' : 'st-pause'}">${r.active ? '● Actif' : '⏸ Pausé'}</span></td>
    <td style="display:flex;gap:6px;">
      <button class="btn btn-ghost btn-xs" onclick="window.creo.toggleRule('${r.id}',${!r.active})">
        ${r.active ? 'Pause' : 'Activer'}
      </button>
      <button class="btn btn-danger btn-xs" onclick="window.creo.deleteRule('${r.id}')">✕</button>
    </td>
  </tr>`).join('');
}

export async function toggleRule(id, active) {
  await supabase.from('sync_rules').update({ active }).eq('id', id);
  const r = state.syncRules.find(x => x.id === id);
  if (r) r.active = active;
  renderSyncRules();
  uiToast('success', `Règle ${active ? 'activée' : 'pausée'}`);
}

export async function deleteRule(id) {
  if (!confirm('Supprimer cette règle ?')) return;
  await supabase.from('sync_rules').delete().eq('id', id);
  state.syncRules = state.syncRules.filter(r => r.id !== id);
  renderSyncRules();
  uiToast('info', 'Règle supprimée');
}

export async function launchSync() {
  const btn = document.getElementById('btn-launch-sync');
  btn.classList.add('btn-loading');
  btn.textContent = '↺ Vérif…';
  await loadFiles();
  setTimeout(() => {
    btn.classList.remove('btn-loading');
    btn.textContent = '▶ Lancer';
    renderSyncPage();
    uiToast('success', '✓ Sync vérifiée');
  }, 1800);
}

export async function addSyncRule(name, source, dest, freq) {
  const { data } = await supabase.from('sync_rules').insert({
    user_id: state.session.user.id,
    name, source: source || 'Cet appareil',
    dest: dest || 'Supabase Storage',
    freq: freq || 'Manuel', active: true,
  }).select().single();
  if (data) {
    state.syncRules.unshift(data);
    renderSyncRules();
    uiToast('success', `✓ Règle "${name}" créée`);
  }
}
