// Baseball app module (started from the Hockey app).
// Dependencies are supplied per application instance, never through window.
export function createModule(context) {
const document=context.document;
const window=context.window;
const Chart=context.Chart;
const XLSX=context.XLSX;
const setTimeout=context.setTimeout;
const clearTimeout=context.clearTimeout;
const requestAnimationFrame=context.requestAnimationFrame;
// Athletes array starts empty — all data loads from Supabase on login
let ATHLETES = [];

// default when imported with no position

// A position is "set" if it was explicitly assigned (has _posLocked flag)
function posIsSet(a){ return !!a._posLocked; }


function unsetCount(){ return ATHLETES.filter(a=>!posIsSet(a)).length; }

// Called after every import — auto-lock positions already set, auto-nav to roster if any unset
function postImportPositionCheck(){
  ATHLETES.forEach(a=>{
    if(a._hasPos&&a.pos) a._posLocked=true;
    // If athlete has no canonical name yet, set it from .name but leave unlocked for confirmation
    if(!a._canonicalName) a._canonicalName=a.name;
  });
  context.api.updateRosterBadge();
  const needsSetup=ATHLETES.filter(a=>!posIsSet(a)||!a._nameLocked).length;
  if(needsSetup>0){
    setTimeout(()=>{ context.navigate('roster'); context.api.toast(`${needsSetup} athlete${needsSetup!==1?'s':''} need name/position — confirm here`); }, 400);
  }
}

// ── Deduplication ────────────────────────────────────────────────
// Merge any duplicate canonical names in ATHLETES in-place.
// For each group sharing the same canonical name: merge all records into one
// (best composite wins numeric values, locked flags are OR'd, sources are combined).
function dedupeATHLETES(){
  const seen = new Map(); // canonical → index in ATHLETES
  const toRemove = new Set();

  for(let i=0;i<ATHLETES.length;i++){
    const a=ATHLETES[i];
    const key=context.api.nameKey(a._canonicalName||a.name);
    if(!key) continue;

    if(!seen.has(key)){
      seen.set(key,i);
    } else {
      // Merge into the first occurrence
      const primaryIdx=seen.get(key);
      const primary=ATHLETES[primaryIdx];
      const dup=a;

      // For each numeric metric, keep the better value
      const metricKeys=['broadJump','cmjHeight','sixtyYard','split10','peakPower','rsi','asymmetry','eccRFD','concImpulse','eccImpulse','contractionTime','backSquatMax','frontSquatMax','trapBarMax','medBallVelo','benchMax','fly10','homeToFirst'];
      for(const k of metricKeys){
        const m=context.api.getM(k);
        if(!m) continue;
        const primVal=primary[k], dupVal=dup[k];
        if(typeof dupVal==='number'&&!isNaN(dupVal)&&typeof primVal==='number'&&!isNaN(primVal)){
          // "Better" = higher for higherBetter metrics, lower for time/asymmetry
          primary[k]=m.hb?Math.max(primVal,dupVal):Math.min(primVal,dupVal);
        }
      }

      // Inherit locked flags
      if(dup._posLocked) primary._posLocked=true;
      if(dup._nameLocked){ primary._nameLocked=true; primary._canonicalName=dup._canonicalName||primary._canonicalName; }
      if(dup.pos&&!primary._posLocked) primary.pos=dup.pos;
      if(dup.yr&&primary.yr==='Jr') primary.yr=dup.yr;
      if(dup.age&&primary.age===20) primary.age=dup.age;

      // Merge sources
      if(dup._sources?.length){
        primary._sources=(primary._sources||[]);
        for(const s of dup._sources){
          if(!primary._sources.find(x=>x.file===s.file)) primary._sources.push(s);
        }
      }

      // Recompute
      primary.composite=context.api.calcCompositeVB(primary);
      primary.tier=context.api.calcTier(primary.composite);
      primary.trend[primary.trend.length-1]=primary.composite;

      toRemove.add(i);
    }
  }

  if(toRemove.size>0){
    ATHLETES=ATHLETES.filter((_,i)=>!toRemove.has(i));
  }
}

// The single source of truth for all UI rendering — always deduplicated and sorted by name
// ── Active athlete filter ────────────────────────────────────────
// Athletes are "active" if they have a test session in the last 6 months.
// Inactive athletes are hidden from leaderboards/charts but remain editable in Roster Setup.
const ACTIVE_WINDOW_DAYS = 183;

// ~6 months
// Baseball: an athlete is active if they have ANY recent data: a force-plate session,
// a Trackman pitch or batted ball, or a logged test (kpi_history). No wearables here.
function activeNameSet(){
  const cutoff=new Date(Date.now()-ACTIVE_WINDOW_DAYS*24*60*60*1000).toISOString().slice(0,10);
  const set=new Set();
  const add=n=>{if(n)set.add(context.api.normName(n));};
  for(const s of context.api.SESSIONS||[]) if(s.test_date>=cutoff) add(s.athlete_name);
  for(const h of context.api.KPI_HISTORY||[]) if(h.test_date>=cutoff) add(h.athlete_name);
  for(const r of context.api.TRACKMAN||[]) if(r.pitch_date>=cutoff){add(r.pitcher_name);add(r.batter_name);}
  return set;
}
function hasActivityData(){
  return !!((context.api.SESSIONS||[]).length||(context.api.KPI_HISTORY||[]).length||(context.api.TRACKMAN||[]).length);
}
function isAthleteActive(athlete,active=activeNameSet()){
  if(!hasActivityData()) return true; // No activity data at all → show everyone
  return active.has(context.api.normName(athlete._canonicalName||athlete.name));
}

// All non-archived athletes (for Roster Setup, manual edit, dropdowns)
function allAthletes(){
  dedupeATHLETES();
  return ATHLETES.filter(a=>!a._archived)
    .slice().sort((a,b)=>(a._canonicalName||a.name).localeCompare(b._canonicalName||b.name));
}

// Archived athletes only — for the Archived filter in Roster Setup
function archivedAthletes(){
  dedupeATHLETES();
  return ATHLETES.filter(a=>a._archived)
    .slice().sort((a,b)=>(a._canonicalName||a.name).localeCompare(b._canonicalName||b.name));
}

// Active-only roster — used by all leaderboards, charts, KPIs, dashboards
function rosterAthletes(){
  const all=allAthletes(); // already excludes archived
  if(!hasActivityData()) return all;
  const set=activeNameSet();
  const active=all.filter(a=>isAthleteActive(a,set));
  return active.length>0 ? active : all;
}

// Build athlete <option> list for dropdowns — always deduplicated, sorted alphabetically
function athleteOptions(includePlaceholder=''){
  // Profile/Compare dropdowns include ALL athletes (so you can review inactive players too)
  const sorted=allAthletes();
  const opts=sorted.map(a=>{
    const inactive=!isAthleteActive(a);
    const suffix=inactive?' · INACTIVE':'';
    return`<option value="${a.id}">${a._canonicalName||a.name} (${a.pos})${suffix}</option>`;
  }).join('');
  return includePlaceholder?`<option value="">${includePlaceholder}</option>${opts}`:opts;
}


function refreshAll(){
  dedupeATHLETES();
  ATHLETES=ATHLETES.map((a,i)=>({...a,id:i}));
  context.api.refreshApproachJumpFreshness();
  Object.keys(context.api.CH).forEach(k=>context.api.kc(k));
  if(context.api.sb && context.api.currentUser && context.api._cloudDataLoaded) context.api.queueSaveAll();
}

// Baseball: imports such as VALD force plate or Trackman only add test data; they never
// created roster entries (Hockey always had a roster first). This adds an athlete for every
// name in the imported data that is not on the roster yet, with no position set, so the
// coach assigns it in Roster Setup. Matching is exact (after normalisation and nickname
// aliases) so two different players are never merged; typo variants can be merged in
// Roster Setup.
function namesInImportedData(){
  const byKey=new Map();
  const add=n=>{const t=String(n||'').trim().replace(/\s+/g,' ');if(!t)return;const k=context.api.nameKey(t);if(k&&!byKey.has(k))byKey.set(k,t);};
  for(const s of context.api.SESSIONS||[]) add(s.athlete_name);
  for(const h of context.api.KPI_HISTORY||[]) add(h.athlete_name);
  for(const r of context.api.TRACKMAN||[]){add(r.pitcher_name);add(r.batter_name);}
  return byKey;
}
function missingRosterNames(){
  const onRoster=new Set(ATHLETES.map(a=>context.api.nameKey(a._canonicalName||a.name)));
  return [...namesInImportedData()].filter(([k])=>!onRoster.has(k)).map(([,name])=>name);
}
function addAthletesFromData({quiet=false}={}){
  const names=missingRosterNames();
  if(!names.length){if(!quiet)context.api.toast?.('Every athlete in the imported data is already on the roster');return 0;}
  let id=ATHLETES.reduce((m,a)=>Math.max(m,Number(a.id)||0),0);
  const fresh=names.map(name=>{
    const parts=name.split(' ');
    return {id:++id,name,_canonicalName:name,initials:((parts[0]||'?')[0]+(parts.length>1?parts[parts.length-1][0]:'')).toUpperCase(),
      pos:POS_DEFAULT,yr:'',av:context.api.avCls(id),_posLocked:false,_nameLocked:false,_sources:[],trend:[]};
  });
  ATHLETES=[...ATHLETES,...fresh];
  context.api.enrichAthletesFromSessions?.();
  context.api.applyBestRecentValues?.();
  context.api.rescoreAllAthletes?.();
  for(const a of fresh) context.api.queueSave?.(a);
  context.api.refreshAll?.();
  const active=context.activeFeature?.(); if(active) context.refreshFeature?.(active);
  context.api.toast?.(`✓ Added ${fresh.length} athlete${fresh.length===1?'':'s'} to the roster — set their positions in Roster Setup`,6000);
  return fresh.length;
}
const POS_DEFAULT='IF'; // shown as "unassigned" until a position is saved (_posLocked)

return Object.defineProperties({}, {
  missingRosterNames: {enumerable:true, configurable:true, get:()=>missingRosterNames},
  addAthletesFromData: {enumerable:true, configurable:true, get:()=>addAthletesFromData},
  ATHLETES: {enumerable:true, configurable:true, get:()=>ATHLETES, set:value=>{ATHLETES=value;}},
  posIsSet: {enumerable:true, configurable:true, get:()=>posIsSet},
  unsetCount: {enumerable:true, configurable:true, get:()=>unsetCount},
  postImportPositionCheck: {enumerable:true, configurable:true, get:()=>postImportPositionCheck},
  dedupeATHLETES: {enumerable:true, configurable:true, get:()=>dedupeATHLETES},
  ACTIVE_WINDOW_DAYS: {enumerable:true, configurable:true, get:()=>ACTIVE_WINDOW_DAYS},
  activeNameSet: {enumerable:true, configurable:true, get:()=>activeNameSet},
  isAthleteActive: {enumerable:true, configurable:true, get:()=>isAthleteActive},
  allAthletes: {enumerable:true, configurable:true, get:()=>allAthletes},
  archivedAthletes: {enumerable:true, configurable:true, get:()=>archivedAthletes},
  rosterAthletes: {enumerable:true, configurable:true, get:()=>rosterAthletes},
  athleteOptions: {enumerable:true, configurable:true, get:()=>athleteOptions},
  refreshAll: {enumerable:true, configurable:true, get:()=>refreshAll}
});
}
