// Men’s Basketball app module (started from the Men’s Basketball app).
// Dependencies are supplied per application instance, never through window.
export function createModule(context) {
const document=context.document;
const window=context.window;
const Chart=context.Chart;
const XLSX=context.XLSX;
const setTimeout=context.setTimeout;
const clearTimeout=context.clearTimeout;
const requestAnimationFrame=context.requestAnimationFrame;
/* ═══════════════════════════════════════════════════════════════
   READINESS HUB — Session-based daily monitoring
═══════════════════════════════════════════════════════════════ */
let SESSIONS = [];

// % — anything beyond this absolute value gets a flag

// Supabase returns at most 1,000 rows per request, so a plain select silently
// drops everything older once a table grows past that. Page through in chunks.
async function fetchAllRows(table, orderCol, ascending){
  const PAGE=1000; let all=[];
  for(let from=0;;from+=PAGE){
    const {data,error}=await context.api.sb.from(table).select('*').order(orderCol,{ascending}).order('id',{ascending:true}).range(from,from+PAGE-1);
    if(error) throw error;
    all=all.concat(data||[]);
    if(!data||data.length<PAGE) break;
  }
  return {data:all,error:null};
}


async function loadAllSessions(){
  if(!context.api.sb||!context.api.currentUser) return;
  try{
    const {data, error} = await fetchAllRows('test_sessions','test_date',false);
    if(error) throw error;
    // Sessions without a valid test_date cannot be placed in time, so they are excluded from every
    // date-based view instead of being repaired or crashing the app. Never silent: warn and toast.
    const rows=data||[];
    SESSIONS = rows.filter(s=>context.api.isValidTestDate(s.test_date));
    const skipped=rows.length-SESSIONS.length;
    if(skipped){
      console.warn(`Skipped ${skipped} session(s) with a missing or invalid test_date:`,rows.filter(s=>!context.api.isValidTestDate(s.test_date)).map(s=>s.id));
      context.api.toast?.(`⚠ ${skipped} session${skipped===1?'':'s'} with an invalid date ${skipped===1?'was':'were'} skipped`);
    }
  } catch(e){
    console.error('Load sessions failed:',e);
    SESSIONS = [];
  }
}


let KPI_HISTORY=[];


async function loadKpiHistory(){
  if(!context.api.sb||!context.api.currentUser) return;
  try{
    const {data, error} = await fetchAllRows('kpi_history','test_date',true);
    if(error) throw error;
    KPI_HISTORY = data||[];
  } catch(e){
    console.error('Load kpi_history failed:',e);
    KPI_HISTORY = [];
  }
}

// Log a dated KPI value into long-term history. Used both by the one-time
// backfill and by every live import path that sets a tracked testing metric,
// so history keeps building automatically going forward. Same-date entries
// for the same athlete/metric keep whichever value is BETTER (per the
// metric's hb flag), matching the backfill's dedup rule, rather than just
// "last one wins".
async function logKpiHistory(athlete, metricKey, testDate, value, source){
  if(!context.api.sb||!context.api.currentUser||!athlete||value==null||!testDate) return;
  const m=context.api.getM(metricKey);
  if(!m) return;
  if(context.api.isFormerPlayer(athlete._canonicalName||athlete.name)) return;
  const canon=athlete._canonicalName||athlete.name||'';
  try{
    // Match by NAME + metric + date (athlete ids proved unreliable)
    const {data:rows}=await context.api.sb.from('kpi_history').select('id,value,athlete_name')
      .eq('metric_key',metricKey).eq('test_date',testDate);
    const existing=(rows||[]).find(r=>context.api.nameKey(r.athlete_name)===context.api.nameKey(canon));
    if(existing){
      const isBetter=m.hb?(value>existing.value):(value<existing.value);
      if(!isBetter) return;
      await context.api.sb.from('kpi_history').update({value,source,athlete_name:canon,athlete_id:athlete._dbId||null}).eq('id',existing.id);
    } else {
      await context.api.sb.from('kpi_history').insert({
        athlete_id:athlete._dbId||null, athlete_name:canon,
        metric_key:metricKey, test_date:testDate, value, source,
      });
    }
  } catch(e){ console.warn('logKpiHistory failed:',e.message); }
}

// Rows that carry genuine VALD ForceDecks CMJ fields (Firstbeat/broad-jump rows share
// the test_sessions table but have none of these).
function isValdSession(s){return s.peak_power!=null||s.rsi_mod!=null||s.takeoff_velocity!=null||s.conc_impulse!=null;}

return Object.defineProperties({}, {
  SESSIONS: {enumerable:true, configurable:true, get:()=>SESSIONS, set:value=>{SESSIONS=value;}},
  fetchAllRows: {enumerable:true, configurable:true, get:()=>fetchAllRows},
  loadAllSessions: {enumerable:true, configurable:true, get:()=>loadAllSessions},
  KPI_HISTORY: {enumerable:true, configurable:true, get:()=>KPI_HISTORY, set:value=>{KPI_HISTORY=value;}},
  loadKpiHistory: {enumerable:true, configurable:true, get:()=>loadKpiHistory},
  logKpiHistory: {enumerable:true, configurable:true, get:()=>logKpiHistory},
  isValdSession: {enumerable:true, configurable:true, get:()=>isValdSession}
});
}
