/* ══ analytics.js — page analytiques avec vraies données ══ */
import { state } from './state.js';
import { formatBytes, timeAgo, TYPE_ICONS, TYPE_COLORS } from './utils.js';

export function renderAnalyticsPage() {
  const done   = state.files.filter(f => f.status === 'done');
  const errs   = state.files.filter(f => f.status === 'error');
  const totalB = done.reduce((s, f) => s + (f.size_bytes || 0), 0);
  const fmtd   = formatBytes(totalB).split(' ');

  // KPI réels
  _setHTML('kpi-data',    `${fmtd[0]} <span style="font-size:1.1rem;color:var(--blue2);">${fmtd[1] || ''}</span>`);
  _set('kpi-success',     done.length);

  // Appareils en ligne (vus < 10 min)
  const onlineCount = state.devices.filter(d =>
    d.last_seen && (Date.now() - new Date(d.last_seen)) < 600000
  ).length;
  _setHTML('kpi-speed',   `${onlineCount} <span style="font-size:1.1rem;color:var(--blue2);">en ligne</span>`);

  const rate = state.files.length ? Math.round((done.length / state.files.length) * 100) : 100;
  _setHTML('kpi-error',   `${rate} <span style="font-size:1.1rem;color:var(--blue2);">%</span>`);

  // Tableau appareils
  _setHTML('analytics-devices-tbody', state.devices.length
    ? state.devices.map(d => {
        const sent = state.files.filter(f => !f.target_device_id).reduce((s,f)=>s+(f.size_bytes||0),0);
        const recv = state.files.filter(f => f.target_device_id === d.id).reduce((s,f)=>s+(f.size_bytes||0),0);
        return `<tr>
          <td style="color:var(--t1);">${d.icon || '🖥️'} ${d.name}</td>
          <td style="color:var(--t2);">${d.browser || '—'}</td>
          <td style="color:var(--t2);">${d.os || '—'}</td>
          <td class="font-mono" style="font-size:.7rem;color:var(--t3);">${timeAgo(d.last_seen)}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="4" class="table-empty">Aucun appareil</td></tr>');

  // Feed activité
  _setHTML('analytics-feed', state.files.slice(0, 5).map(f => `
    <div class="feed-item">
      <div class="feed-dot" style="background:${f.status === 'done' ? 'var(--green)' : 'var(--red)'};"></div>
      <div style="flex:1;">
        <div class="feed-text"><strong>${f.name}</strong> · ${f.size_label || formatBytes(f.size_bytes)}</div>
        <div class="feed-time">${timeAgo(f.created_at)}</div>
      </div>
    </div>`).join('') || '<div style="padding:1rem;text-align:center;font-family:JetBrains Mono,monospace;font-size:.72rem;color:var(--t3);">Aucune activité</div>');

  buildCharts();
}

function buildCharts() {
  // Graphe 7 jours
  const days = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
  const vals = [0, 0, 0, 0, 0, 0, 0];
  const now  = new Date();
  state.files.forEach(f => {
    const diff = Math.floor((now - new Date(f.created_at)) / 86400000);
    if (diff >= 0 && diff < 7) vals[6 - diff]++;
  });
  const max = Math.max(...vals, 1);
  _setHTML('chart-daily', days.map((d, i) => `
    <div class="bar-wrap">
      <div class="bar-outer">
        <div class="bar-inner" style="height:${(vals[i] / max * 100) || 3}%;"></div>
      </div>
      <span class="bar-label">${d}</span>
    </div>`).join(''));

  // Répartition par type
  const tc = {};
  state.files.forEach(f => { tc[f.type || 'other'] = (tc[f.type || 'other'] || 0) + 1; });
  const tot = Object.values(tc).reduce((a, b) => a + b, 0) || 1;
  _setHTML('chart-types', Object.entries(tc).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, n]) => {
    const pct = Math.round((n / tot) * 100);
    return `<div>
      <div style="display:flex;justify-content:space-between;margin-bottom:3px;font-size:.78rem;">
        <span style="color:var(--t2);">${TYPE_ICONS[t] || '📁'} ${t}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--t3);">${pct}%</span>
      </div>
      <div style="height:4px;background:var(--d5);border-radius:99px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;background:${TYPE_COLORS[t] || 'var(--blue)'};border-radius:99px;"></div>
      </div>
    </div>`;
  }).join('') || '<div style="text-align:center;font-family:JetBrains Mono,monospace;font-size:.72rem;color:var(--t3);">Aucune donnée</div>');
}

export function exportCSV() {
  const rows = ['Nom,Type,Taille,Code,Statut,Date,URL'];
  state.files.forEach(f => {
    rows.push(`"${f.name}",${f.type},${f.size_label || formatBytes(f.size_bytes)},${f.share_code || ''},${f.status},"${f.created_at}","${f.public_url || ''}"`);
  });
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'creo_fichiers.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

function _set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function _setHTML(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }
