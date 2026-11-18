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
let _cloudDataLoaded=false;
// ── Cloud → Local: load all athletes ─────────────────────────────
async function loadAllAthletes(){
  try{
    const {data, error} = await context.api.sb.from('athletes').select('*');
    if(error) throw error;
    if(!data||!data.length){
      console.log('Cloud roster empty. Using sample data until you import.');
      return;
    }
    // Clear sample data and replace with cloud roster
    context.api.ATHLETES = data.map((r,i)=>dbRowToAthlete(r,i)).filter(a=>!context.api.isFormerPlayer(a._canonicalName||a.name));
    context.api.dedupeATHLETES();
    context.api.ATHLETES = context.api.ATHLETES.map((a,i)=>({...a,id:i}));
    context.api.refreshApproachJumpFreshness();
    Object.keys(context.api.CH).forEach(k=>context.api.kc(k));
    _cloudDataLoaded = true;
    // Re-render immediately so dashboard populates with real data
    const ap=document.querySelector('.page.active');
    if(ap) context.navigate(ap.id.replace('page-',''));
  } catch(e){
    console.error('Load failed:',e);
    context.api.setSyncStatus('error','LOAD FAILED');
    context.api.toast('⚠ Could not load cloud roster: '+e.message);
  }
}

// ── Field mapping: athlete object ↔ database row ─────────────────
const DB_FIELDS = {
  // local key → db column
  _canonicalName:'canonical_name', name:'display_name', initials:'initials',
  pos:'pos', yr:'yr', age:'age', av:'av',
  _nameLocked:'name_locked', _posLocked:'pos_locked',
  approachJump:'approach_jump', cmjHeight:'cmj_height', courtSprint:'court_sprint', laneAgility:'lane_agility',
  peakPower:'peak_power', rsi:'rsi', asymmetry:'asymmetry', eccRFD:'ecc_rfd',
  concImpulse:'conc_impulse', eccImpulse:'ecc_impulse', contractionTime:'contraction_time',
  composite:'composite', tier:'tier',
  trend:'trend', _sources:'sources',
  photo_url:'photo_url',
  mileRun:'mile_run',
  frontSquatMax:'front_squat_max',
  benchMax:'bench_max',
  mileRunDate:'mile_run_date',
  frontSquatMaxDate:'front_squat_max_date',
  benchMaxDate:'bench_max_date',
  courtSprintDate:'court_sprint_date',
  approachJumpDate:'approach_jump_date',
  cmjHeightDate:'cmj_height_date',
  laneAgilityDate:'lane_agility_date',
  _archived:'archived',
};


const REVERSE_DB_FIELDS=Object.fromEntries(Object.entries(DB_FIELDS).map(([k,v])=>[v,k]));


function athleteToDbRow(a){
  const row={};
  for(const [localKey,dbCol] of Object.entries(DB_FIELDS)){
    // Allow explicit null for photo_url (so removals sync), skip null/undefined for others
    if(localKey==='photo_url'){
      if(a[localKey]!==undefined) row[dbCol]=a[localKey]; // explicit null is ok
    } else if(a[localKey]!==undefined&&a[localKey]!==null){
      row[dbCol]=a[localKey];
    }
  }
  row.canonical_name = a._canonicalName||a.name;
  row.updated_by = context.api.currentUser?.email||'unknown';
  return row;
}


function dbRowToAthlete(r,idx){
  const a={id:idx, _dbId:r.id};
  for(const [dbCol,localKey] of Object.entries(REVERSE_DB_FIELDS)){
    if(r[dbCol]!==undefined&&r[dbCol]!==null) a[localKey]=r[dbCol];
  }
  // Restore display name fallback
  if(!a.name) a.name=a._canonicalName;
  if(!a.initials){
    const parts=(a._canonicalName||a.name||'').split(' ');
    a.initials=(parts[0]?.[0]||'?')+(parts[parts.length-1]?.[0]||'');
  }
  if(!a.av) a.av=context.api.avCls(idx);
  if(!a.pos) a.pos='F'; // default position if missing
  // Recalculate composite from current data (stored value may be stale or missing)
  a.composite=context.api.calcCompositeVB(a);
  a.tier=context.api.calcTier(a.composite);
  if(!a.trend||!Array.isArray(a.trend)) a.trend=context.api.TEST_BLOCKS.map(()=>a.composite||50);
  if(!a._sources||!Array.isArray(a._sources)) a._sources=[];
  return a;
}

