/* analytics.js — temps réel via state.files */
import { state }   from './state.js';
import { formatBytes, timeAgo, TYPE_COLORS } from './utils.js';
import { isOnline } from './devices.js';

export function renderAnalyticsPage() {
  const done   = state.files.filter(f => f.status === 'done');
  const totalB = done.reduce((s, f) => s + (f.size_bytes || 0), 0);
  const fmtd   = formatBytes(totalB).split(' ');
  const online = state.devices.filter(isOnline).length;
  const rate   = state.files.length ? Math.round(done.length / state.files.length * 100) : 100;

  _h('kpi-data',    `${fmtd[0]} <span style="font-size:1.1rem;color:var(--blue2);">${fmtd[1] || ''}</span>`);
  _t('kpi-success', done.length);
  _h('kpi-speed',   `${online} <span style="font-size:1.1rem;color:var(--blue2);">en ligne</span>`);
  _h('kpi-error',   `${rate} <span style="font-size:1.1rem;color:var(--blue2);">%</span>`);

  // Appareils
  _h('analytics-devices-tbody', state.devices.length
    ? state.devices.map(d => {
        const dFiles = state.files.filter(f => f.target_device_id === d.id);
        const dSize  = formatBytes(dFiles.reduce((s,f)=>s+(f.size_bytes||0),0));
        return `<tr>
          <td style="color:var(--t1);">${d.name}</td>
          <td style="color:var(--t2);">${d.browser||'—'}</td>
          <td style="color:var(--t2);">${d.os||'—'}</td>
          <td style="color:var(--t2);font-family:'JetBrains Mono',monospace;font-size:.7rem;">${dSize}</td>
          <td style="font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--t3);">${timeAgo(d.last_seen)}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="5" class="table-empty">Aucun appareil</td></tr>');

  // Activité récente
  _h('analytics-feed', done.slice(0, 6).map(f => `
    <div class="feed-item">
      <div class="feed-dot" style="background:var(--green);"></div>
      <div style="flex:1;">
        <div class="feed-text"><strong>${f.name}</strong> · ${f.size_label || formatBytes(f.size_bytes)}</div>
        <div class="feed-time">${timeAgo(f.created_at)}</div>
      </div>
    </div>`).join('') || '<div style="padding:1rem;text-align:center;font-family:JetBrains Mono,monospace;font-size:.72rem;color:var(--t3);">Aucune activité</div>');

  buildCharts();
}

function buildCharts() {
  // Graphe 7 jours — barres CSS animées
  const days = ['LUN','MAR','MER','JEU','VEN','SAM','DIM'];
  const vals  = [0,0,0,0,0,0,0];
  const sizes = [0,0,0,0,0,0,0]; // taille totale par jour
  const now   = new Date();
  state.files.forEach(f => {
    const d = Math.floor((now - new Date(f.created_at)) / 86400000);
    if (d >= 0 && d < 7) { vals[6-d]++; sizes[6-d]+=(f.size_bytes||0); }
  });
  const max = Math.max(...vals, 1);

  _h('chart-daily', days.map((d, i) => `
    <div class="bar-wrap" title="${vals[i]} fichier(s) · ${formatBytes(sizes[i])}">
      <div style="font-family:'JetBrains Mono',monospace;font-size:.58rem;color:var(--t3);text-align:center;margin-bottom:3px;min-height:14px;">${vals[i] || ''}</div>
      <div class="bar-outer">
        <div class="bar-inner" style="height:${Math.max((vals[i]/max*100), 1.5)}%;"></div>
      </div>
      <span class="bar-label">${d}</span>
    </div>`).join(''));

  // Répartition types — barres horizontales
  const tc = {};
  state.files.forEach(f => { tc[f.type||'other'] = (tc[f.type||'other']||0) + 1; });
  const tot = Object.values(tc).reduce((a,b)=>a+b,0) || 1;

  _h('chart-types', Object.entries(tc).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([t,n]) => {
    const p = Math.round(n/tot*100);
    const color = TYPE_COLORS[t] || 'var(--blue)';
    return `<div style="margin-bottom:.5rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <span style="font-size:.78rem;color:var(--t2);">${t}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:.68rem;color:var(--t3);">${n} · ${p}%</span>
      </div>
      <div style="height:5px;background:var(--d5);border-radius:99px;overflow:hidden;">
        <div style="width:0%;height:100%;background:${color};border-radius:99px;transition:width 1s ease;" data-w="${p}"></div>
      </div>
    </div>`;
  }).join('') || '<div style="text-align:center;font-family:JetBrains Mono,monospace;font-size:.72rem;color:var(--t3);">Aucune donnée</div>');

  // Animer les barres horizontales après render
  requestAnimationFrame(() => {
    document.querySelectorAll('[data-w]').forEach(el => {
      el.style.width = el.dataset.w + '%';
    });
  });
}

export function exportCSV() {
  const rows = ['Nom,Type,Taille,Code,Statut,Date,URL'];
  state.files.forEach(f => rows.push(`"${f.name}",${f.type},${f.size_label||formatBytes(f.size_bytes)},${f.share_code||''},${f.status},"${f.created_at}","${f.public_url||''}"`));
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'creo.csv'; a.click(); URL.revokeObjectURL(a.href);
}

function _h(id,h){const e=document.getElementById(id);if(e)e.innerHTML=h;}
function _t(id,t){const e=document.getElementById(id);if(e)e.textContent=t;}
