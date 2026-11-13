// Trackman (pitch-by-pitch) data for Baseball. Raw rows live in the `trackman_pitches`
// table; per-athlete hitting and pitching metrics are derived from them at load time
// and are never written back onto the athlete row.
// Dependencies are supplied per application instance, never through window.
export function createModule(context) {

// Standard TrackMan Baseball CSV columns → our row fields. Matching is case-insensitive.
const TM_COLUMNS = {
  pitch_uid:    ['pitchuid'],
  pitch_date:   ['date','gamedate'],
  pitcher_name: ['pitcher'],
  batter_name:  ['batter'],
  pitch_type:   ['taggedpitchtype','autopitchtype'],
  rel_speed:    ['relspeed'],
  spin_rate:    ['spinrate'],
  ivb:          ['inducedvertbreak'],
  hb:           ['horzbreak'],
  extension:    ['extension'],
  rel_height:   ['relheight'],
  exit_speed:   ['exitspeed'],
  launch_angle: ['angle'],
  distance:     ['distance'],
  hit_spin:     ['hitspinrate'],
};
const NUMERIC = ['rel_speed','spin_rate','ivb','hb','extension','rel_height','exit_speed','launch_angle','distance','hit_spin'];
const FASTBALLS = new Set(['fastball','four-seam','fourseamfastball','four seam','4-seam','two-seam','twoseamfastball','two seam','2-seam','sinker','cutter-fastball']);
const HARD_HIT_MPH = 95;
const SWEET_SPOT = [8,32];
const MIN_BBE_FOR_PCT = 5; // percentages need at least this many batted balls

let TRACKMAN = [];
let tmLoadError = null;

function splitCSVLine(line){
  const out=[];let cur='',q=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++;}else q=!q;}
    else if(c===','&&!q){out.push(cur);cur='';}
    else cur+=c;
  }
  out.push(cur);
  return out.map(s=>s.trim());
}

// "Last, First" (Trackman's format) → "First Last". Anything else is returned trimmed.
function tmName(raw){
  const s=String(raw||'').trim();
  if(!s) return '';
  const m=s.match(/^([^,]+),\s*(.+)$/);
  return m?`${m[2].trim()} ${m[1].trim()}`:s;
}