// ── Local → Cloud: save changes (debounced) ──────────────────────
let saveTimer=null;


const pendingSaves=new Set();

// canonical names to sync
function queueSaveAll(){
  // Save entire roster
  context.api.ATHLETES.forEach(a=>pendingSaves.add(a._canonicalName||a.name));
  scheduleSave();
}


function queueSave(athleteOrCanonical){
  const canonical=typeof athleteOrCanonical==='string' ? athleteOrCanonical : (athleteOrCanonical._canonicalName||athleteOrCanonical.name);
  if(canonical) pendingSaves.add(canonical);
  scheduleSave();
}


function scheduleSave(){
  if(!context.api.sb||!context.api.currentUser) return; // not logged in yet
  if(saveTimer) clearTimeout(saveTimer);
  context.api.setSyncStatus('syncing','SAVING');
  saveTimer=setTimeout(flushPendingSaves, 1000);
}


async function flushPendingSaves(){
  if(!context.api.sb||!context.api.currentUser||context.api.syncing) return;
  if(!pendingSaves.size){context.api.setSyncStatus('online','SYNCED');return;}
  context.api.syncing=true;context.api.isLocalChange=true;
  const namesToSave=[...pendingSaves];
  pendingSaves.clear();
  try{
    const athletesToSave=context.api.ATHLETES.filter(a=>namesToSave.includes(a._canonicalName||a.name));

    // Manual upsert: for each athlete, update if _dbId exists, otherwise check if canonical_name already exists, otherwise insert
    const savedRows=[];
    for(const ath of athletesToSave){
      const row=athleteToDbRow(ath);
      const canonical=row.canonical_name;
      if(!canonical){continue;}

      let result;
      if(ath._dbId){
        // We know the DB id — direct update
        result=await context.api.sb.from('athletes').update(row).eq('id',ath._dbId).select().single();
      } else {
        // Look for an existing row with this canonical name
        const {data:existing}=await context.api.sb.from('athletes').select('id').ilike('canonical_name',canonical).maybeSingle();
        if(existing){
          // Update existing
          result=await context.api.sb.from('athletes').update(row).eq('id',existing.id).select().single();
          ath._dbId=existing.id;
        } else {
          // Insert new
          result=await context.api.sb.from('athletes').insert(row).select().single();
        }
      }

      if(result.error) throw result.error;
      if(result.data){
        ath._dbId=result.data.id;
        savedRows.push(result.data);
      }
    }

    // Audit log entries — batch insert, errors here are non-fatal
    if(savedRows.length){
      try{
        await context.api.sb.from('audit_log').insert(savedRows.map(r=>({
          athlete_id:r.id,
          athlete_name:r.canonical_name,
          action:'update',
          changed_fields:{fields:Object.keys(r).filter(k=>!['id','created_at','updated_at'].includes(k)).slice(0,10)},
          changed_by:context.api.currentUser.email,
        })));
      } catch(auditErr){
        console.warn('Audit log write failed (non-fatal):',auditErr);
      }
    }

    context.api.setSyncStatus('online','SYNCED');
  } catch(e){
    console.error('Save failed:',e);
    context.api.setSyncStatus('error','SAVE FAILED');
    context.api.toast('⚠ Sync failed: '+(e.message||e.hint||'unknown'));
    namesToSave.forEach(n=>pendingSaves.add(n));
  } finally {
    context.api.syncing=false;
    setTimeout(()=>{context.api.isLocalChange=false;},500);
  }
}

