/* analytics.js */
import { state } from './state.js';
import { formatBytes, timeAgo, TYPE_COLORS } from './utils.js';
import { isOnline } from './devices.js';

export function renderAnalyticsPage(){
  const done=state.files.filter(f=>f.status==='done');
  const totalB=done.reduce((s,f)=>s+(f.size_bytes||0),0);
  const fmtd=formatBytes(totalB).split(' ');
  const onlineN=state.devices.filter(isOnline).length;
  const rate=state.files.length?Math.round(done.length/state.files.length*100):100;

  _h('kpi-data',`${fmtd[0]} <span style="font-size:1.1rem;color:var(--blue2);">${fmtd[1]||''}</span>`);
  _t('kpi-success',done.length);
  _h('kpi-speed',`${onlineN} <span style="font-size:1.1rem;color:var(--blue2);">en ligne</span>`);
  _h('kpi-error',`${rate} <span style="font-size:1.1rem;color:var(--blue2);">%</span>`);

  // Tableau appareils
  _h('analytics-devices-tbody',state.devices.length
    ?state.devices.map(d=>`<tr>
      <td style="color:var(--t1);">${d.name}</td>
      <td style="color:var(--t2);">${d.browser||'—'}</td>
      <td style="color:var(--t2);">${d.os||'—'}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--t3);">${timeAgo(d.last_seen)}</td>
    </tr>`).join('')
    :'<tr><td colspan="4" class="table-empty">Aucun appareil</td></tr>');

  // Feed
  _h('analytics-feed',done.slice(0,5).map(f=>`<div class="feed-item"><div class="feed-dot" style="background:var(--green);"></div><div style="flex:1;"><div class="feed-text"><strong>${f.name}</strong> · ${f.size_label||formatBytes(f.size_bytes)}</div><div class="feed-time">${timeAgo(f.created_at)}</div></div></div>`).join('')||'<div style="padding:1rem;text-align:center;font-family:JetBrains Mono,monospace;font-size:.72rem;color:var(--t3);">Aucune activité</div>');

  buildCharts();
}

function buildCharts(){
  const days=['LUN','MAR','MER','JEU','VEN','SAM','DIM'];
  const vals=[0,0,0,0,0,0,0];
  const now=new Date();
  state.files.forEach(f=>{const d=Math.floor((now-new Date(f.created_at))/86400000);if(d>=0&&d<7)vals[6-d]++;});
  const max=Math.max(...vals,1);

  // Graphe barres avec CSS
  _h('chart-daily',days.map((d,i)=>`
    <div class="bar-wrap">
      <div style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--t3);text-align:center;margin-bottom:4px;">${vals[i]||''}</div>
      <div class="bar-outer"><div class="bar-inner" style="height:${Math.max((vals[i]/max*100),2)}%;"></div></div>
      <span class="bar-label">${d}</span>
    </div>`).join(''));

  // Répartition types
  const tc={};state.files.forEach(f=>{tc[f.type||'other']=(tc[f.type||'other']||0)+1;});
  const tot=Object.values(tc).reduce((a,b)=>a+b,0)||1;
  _h('chart-types',Object.entries(tc).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([t,n])=>{
    const p=Math.round(n/tot*100);
    return`<div style="margin-bottom:.4rem;">
      <div style="display:flex;justify-content:space-between;margin-bottom:3px;font-size:.78rem;">
        <span style="color:var(--t2);">${t}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:.7rem;color:var(--t3);">${p}%</span>
      </div>
      <div style="height:5px;background:var(--d5);border-radius:99px;overflow:hidden;">
        <div style="width:${p}%;height:100%;background:${TYPE_COLORS[t]||'var(--blue)'};border-radius:99px;transition:width .8s;"></div>
      </div>
    </div>`;
  }).join('')||'<div style="text-align:center;font-family:JetBrains Mono,monospace;font-size:.72rem;color:var(--t3);">Aucune donnée</div>');
}

export function exportCSV(){
  const rows=['Nom,Type,Taille,Code,Statut,Date,URL'];
  state.files.forEach(f=>rows.push(`"${f.name}",${f.type},${f.size_label||formatBytes(f.size_bytes)},${f.share_code||''},${f.status},"${f.created_at}","${f.public_url||''}"`));
  const blob=new Blob([rows.join('\n')],{type:'text/csv'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='creo.csv';a.click();URL.revokeObjectURL(a.href);
}

function _h(id,h){const e=document.getElementById(id);if(e)e.innerHTML=h;}
function _t(id,t){const e=document.getElementById(id);if(e)e.textContent=t;}