// Accepts YYYY-MM-DD, M/D/YYYY or M/D/YY. Returns ISO date or null.
function tmDate(raw){
  const s=String(raw||'').trim();
  let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if(m){const y=m[3].length===2?'20'+m[3]:m[3];return `${y}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;}
  return null;
}

function isFastball(t){return FASTBALLS.has(String(t||'').trim().toLowerCase());}

// Parse a standard TrackMan CSV. Returns {rows, missing, skipped}.
function parseTrackmanCSV(text, sourceFile=''){
  const lines=String(text||'').replace(/^﻿/,'').replace(/\r\n?/g,'\n').split('\n').filter(l=>l.trim());
  if(lines.length<2) return {rows:[],missing:['header and data rows'],skipped:0};
  const header=splitCSVLine(lines[0]).map(h=>h.toLowerCase().replace(/\s+/g,''));
  const idx={};
  for(const [field,aliases] of Object.entries(TM_COLUMNS)) idx[field]=header.findIndex(h=>aliases.includes(h));
  const missing=['pitch_date','pitcher_name','batter_name'].filter(f=>idx[f]<0).map(f=>TM_COLUMNS[f][0]);
  if(idx.rel_speed<0&&idx.exit_speed<0) missing.push('relspeed or exitspeed');
  if(missing.length) return {rows:[],missing,skipped:0};
  const rows=[];let skipped=0;
  for(const line of lines.slice(1)){
    const c=splitCSVLine(line);
    const get=f=>idx[f]>=0?c[idx[f]]:'';
    const row={
      pitch_uid:get('pitch_uid')||null,
      pitch_date:tmDate(get('pitch_date')),
      pitcher_name:tmName(get('pitcher_name')),
      batter_name:tmName(get('batter_name')),
      pitch_type:get('pitch_type')||null,
      source_file:sourceFile||null,
    };
    for(const f of NUMERIC){const v=parseFloat(get(f));row[f]=Number.isFinite(v)?v:null;}
    if(!row.pitch_date||(!row.pitcher_name&&!row.batter_name)){skipped++;continue;}
    rows.push(row);
  }
  return {rows,missing:[],skipped};
}

// Roster athlete for a Trackman name, or null. Uses the app's normal name matching.
function matchAthlete(name){
  if(!name) return null;
  const m=context.api.findBestMatch(name);
  return m&&m.athlete&&m.matchType!=='ambiguous-last-name'?m.athlete:null;
}

async function loadTrackman(){
  tmLoadError=null;
  if(!context.api.sb||!context.api.currentUser){TRACKMAN=[];return;}
  try{
    const {data,error}=await context.api.fetchAllRows('trackman_pitches','pitch_date',true);
    if(error) throw error;
    TRACKMAN=data||[];
  }catch(e){
    // Not fatal: the rest of the dashboard works without Trackman data.
    tmLoadError=e.message||String(e);
    console.warn('Trackman data not loaded:',tmLoadError);
    TRACKMAN=[];
  }
}

const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
const round=(v,d=1)=>v==null?null:Math.round(v*10**d)/10**d;

// Derived Trackman metrics for one athlete (null when there is no data).
function trackmanMetrics(a, rows=TRACKMAN){
  const key=context.api.nameKey(a._canonicalName||a.name);
  const mine=f=>rows.filter(r=>r[f]&&context.api.nameKey(r[f])===key);
  const bbe=mine('batter_name').filter(r=>r.exit_speed!=null);
  const pitches=mine('pitcher_name').filter(r=>r.rel_speed!=null);
  const out={};
  if(bbe.length){
    const ev=bbe.map(r=>r.exit_speed), la=bbe.filter(r=>r.launch_angle!=null).map(r=>r.launch_angle);
    out.maxExitVelo=round(Math.max(...ev));
    out.avgExitVelo=round(mean(ev));
    out.avgLaunchAngle=la.length?round(mean(la)):null;
    const dist=bbe.filter(r=>r.distance!=null).map(r=>r.distance);
    out.maxDistance=dist.length?Math.round(Math.max(...dist)):null;
    const spin=bbe.filter(r=>r.hit_spin!=null).map(r=>r.hit_spin);
    out.avgBattedSpin=spin.length?Math.round(mean(spin)):null;
    if(bbe.length>=MIN_BBE_FOR_PCT){
      out.hardHitPct=round(100*ev.filter(v=>v>=HARD_HIT_MPH).length/ev.length,0);
      out.sweetSpotPct=la.length?round(100*la.filter(v=>v>=SWEET_SPOT[0]&&v<=SWEET_SPOT[1]).length/la.length,0):null;
    }
    out.bbeCount=bbe.length;
  }
  if(pitches.length){
    // Fastball metrics use tagged fastballs; untagged files fall back to every pitch.
    const tagged=pitches.some(r=>r.pitch_type&&!/^undefined$/i.test(r.pitch_type));
    const fb=tagged?pitches.filter(r=>isFastball(r.pitch_type)):pitches;
    const pick=(list,f)=>list.filter(r=>r[f]!=null).map(r=>r[f]);
    if(fb.length){
      out.maxPitchVelo=round(Math.max(...pick(fb,'rel_speed')));
      out.avgFbVelo=round(mean(pick(fb,'rel_speed')));
      const sp=pick(fb,'spin_rate'); out.avgSpinRate=sp.length?Math.round(mean(sp)):null;
      const ivb=pick(fb,'ivb'); out.avgIVB=ivb.length?round(mean(ivb)):null;
      const hb=pick(fb,'hb'); out.avgHB=hb.length?round(Math.abs(mean(hb))):null;
    }
    const ext=pick(pitches,'extension'); out.avgExtension=ext.length?round(mean(ext),2):null;
    const rh=pick(pitches,'rel_height'); out.avgRelHeight=rh.length?round(mean(rh),2):null;
    out.pitchCount=pitches.length;
  }
  return out;
}

const TM_KEYS=['maxExitVelo','avgExitVelo','avgLaunchAngle','maxDistance','hardHitPct','sweetSpotPct','avgBattedSpin',
  'maxPitchVelo','avgFbVelo','avgSpinRate','avgIVB','avgHB','avgExtension','avgRelHeight','bbeCount','pitchCount'];

function enrichAthletesFromTrackman(){
  for(const a of context.api.ATHLETES){
    const m=trackmanMetrics(a);
    for(const k of TM_KEYS) a[k]=m[k]??null;
  }
}

// Per-date summary for one athlete's trend chart.
function trackmanByDate(a, role){
  const key=context.api.nameKey(a._canonicalName||a.name);
  const field=role==='pitch'?'pitcher_name':'batter_name';
  const value=role==='pitch'?'rel_speed':'exit_speed';
  const by={};
  for(const r of TRACKMAN){
    if(!r[field]||r[value]==null||context.api.nameKey(r[field])!==key) continue;
    if(role==='pitch'&&r.pitch_type&&!/^undefined$/i.test(r.pitch_type)&&!isFastball(r.pitch_type)) continue;
    (by[r.pitch_date]=by[r.pitch_date]||[]).push(r[value]);
  }
  return Object.keys(by).sort().map(d=>({date:d,max:Math.max(...by[d]),avg:mean(by[d]),n:by[d].length}));
}

// Drop rows already stored (same PitchUID, or same date/pitcher/batter/velo/EV when there is no UID).
function rowKey(r){
  return r.pitch_uid?('uid:'+r.pitch_uid):[r.pitch_date,r.pitcher_name,r.batter_name,r.pitch_type,r.rel_speed,r.exit_speed,r.launch_angle].join('|');
}
function newRowsOnly(rows){
  const have=new Set(TRACKMAN.map(rowKey));
  const seen=new Set();
  return rows.filter(r=>{const k=rowKey(r);if(have.has(k)||seen.has(k))return false;seen.add(k);return true;});
}

async function saveTrackmanRows(rows){
  if(!context.api.sb) throw new Error('Not signed in');
  const fresh=newRowsOnly(rows).map(r=>({...r,created_by:context.api.currentUser?.email||null}));
  for(let i=0;i<fresh.length;i+=500){
    const {error}=await context.api.sb.from('trackman_pitches').insert(fresh.slice(i,i+500));
    if(error) throw error;
  }
  await loadTrackman();
  enrichAthletesFromTrackman();
  context.api.rescoreAllAthletes();
  return {saved:fresh.length,duplicates:rows.length-fresh.length};
}

return Object.defineProperties({}, {
  TRACKMAN: {enumerable:true, configurable:true, get:()=>TRACKMAN, set:value=>{TRACKMAN=value;}},
  tmLoadError: {enumerable:true, configurable:true, get:()=>tmLoadError},
  HARD_HIT_MPH: {enumerable:true, configurable:true, get:()=>HARD_HIT_MPH},
  SWEET_SPOT: {enumerable:true, configurable:true, get:()=>SWEET_SPOT},
  tmName: {enumerable:true, configurable:true, get:()=>tmName},
  tmDate: {enumerable:true, configurable:true, get:()=>tmDate},
  isFastball: {enumerable:true, configurable:true, get:()=>isFastball},
  parseTrackmanCSV: {enumerable:true, configurable:true, get:()=>parseTrackmanCSV},
  matchTrackmanAthlete: {enumerable:true, configurable:true, get:()=>matchAthlete},
  loadTrackman: {enumerable:true, configurable:true, get:()=>loadTrackman},
  trackmanMetrics: {enumerable:true, configurable:true, get:()=>trackmanMetrics},
  enrichAthletesFromTrackman: {enumerable:true, configurable:true, get:()=>enrichAthletesFromTrackman},
  trackmanByDate: {enumerable:true, configurable:true, get:()=>trackmanByDate},
  newTrackmanRowsOnly: {enumerable:true, configurable:true, get:()=>newRowsOnly},
  saveTrackmanRows: {enumerable:true, configurable:true, get:()=>saveTrackmanRows}
});
}