// ── Real-time: subscribe to changes from other coaches ───────────
let rtChannel=null;


function subscribeToChanges(){
  if(!context.api.sb) return;
  if(rtChannel) context.api.sb.removeChannel(rtChannel);
  rtChannel = context.api.sb.channel('athletes-changes')
    .on('postgres_changes',{event:'*',schema:'public',table:'athletes'},payload=>{
      if(context.api.isLocalChange) return; // ignore our own writes
      handleRemoteChange(payload);
    })
    .subscribe();
}


function handleRemoteChange(payload){
  if(payload.eventType==='DELETE'){
    context.api.ATHLETES=context.api.ATHLETES.filter(a=>a._dbId!==payload.old.id);
  } else {
    const a=dbRowToAthlete(payload.new,context.api.ATHLETES.length);
    const existing=context.api.ATHLETES.findIndex(x=>x._dbId===payload.new.id);
    if(existing>=0){a.id=context.api.ATHLETES[existing].id;context.api.ATHLETES[existing]=a;}
    else{context.api.ATHLETES.push(a);}
  }
  context.api.enrichAthletesFromSessions();
  context.api.applyBestRecentValues();
  context.api.rescoreAllAthletes();
  context.api.refreshAll();
  const active=document.querySelector('.page.active');
  if(active){context.navigate(active.id.replace('page-',''));}
  context.api.toast(`↻ Updated by ${payload.new?.updated_by||'another coach'}`);
}


async function deleteAthleteFromCloud(athlete){
  if(!context.api.sb||!context.api.currentUser||!athlete._dbId) return;
  context.api.isLocalChange=true;
  try{
    await context.api.sb.from('athletes').delete().eq('id',athlete._dbId);
    await context.api.sb.from('audit_log').insert({
      athlete_id:athlete._dbId,athlete_name:athlete._canonicalName||athlete.name,
      action:'delete',changed_by:context.api.currentUser.email,
    });
  } catch(e){console.error('Delete failed:',e);}
  setTimeout(()=>{context.api.isLocalChange=false;},500);
}

return Object.defineProperties({}, {
  loadAllAthletes: {enumerable:true, configurable:true, get:()=>loadAllAthletes},
  DB_FIELDS: {enumerable:true, configurable:true, get:()=>DB_FIELDS},
  REVERSE_DB_FIELDS: {enumerable:true, configurable:true, get:()=>REVERSE_DB_FIELDS},
  athleteToDbRow: {enumerable:true, configurable:true, get:()=>athleteToDbRow},
  dbRowToAthlete: {enumerable:true, configurable:true, get:()=>dbRowToAthlete},
  saveTimer: {enumerable:true, configurable:true, get:()=>saveTimer, set:value=>{saveTimer=value;}},
  pendingSaves: {enumerable:true, configurable:true, get:()=>pendingSaves},
  queueSaveAll: {enumerable:true, configurable:true, get:()=>queueSaveAll},
  queueSave: {enumerable:true, configurable:true, get:()=>queueSave},
  scheduleSave: {enumerable:true, configurable:true, get:()=>scheduleSave},
  flushPendingSaves: {enumerable:true, configurable:true, get:()=>flushPendingSaves},
  rtChannel: {enumerable:true, configurable:true, get:()=>rtChannel, set:value=>{rtChannel=value;}},
  subscribeToChanges: {enumerable:true, configurable:true, get:()=>subscribeToChanges},
  handleRemoteChange: {enumerable:true, configurable:true, get:()=>handleRemoteChange},
  deleteAthleteFromCloud: {enumerable:true, configurable:true, get:()=>deleteAthleteFromCloud},
  _cloudDataLoaded: {enumerable:true, configurable:true, get:()=>_cloudDataLoaded, set:value=>{_cloudDataLoaded=value;}}
});
}
