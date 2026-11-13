// Trackman page: hitting and pitching leaderboards, per-athlete trend, and CSV import.
// Dependencies are supplied per application instance, never through window.
export function createModule(context) {
const document=context.document;
const Chart=context.Chart;

let tmTab='hit';
let pending=null; // parsed rows waiting for "Save"

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f1=v=>v==null?'—':v.toFixed(1);
const f0=v=>v==null?'—':String(Math.round(v));
const f2=v=>v==null?'—':v.toFixed(2);
const pct=v=>v==null?'—':Math.round(v)+'%';

const HIT_COLS=[
  ['BBE','bbeCount',f0],['Max EV','maxExitVelo',f1],['Avg EV','avgExitVelo',f1],['Avg LA','avgLaunchAngle',v=>v==null?'—':v.toFixed(1)+'°'],
  ['Max Dist','maxDistance',f0],['Hard-Hit %','hardHitPct',pct],['Sweet-Spot %','sweetSpotPct',pct],
];
const PITCH_COLS=[
  ['Pitches','pitchCount',f0],['Max FB','maxPitchVelo',f1],['Avg FB','avgFbVelo',f1],['FB Spin','avgSpinRate',f0],
  ['IVB','avgIVB',f1],['HB','avgHB',f1],['Ext','avgExtension',f2],['Rel Ht','avgRelHeight',f2],
];

function hitters(){return context.api.rosterAthletes().filter(a=>a.bbeCount>0).sort((a,b)=>(b.maxExitVelo??0)-(a.maxExitVelo??0));}
function pitchers(){return context.api.rosterAthletes().filter(a=>a.pitchCount>0).sort((a,b)=>(b.maxPitchVelo??0)-(a.maxPitchVelo??0));}

function initTM(){
  renderSummary();
  renderKpis();
  tmSetTab(tmTab);
}

function renderSummary(){
  const rows=context.api.TRACKMAN;
  const el=document.getElementById('tm-summary');
  if(context.api.tmLoadError){el.textContent='Trackman data could not be loaded: '+context.api.tmLoadError;return;}
  if(!rows.length){el.textContent='No Trackman data yet. Import a standard TrackMan CSV to begin.';return;}
  const dates=rows.map(r=>r.pitch_date).filter(Boolean).sort();
  el.textContent=`${rows.length.toLocaleString()} tracked pitches · ${context.api.fmtDate?.(dates[0])||dates[0]} – ${context.api.fmtDate?.(dates[dates.length-1])||dates[dates.length-1]}`;
}

function renderKpis(){
  const h=hitters(), p=pitchers();
  const best=(list,k)=>list.reduce((m,a)=>a[k]!=null&&(m==null||a[k]>m)?a[k]:m,null);
  const avg=(list,k)=>{const v=list.map(a=>a[k]).filter(x=>x!=null);return v.length?v.reduce((s,x)=>s+x,0)/v.length:null;};
  const card=(lbl,val,sub)=>`<div class="kpi-card"><div class="kpi-lbl">${lbl}</div><div class="kpi-val">${val}</div><div class="kpi-sub">${sub}</div></div>`;
  document.getElementById('tm-kpis').innerHTML=[
    card('Team Max EV',f1(best(h,'maxExitVelo')),'mph · hitting'),
    card('Avg Exit Velo',f1(avg(h,'avgExitVelo')),'mph · hitter average'),
    card('Hard-Hit %',pct(avg(h,'hardHitPct')),`${context.api.HARD_HIT_MPH}+ mph`),
    card('Team Max FB',f1(best(p,'maxPitchVelo')),'mph · pitching'),
    card('Avg FB Velo',f1(avg(p,'avgFbVelo')),'mph · pitcher average'),
    card('Avg FB Spin',f0(avg(p,'avgSpinRate')),'rpm'),
  ].join('');
}

function tmSetTab(t){
  tmTab=t==='pitch'?'pitch':'hit';
  document.getElementById('tm-tab-hit').classList.toggle('active',tmTab==='hit');
  document.getElementById('tm-tab-pitch').classList.toggle('active',tmTab==='pitch');
  document.getElementById('tm-tab-note').textContent=tmTab==='hit'
    ?`Batted balls with exit velocity · hard-hit = ${context.api.HARD_HIT_MPH}+ mph · sweet spot = ${context.api.SWEET_SPOT[0]}–${context.api.SWEET_SPOT[1]}° · % shown with 5+ batted balls`
    :'Velo, spin and movement use fastballs (Fastball, Four-Seam, Two-Seam, Sinker); extension and release height use all pitches';
  renderTable();
  renderAthleteSelect();
  tmRenderChart();
}

function renderTable(){
  const cols=tmTab==='hit'?HIT_COLS:PITCH_COLS;
  const list=tmTab==='hit'?hitters():pitchers();
  document.getElementById('tm-table-title').textContent=tmTab==='hit'?'Hitting leaderboard':'Pitching leaderboard';
  document.getElementById('tm-thead').innerHTML=`<tr><th>#</th><th>Athlete</th><th>Pos</th>${cols.map(c=>`<th>${c[0]}</th>`).join('')}</tr>`;
  document.getElementById('tm-tbody').innerHTML=list.length?list.map((a,i)=>`
    <tr data-onclick="openAth(${a.id})" style="cursor:pointer;">
      <td class="rn">${i+1}</td>
      <td><div style="display:flex;align-items:center;gap:7px;">${context.api.ava(a)}<span style="font-weight:500;">${esc(a.name)}</span></div></td>
      <td>${context.api.posPill(a.pos)}</td>
      ${cols.map(c=>`<td style="font-family:var(--fm);">${c[2](a[c[1]])}</td>`).join('')}
    </tr>`).join('')
    :`<tr><td colspan="${cols.length+3}" class="tm-empty">No ${tmTab==='hit'?'batted-ball':'pitch'} data for the roster yet.</td></tr>`;
}

function renderAthleteSelect(){
  const sel=document.getElementById('tm-ath-sel');
  const list=tmTab==='hit'?hitters():pitchers();
  const prev=sel.value;
  sel.innerHTML=list.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');
  if(list.some(a=>String(a.id)===prev)) sel.value=prev;
}

function tmRenderChart(){
  context.api.kc('tm-trend');
  const sel=document.getElementById('tm-ath-sel');
  const a=context.api.rosterAthletes().find(x=>String(x.id)===sel.value);
  const label=tmTab==='hit'?'exit velocity':'fastball velocity';
  document.getElementById('tm-chart-title').textContent=(a?a.name+' — ':'')+label+' by session (mph)';
  if(!a) return;
  const pts=context.api.trackmanByDate(a,tmTab);
  context.api.CH['tm-trend']=new Chart(document.getElementById('tm-trend'),{
    type:'line',
    data:{labels:pts.map(p=>context.api.fmtDate?.(p.date)||p.date),datasets:[
      {label:'Max',data:pts.map(p=>p.max),borderColor:'#FE5000',backgroundColor:'rgba(254,80,0,0.15)',tension:0.25,pointRadius:3},
      {label:'Average',data:pts.map(p=>Math.round(p.avg*10)/10),borderColor:'#60A5FA',backgroundColor:'rgba(96,165,250,0.15)',tension:0.25,pointRadius:3},
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#B8A898',font:{size:10}}}},
      scales:{x:{grid:{display:false},ticks:{color:'#6A5646',font:{size:9}}},y:{grid:{color:'rgba(254,80,0,0.04)'},ticks:{color:'#6A5646',font:{size:9}}}}}
  });
}

// ── Import ──────────────────────────────────────────────────────
function tmChooseFile(){const i=document.getElementById('tm-file');i.value='';i.click();}

async function tmFileSelected(event){
  const file=event?.target?.files?.[0];
  if(!file) return;
  const text=await file.text();
  tmPreviewText(text,file.name);
}

// Parse, keep only pitches that involve a roster athlete, and show a preview.
function tmPreviewText(text,fileName){
  const card=document.getElementById('tm-import-card'), box=document.getElementById('tm-preview');
  card.style.display='';
  const {rows,missing,skipped}=context.api.parseTrackmanCSV(text,fileName);
  if(missing.length){
    pending=null;document.getElementById('tm-save-btn').disabled=true;
    box.innerHTML=`<div class="err">This file is missing required Trackman columns: ${missing.map(esc).join(', ')}.</div>`;
    return;
  }
  const matched=new Map(), unmatched=new Set(), kept=[];
  const canon=name=>{
    if(!name) return null;
    if(matched.has(name)) return matched.get(name);
    const a=context.api.matchTrackmanAthlete(name);
    if(a){const c=a._canonicalName||a.name;matched.set(name,c);return c;}
    unmatched.add(name);return null;
  };
  for(const r of rows){
    const p=canon(r.pitcher_name), b=canon(r.batter_name);
    if(!p&&!b) continue;
    // Opponent names are not stored: only roster athletes keep their name on a row.
    kept.push({...r,pitcher_name:p,batter_name:b});
  }
  const fresh=context.api.newTrackmanRowsOnly(kept);
  pending=fresh.length?fresh:null;
  document.getElementById('tm-save-btn').disabled=!pending;
  const dates=kept.map(r=>r.pitch_date).sort();
  box.innerHTML=[
    `<div>${esc(fileName)} · ${rows.length} rows read${skipped?` · ${skipped} skipped (no date or names)`:''}${dates.length?` · ${dates[0]} to ${dates[dates.length-1]}`:''}</div>`,
    `<div class="ok">${matched.size} roster athlete${matched.size===1?'':'s'} matched · ${kept.length} pitch${kept.length===1?'':'es'} involve the roster · ${fresh.length} new</div>`,
    kept.length-fresh.length?`<div class="warn">${kept.length-fresh.length} already imported (skipped)</div>`:'',
    unmatched.size?`<div class="warn">Not on the roster (not saved): ${[...unmatched].slice(0,12).map(esc).join(', ')}${unmatched.size>12?` and ${unmatched.size-12} more`:''}</div>`:'',
    !fresh.length?'<div class="err">Nothing new to save.</div>':'',
  ].join('');
}

async function tmSave(){
  if(!pending) return;
  const btn=document.getElementById('tm-save-btn');btn.disabled=true;
  try{
    const {saved,duplicates}=await context.api.saveTrackmanRows(pending);
    pending=null;
    document.getElementById('tm-import-card').style.display='none';
    context.api.toast(`✓ Saved ${saved} Trackman pitch${saved===1?'':'es'}${duplicates?` (${duplicates} duplicates skipped)`:''}`);
    initTM();
  }catch(e){
    btn.disabled=false;
    document.getElementById('tm-preview').insertAdjacentHTML('beforeend',`<div class="err">Save failed: ${esc(e.message||e)}</div>`);
  }
}

function tmCancel(){pending=null;document.getElementById('tm-import-card').style.display='none';}

return Object.defineProperties({}, {
  initTM: {enumerable:true, configurable:true, get:()=>initTM},
  tmSetTab: {enumerable:true, configurable:true, get:()=>tmSetTab},
  tmRenderChart: {enumerable:true, configurable:true, get:()=>tmRenderChart},
  tmChooseFile: {enumerable:true, configurable:true, get:()=>tmChooseFile},
  tmFileSelected: {enumerable:true, configurable:true, get:()=>tmFileSelected},
  tmPreviewText: {enumerable:true, configurable:true, get:()=>tmPreviewText},
  tmSave: {enumerable:true, configurable:true, get:()=>tmSave},
  tmCancel: {enumerable:true, configurable:true, get:()=>tmCancel}
});
}
