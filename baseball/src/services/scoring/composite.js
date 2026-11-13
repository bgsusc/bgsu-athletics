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
/* ═══════════════════════════════════════════════════════════════
   DATA MODEL — BGSU BASEBALL
═══════════════════════════════════════════════════════════════ */
// Started from the Hockey app; every metric below has its real baseball meaning.
const POSITIONS = ['P','C','IF','OF'];

const CLASS_YEARS = ['Fr','So','Jr','Sr','5Y'];

// Map any common position spelling to P / C / IF / OF (null if unrecognised).
function normPos(raw){
  const t=String(raw||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(!t) return null;
  if(POSITIONS.includes(t)) return t;
  if(/^(RHP|LHP|SP|RP|CP|PITCHER|PITCHERS)$/.test(t)) return 'P';
  if(/^(CATCHER|CATCHERS)$/.test(t)) return 'C';
  if(/^(1B|2B|3B|SS|MI|CI|INF|INFIELD|INFIELDER|INFIELDERS|UT|UTIL|UTILITY)$/.test(t)) return 'IF';
  if(/^(LF|CF|RF|OUTFIELD|OUTFIELDER|OUTFIELDERS)$/.test(t)) return 'OF';
  return null;
}

const POS_FULL = {P:'Pitcher',C:'Catcher',IF:'Infield',OF:'Outfield'};

const TIERS = ['Elite','Advanced','Proficient','Developing'];

const TIER_CLASS_MAP = {Elite:'t-E',Advanced:'t-A',Proficient:'t-P',Developing:'t-D'};

const TIER_COLORS = {Elite:'#FCD34D',Advanced:'#FE5000',Proficient:'#60A5FA',Developing:'#6A5646'};

const TEST_BLOCKS = ['Aug Pre','Sep Early','Oct Mid','Nov Late','Jan Pre','Mar End'];

// Position norms: [low, high] = 0 and 100 on the composite scale (reversed for times,
// where low = fastest). ALL VALUES ARE PLACEHOLDER ESTIMATES for a college roster;
// there is no BGSU baseball history yet. Tighten them once real testing and
// Trackman data exist (e.g. the roster's 10th-90th percentile per position).
const VALD = {peakPower:[2400,4800],rsi:[0.30,0.60],asymmetry:[2,14],eccRFD:[2200,4400],concImpulse:[170,260],eccImpulse:[150,235],contractionTime:[600,780]};
const HIT  = {maxExitVelo:[95,108],avgExitVelo:[80,92],maxDistance:[340,420],hardHitPct:[25,55],sweetSpotPct:[25,45]};
const PITCH= {maxPitchVelo:[86,95],avgFbVelo:[84,92],avgSpinRate:[2100,2500],avgExtension:[5.6,6.6]};
const NORMS = {
  P:  {broadJump:[100,116],cmjHeight:[26,34],sixtyYard:[6.9,7.6],split10:[1.60,1.75],fly10:[1.05,1.20],homeToFirst:[4.30,4.80],frontSquatMax:[225,315],trapBarMax:[365,495],medBallVelo:[34,44],benchMax:[185,265],...VALD,...HIT,...PITCH},
  C:  {broadJump:[96,110], cmjHeight:[24,32],sixtyYard:[7.0,7.7],split10:[1.62,1.78],fly10:[1.08,1.22],homeToFirst:[4.40,4.90],frontSquatMax:[245,335],trapBarMax:[405,535],medBallVelo:[34,44],benchMax:[205,285],...VALD,...HIT,...PITCH},
  IF: {broadJump:[100,116],cmjHeight:[27,35],sixtyYard:[6.7,7.3],split10:[1.55,1.70],fly10:[1.00,1.14],homeToFirst:[4.15,4.55],frontSquatMax:[235,325],trapBarMax:[385,515],medBallVelo:[35,45],benchMax:[195,275],...VALD,...HIT,...PITCH},
  OF: {broadJump:[102,118],cmjHeight:[28,36],sixtyYard:[6.5,7.1],split10:[1.52,1.66],fly10:[0.96,1.10],homeToFirst:[4.05,4.45],frontSquatMax:[235,325],trapBarMax:[385,515],medBallVelo:[35,45],benchMax:[195,275],...VALD,...HIT,...PITCH},
};

const ALL_METRICS = [
  // Performance testing
  {key:'broadJump',     label:'Broad Jump',           unit:"",    max:130, hb:true,  fmt:v=>context.api.inToFtIn(v), color:'#FE5000', group:'jump'},
  {key:'cmjHeight',     label:'Vertical Jump',        unit:'in',  max:40,  hb:true,  fmt:v=>v.toFixed(1), color:'#FCD34D', group:'jump'},
  {key:'sixtyYard',     label:'60-yd Dash',           unit:'s',   max:8.5, hb:false, fmt:v=>v.toFixed(2), color:'#FB923C', group:'speed'},
  {key:'split10',       label:'10-yd Split',          unit:'s',   max:2.0, hb:false, fmt:v=>v.toFixed(2), color:'#a78bfa', group:'speed'},
  {key:'fly10',         label:'10-yd Fly',            unit:'s',   max:1.5, hb:false, fmt:v=>v.toFixed(2), color:'#C084FC', group:'speed'},
  {key:'homeToFirst',   label:'Home to 1st',          unit:'s',   max:5.5, hb:false, fmt:v=>v.toFixed(2), color:'#F472B6', group:'speed'},
  {key:'frontSquatMax', label:'Front Squat (1RM)',    unit:'lbs', max:450, hb:true,  fmt:v=>Math.round(v),color:'#34D399', group:'strength'},
  {key:'trapBarMax',    label:'Trap Bar DL (1RM)',    unit:'lbs', max:650, hb:true,  fmt:v=>Math.round(v),color:'#34D399', group:'strength'},
  {key:'benchMax',      label:'Bench Press (1RM)',    unit:'lbs', max:350, hb:true,  fmt:v=>Math.round(v),color:'#22C55E', group:'strength'},
  {key:'medBallVelo',   label:'Med Ball Velo',        unit:'mph', max:55,  hb:true,  fmt:v=>v.toFixed(1), color:'#2DD4BF', group:'strength'},
  // VALD Force Plate
  {key:'peakPower',     label:'Peak Power',           unit:'W',   max:5500,hb:true,  fmt:v=>Math.round(v), color:'#60A5FA', group:'vald'},
  {key:'rsi',           label:'RSI-Modified',         unit:'',    max:0.65,hb:true,  fmt:v=>v.toFixed(3), color:'#4ADE80', group:'vald'},
  {key:'asymmetry',     label:'Limb Asymmetry',       unit:'%',   max:20,  hb:false, fmt:v=>v.toFixed(1), color:'#F87171', group:'vald'},
  {key:'eccRFD',        label:'Eccentric RFD',        unit:'N/s', max:4800,hb:true,  fmt:v=>Math.round(v),color:'#CDA077', group:'vald'},
  {key:'concImpulse',   label:'Concentric Impulse',   unit:'N·s', max:260, hb:true,  fmt:v=>Math.round(v),color:'#38BDF8', group:'vald'},
  {key:'eccImpulse',    label:'Eccentric Impulse',    unit:'N·s', max:240, hb:true,  fmt:v=>Math.round(v),color:'#A78BFA', group:'vald'},
  {key:'contractionTime',label:'Contraction Time',    unit:'ms',  max:820, hb:false, fmt:v=>Math.round(v),color:'#94A3B8', group:'vald'},
  {key:'takeoffVelocity',label:'Takeoff Velocity',    unit:'m/s', max:4.5, hb:true,  fmt:v=>v.toFixed(2), color:'#F472B6', group:'vald'},
  {key:'concImpulseAsym',label:'Conc Impulse Asym',   unit:'%',   max:20,  hb:false, fmt:v=>v.toFixed(1), color:'#FCA5A5', group:'vald'},
  {key:'eccBrakingAsym', label:'Ecc Braking Asym',    unit:'%',   max:20,  hb:false, fmt:v=>v.toFixed(1), color:'#FBBF24', group:'vald'},
  // Trackman hitting (computed from raw Trackman rows; never stored on the athlete row)
  {key:'maxExitVelo',   label:'Max Exit Velo',        unit:'mph', max:115, hb:true,  fmt:v=>v.toFixed(1), color:'#FE5000', group:'tm_hit'},
  {key:'avgExitVelo',   label:'Avg Exit Velo',        unit:'mph', max:100, hb:true,  fmt:v=>v.toFixed(1), color:'#FB923C', group:'tm_hit'},
  {key:'avgLaunchAngle',label:'Avg Launch Angle',     unit:'°',   max:40,  hb:true,  fmt:v=>v.toFixed(1), color:'#FCD34D', group:'tm_hit'},
  {key:'maxDistance',   label:'Max Distance',         unit:'ft',  max:450, hb:true,  fmt:v=>Math.round(v),color:'#FDE68A', group:'tm_hit'},
  {key:'hardHitPct',    label:'Hard-Hit % (95+)',     unit:'%',   max:80,  hb:true,  fmt:v=>v.toFixed(0), color:'#F87171', group:'tm_hit'},
  {key:'sweetSpotPct',  label:'Sweet-Spot % (8-32°)', unit:'%',   max:70,  hb:true,  fmt:v=>v.toFixed(0), color:'#4ADE80', group:'tm_hit'},
  {key:'avgBattedSpin', label:'Avg Batted-Ball Spin', unit:'rpm', max:4000,hb:true,  fmt:v=>Math.round(v),color:'#94A3B8', group:'tm_hit'},
  // Trackman pitching (fastball = TaggedPitchType Fastball/Four-Seam/Two-Seam/Sinker)
  {key:'maxPitchVelo',  label:'Max FB Velo',          unit:'mph', max:100, hb:true,  fmt:v=>v.toFixed(1), color:'#60A5FA', group:'tm_pitch'},
  {key:'avgFbVelo',     label:'Avg FB Velo',          unit:'mph', max:100, hb:true,  fmt:v=>v.toFixed(1), color:'#38BDF8', group:'tm_pitch'},
  {key:'avgSpinRate',   label:'Avg FB Spin',          unit:'rpm', max:2900,hb:true,  fmt:v=>Math.round(v),color:'#A78BFA', group:'tm_pitch'},
  {key:'avgIVB',        label:'Avg FB Induced Vert',  unit:'in',  max:24,  hb:true,  fmt:v=>v.toFixed(1), color:'#C084FC', group:'tm_pitch'},
  {key:'avgHB',         label:'Avg FB Horz Break',    unit:'in',  max:24,  hb:true,  fmt:v=>v.toFixed(1), color:'#F472B6', group:'tm_pitch'},
  {key:'avgExtension',  label:'Avg Extension',        unit:'ft',  max:7.5, hb:true,  fmt:v=>v.toFixed(2), color:'#2DD4BF', group:'tm_pitch'},
  {key:'avgRelHeight',  label:'Avg Release Height',   unit:'ft',  max:7.5, hb:true,  fmt:v=>v.toFixed(2), color:'#94A3B8', group:'tm_pitch'},
  // Composite
  {key:'composite',     label:'Composite Score',      unit:'',    max:100, hb:true,  fmt:v=>String(v),    color:'#FE5000', group:'score'},
];


function rnd(a,b){return Math.round(Math.random()*(b-a)+a);}


function rndf(a,b,d=1){return parseFloat((Math.random()*(b-a)+a).toFixed(d));}


function avCls(i){return ['a0','a1','a2','a3','a4','a5'][i%6];}


const NAMES = [];

// Sample data removed — all athletes load from Supabase
const APPROACH_JUMP_FRESHNESS_MONTHS = 6;

// An athlete's approach jump only "counts" (for display, ranking, and the
// composite score) if it was set within the last N months. If there's no
// recorded date at all (older/manual entries, imported before date-tracking
// existed), it's treated as current rather than hidden — per team decision,
// since we can't actually tell how old it is.
function isApproachJumpFresh(a){
  // Broad Jump has no staleness window — always "fresh" if a value exists.
  return a.broadJump!=null;
}

// Precomputed per-athlete display value: the approach jump number to actually
// show/rank/score with, or null if it's aged out. Call refreshApproachJumpFreshness()
// after any data change so this stays in sync — cheap, safe to call often.
function refreshApproachJumpFreshness(){
  for(const a of context.api.ATHLETES){
    const fresh=isApproachJumpFresh(a);
    a._broadJumpFresh = fresh ? a.broadJump : null;
    a._broadJumpStale = a.broadJump!=null && !fresh; // has a value, but it's too old to show
  }
}

// ── Composite score: fixed standards ──────────────────────────────
// Each metric is graded against the fixed ranges in NORMS.F (team-wide, not by
// position): 0 at the low end, 100 at the high end, reversed for times. These
// are the same standards the dashboard's original scores were built on.
// Because the ranges never move, a player's score only changes when his own
// numbers change: it never depends on teammates or on when the page loaded.
// Metrics with no data are skipped.
const COMPOSITE_NORMS = NORMS.IF; // team-wide reference range (position-specific scoring uses NORMS[pos])


// Shown but not scored: no single 'better' direction, or descriptive only.
const COMPOSITE_EXCLUDE = ['asymmetry','concImpulseAsym','rsi','avgLaunchAngle','avgBattedSpin','avgIVB','avgHB','avgRelHeight'];


function getTeamNormRange(metricKey){ return COMPOSITE_NORMS[metricKey]||null; }

// ── Rapid-drop check ─────────────────────────────────────────────
// The standards above put most of the roster at the top of the power and bench
// ranges, and tested metrics keep each player's best result, so on their own
// they can't show a decline. So each category is also checked against the
// player's OWN Fall 2026 number. Inside normal variation nothing changes; past
// DROP_START that category's credit shrinks, reaching zero at DROP_FULL.
//  - Peak power is NOT checked: the composite uses each player's best force
//    plate result of the academic year, so in-season testing can't hurt it.
//  - Tested metrics: his most recent retest vs his best Aug-Sep 2026 result
//    (nothing happens until there is a retest after September).
const FALL_BASELINE_FROM = '2026-08-01';


const FALL_BASELINE_TO   = '2026-09-30';


const DROP_RULES = {
  // [drop where credit starts shrinking, drop where the category is lost]
  default:  [0.05, 0.15],  // 5% worse -> starts; 15% worse -> zero credit
  split10:    [0.02, 0.06],  // times: 2% slower -> starts; 6% slower -> zero
  sixtyYard:  [0.02, 0.06],
  fly10:      [0.02, 0.06],
  homeToFirst:[0.02, 0.06],
};


function compositeDropFor(a, key, m){
  try{
    const name=a._canonicalName||a.name;
    let base=null, latest=null, latestDate=null;
    if(key==='peakPower'){
      return null; // force plate never lowers the composite (best of the academic year is used)
      if(typeof context.api.sessionsForAthlete!=='function') return null;
      const rows=context.api.sessionsForAthlete(name)
        .filter(s=>s.peak_power!=null&&!isNaN(s.peak_power)&&s.peak_power>=800&&s.peak_power<=7500)
        .sort((x,y)=>y.test_date.localeCompare(x.test_date));
      const fall=rows.filter(s=>s.test_date>='2026-09-01'&&s.test_date<=FALL_BASELINE_TO);
      const last3=rows.slice(0,3);
      if(!fall.length||last3.length<3||last3[last3.length-1].test_date<=FALL_BASELINE_TO) return null;
      const fv=fall.map(r=>r.peak_power).sort((x,y)=>x-y), mid=Math.floor(fv.length/2);
      base=fv.length%2?fv[mid]:(fv[mid-1]+fv[mid])/2; // September MEDIAN: one bad or junk test can't skew it
      latest=last3.reduce((s,r)=>s+r.peak_power,0)/3;
      latestDate=last3[0].test_date;
    } else {
      if(typeof context.api.histFor!=='function'||typeof context.api.KPI_HISTORY==='undefined'||!context.api.KPI_HISTORY.length) return null;
      const hist=context.api.histFor(a,key).filter(r=>r.value!=null&&!isNaN(r.value));
      if(!hist.length) return null;
      const fall=hist.filter(r=>r.test_date>=FALL_BASELINE_FROM&&r.test_date<=FALL_BASELINE_TO);
      const after=hist.filter(r=>r.test_date>FALL_BASELINE_TO).sort((x,y)=>y.test_date.localeCompare(x.test_date));
      if(!fall.length||!after.length) return null;
      base=fall.reduce((b,r)=>m.hb?Math.max(b,r.value):Math.min(b,r.value), m.hb?-Infinity:Infinity);
      latest=after[0].value; latestDate=after[0].test_date;
    }
    if(!(base>0)) return null;
    const drop=m.hb?(base-latest)/base:(latest-base)/base; // positive = worse
    const [start,full]=DROP_RULES[key]||DROP_RULES.default;
    const factor=1-Math.max(0,Math.min(1,(drop-start)/(full-start)));
    return {factor, drop, base, latest, latestDate};
  }catch(e){ return null; }
}


function calcCompositeVB(a){
  const scores=[];
  const drops=[];
  // Pitchers are scored on pitching, everyone else on hitting (two-way players: primary position).
  const skipGroup=a.pos==='P'?'tm_hit':'tm_pitch';
  const norms=NORMS[a.pos]||COMPOSITE_NORMS;
  const mets=ALL_METRICS.filter(m=>m.group!=='score'&&m.group!==skipGroup&&!COMPOSITE_EXCLUDE.includes(m.key));
  for(const m of mets){
    const range=norms[m.key]; if(!range) continue;
    const v=a[m.key];
    if(v===null||v===undefined||isNaN(v)) continue;
    const [lo,hi]=range;
    if(hi===lo) continue;
    let s=Math.max(0,Math.min(1,m.hb?(v-lo)/(hi-lo):(1-(v-lo)/(hi-lo))));
    const d=compositeDropFor(a,m.key,m);
    if(d&&d.factor<1){
      const before=s; s*=d.factor;
      drops.push({key:m.key,label:m.label,pct:d.drop*100,lost:before-s});
    }
    scores.push(s);
  }
  a._compositeDrops=drops;
  if(!scores.length) return 0;
  return Math.round(scores.reduce((x,y)=>x+y,0)/scores.length*100);
}

// Re-score everyone. Call AFTER all data is merged (session power, best
// recent values) so the score always reflects what the dashboard shows.
function rescoreAllAthletes(){
  for(const a of context.api.ATHLETES){
    a.composite=calcCompositeVB(a);
    a.tier=calcTier(a.composite);
    if(Array.isArray(a.trend)&&a.trend.length) a.trend[a.trend.length-1]=a.composite;
  }
}




function calcTier(s){return s>=80?'Elite':s>=63?'Advanced':s>=45?'Proficient':'Developing';}



return Object.defineProperties({}, {
  POSITIONS: {enumerable:true, configurable:true, get:()=>POSITIONS},
  CLASS_YEARS: {enumerable:true, configurable:true, get:()=>CLASS_YEARS},
  normPos: {enumerable:true, configurable:true, get:()=>normPos},
  POS_FULL: {enumerable:true, configurable:true, get:()=>POS_FULL},
  TIERS: {enumerable:true, configurable:true, get:()=>TIERS},
  TIER_CLASS_MAP: {enumerable:true, configurable:true, get:()=>TIER_CLASS_MAP},
  TIER_COLORS: {enumerable:true, configurable:true, get:()=>TIER_COLORS},
  TEST_BLOCKS: {enumerable:true, configurable:true, get:()=>TEST_BLOCKS},
  NORMS: {enumerable:true, configurable:true, get:()=>NORMS},
  ALL_METRICS: {enumerable:true, configurable:true, get:()=>ALL_METRICS},
  rnd: {enumerable:true, configurable:true, get:()=>rnd},
  rndf: {enumerable:true, configurable:true, get:()=>rndf},
  avCls: {enumerable:true, configurable:true, get:()=>avCls},
  NAMES: {enumerable:true, configurable:true, get:()=>NAMES},
  APPROACH_JUMP_FRESHNESS_MONTHS: {enumerable:true, configurable:true, get:()=>APPROACH_JUMP_FRESHNESS_MONTHS},
  isApproachJumpFresh: {enumerable:true, configurable:true, get:()=>isApproachJumpFresh},
  refreshApproachJumpFreshness: {enumerable:true, configurable:true, get:()=>refreshApproachJumpFreshness},
  COMPOSITE_NORMS: {enumerable:true, configurable:true, get:()=>COMPOSITE_NORMS},
  COMPOSITE_EXCLUDE: {enumerable:true, configurable:true, get:()=>COMPOSITE_EXCLUDE},
  getTeamNormRange: {enumerable:true, configurable:true, get:()=>getTeamNormRange},
  FALL_BASELINE_FROM: {enumerable:true, configurable:true, get:()=>FALL_BASELINE_FROM},
  FALL_BASELINE_TO: {enumerable:true, configurable:true, get:()=>FALL_BASELINE_TO},
  DROP_RULES: {enumerable:true, configurable:true, get:()=>DROP_RULES},
  compositeDropFor: {enumerable:true, configurable:true, get:()=>compositeDropFor},
  calcCompositeVB: {enumerable:true, configurable:true, get:()=>calcCompositeVB},
  rescoreAllAthletes: {enumerable:true, configurable:true, get:()=>rescoreAllAthletes},
  calcTier: {enumerable:true, configurable:true, get:()=>calcTier}
});
}
