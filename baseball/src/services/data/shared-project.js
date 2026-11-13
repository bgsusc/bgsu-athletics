// Baseball lives inside a Supabase project it shares with other sports. Its tables
// carry a "bb_" prefix and it has its own photo bucket, so it can never read or
// write another sport's data even by accident (RLS enforces access per sport too).
// The rest of the app keeps using plain table names ("athletes", "test_sessions"...);
// this wrapper translates them on the real client only. Demo Mode is unaffected.
export const SPORT='baseball';
export const TABLES={
  athletes:'bb_athletes', test_sessions:'bb_test_sessions', kpi_history:'bb_kpi_history',
  trackman_pitches:'bb_trackman_pitches', audit_log:'bb_audit_log',
};
export const BUCKETS={'athlete-photos':'baseball-photos'};

const mapTable=t=>{
  if(Object.hasOwn(TABLES,t)) return TABLES[t];
  throw new Error(`Baseball has no "${t}" table in the shared project`);
};

export function sharedProjectClient(client){
  const storage=client.storage&&new Proxy(client.storage,{get(target,prop){
    if(prop==='from') return bucket=>target.from(BUCKETS[bucket]||bucket);
    const v=Reflect.get(target,prop);return typeof v==='function'?v.bind(target):v;
  }});
  const wrapChannel=channel=>new Proxy(channel,{get(target,prop){
    if(prop==='on') return (type,filter,cb)=>wrapChannel(target.on(type,filter&&filter.table?{...filter,table:mapTable(filter.table)}:filter,cb));
    const v=Reflect.get(target,prop);return typeof v==='function'?v.bind(target):v;
  }});
  return new Proxy(client,{get(target,prop){
    if(prop==='from') return table=>target.from(mapTable(table));
    if(prop==='storage') return storage;
    if(prop==='channel') return (...args)=>wrapChannel(target.channel(...args));
    const v=Reflect.get(target,prop);return typeof v==='function'?v.bind(target):v;
  }});
}

// True when the signed-in user has been granted this sport (private.sport_access).
export async function hasSportAccess(client){
  const {data,error}=await client.rpc('my_sports');
  if(error) throw error;
  return Array.isArray(data)&&data.includes(SPORT);
}
