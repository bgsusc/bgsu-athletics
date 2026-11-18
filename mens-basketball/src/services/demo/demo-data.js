// 100% synthetic Men's Basketball demo dataset. No real athlete, name, or measurement is
// used. Values are generated from a fixed seed inside plausible college ranges, with
// dates relative to "today" so the recency windows stay populated.
import {DEMO_AVATAR} from './demo-avatar.js';
function prng(seed){let t=seed>>>0;return()=>{t+=0x6D2B79F5;let r=Math.imul(t^t>>>15,1|t);r^=r+Math.imul(r^r>>>7,61|r);return((r^r>>>14)>>>0)/4294967296;};}
const iso=(today,daysAgo)=>new Date(today.getTime()-daysAgo*86400000).toISOString().slice(0,10);
const lerp=(lo,hi,q)=>lo+(hi-lo)*q;
const cl=v=>Math.min(1,Math.max(0,v));

// Names are placeholders on purpose: "Demo <Position> <Word>".
export const DEMO_ROSTER=[
  ['G',0.84,'Sr'],['G',0.73,'Jr'],['G',0.64,'Jr'],['G',0.55,'So'],['G',0.45,'Fr'],['G',0.36,'Fr'],
  ['F',0.80,'Sr'],['F',0.67,'Jr'],['F',0.57,'So'],['F',0.47,'So'],['F',0.38,'Fr'],
  ['C',0.76,'Sr'],['C',0.60,'Jr'],['C',0.48,'So'],['C',0.40,'Fr'],
];
// Names carry NO digits: the app's identity normalisation (normName) strips digits, so
// "Demo Guard 01" and "Demo Guard 02" would be merged into one athlete by dedupe.
const SUFFIX=['Alpha','Bravo','Charlie','Delta','Echo','Foxtrot'];
export const DEMO_WORD={G:'Guard',F:'Forward',C:'Center'};
// Intentionally incomplete records (indexes into DEMO_ROSTER) for missing-data handling.
const NO_FORCE_PLATE=new Set([5,13]);   // no VALD sessions or force-plate fields
const NO_STRENGTH=new Set([4]);         // no lift tests
const NO_SPEED=new Set([10]);           // no sprint, agility or mile
const NO_TESTING=new Set([14]);         // nothing but a name and position

export function buildDemoTables(today=new Date()) {
  const rnd=prng(20261118);
  const athletes=[],sessions=[],history=[];
  let sid=1,hid=1;
  const counts={G:0,F:0,C:0};
  DEMO_ROSTER.forEach(([pos,q,yr],i)=>{
    const n=++counts[pos];
    const name=`Demo ${DEMO_WORD[pos]} ${SUFFIX[n-1]}`;
    const j=(spread=0.08)=>q+(rnd()-0.5)*spread*2;
    const latest=iso(today,4+i%5);
    const row={
      id:i+1,canonical_name:name,display_name:name,initials:`D${pos}${n}`,pos,yr,age:18+['Fr','So','Jr','Sr'].indexOf(yr)+Math.floor(rnd()*2),av:`a${i%6}`,
      photo_url:DEMO_AVATAR,name_locked:true,pos_locked:true,archived:false,sources:[{file:'demo-synthetic.csv',date:iso(today,5),keys:['approachJump','cmjHeight','courtSprint']}],
      trend:Array.from({length:6},(_,k)=>Math.round(30+q*45+k*2+(rnd()-0.5)*6)),
    };
    const set=(col,val)=>{row[col]=val;row[col+'_date']=latest;};
    const none=NO_TESTING.has(i);
    const big=pos==='C'?-0.12:pos==='F'?-0.05:0;   // centers jump/run a little lower/slower
    if(!none){set('approach_jump',+lerp(28,41,cl(j()+big)).toFixed(1));set('cmj_height',+lerp(23,34,cl(j()+big)).toFixed(1));}
    if(!none&&!NO_SPEED.has(i)){
      set('court_sprint',+lerp(3.62,3.12,cl(j()+big)).toFixed(2));
      set('lane_agility',+lerp(12.3,10.6,cl(j()+big)).toFixed(2));
      set('mile_run',Math.round(lerp(465,330,cl(j()+big))));
    }
    if(!none&&!NO_STRENGTH.has(i)){
      set('front_squat_max',Math.round(lerp(205,325,cl(j()-big))/5)*5);
      set('bench_max',Math.round(lerp(185,295,cl(j()-big))/5)*5);
    }
    if(!NO_FORCE_PLATE.has(i)&&!none){
      row.peak_power=Math.round(lerp(3300,6200,cl(j()-big)));row.rsi=+lerp(0.36,0.70,cl(j())).toFixed(3);
      row.asymmetry=+lerp(13,2.5,cl(j(0.15))).toFixed(1);row.ecc_rfd=Math.round(lerp(2700,5200,cl(j())));
      row.conc_impulse=Math.round(lerp(225,330,cl(j()-big)));row.ecc_impulse=Math.round(lerp(195,300,cl(j()-big)));row.contraction_time=Math.round(lerp(760,590,cl(j())));
    }
    athletes.push(row);

    // Dated testing history (4 testing blocks) trending up to the current value.
    const tracked=[['approachJump','approach_jump',false],['cmjHeight','cmj_height',false],['courtSprint','court_sprint',true],
      ['laneAgility','lane_agility',true],['mileRun','mile_run',true],['frontSquatMax','front_squat_max',false],['benchMax','bench_max',false]];
    for(const [key,col,lowerBetter] of tracked){
      if(row[col]==null)continue;
      [150,100,50,0].forEach((ago,k)=>{
        const f=(3-k)*0.02;                    // earlier blocks were weaker/slower
        history.push({id:hid++,athlete_name:name,metric_key:key,test_date:iso(today,Math.max(ago,4+i%5)),value:+(row[col]*(lowerBetter?1+f:1-f)).toFixed(3),source:'demo-synthetic'});
      });
    }

    // Weekly VALD force-plate jumps (10 weeks) — absent for incomplete records.
    if(!NO_FORCE_PLATE.has(i)&&!none){
      for(let k=0;k<10;k++){
        const date=iso(today,1+i%3+k*7);const drift=1-k*0.008;
        const miss=(k===3&&i%4===1);                  // an occasional half-empty session
        sessions.push({id:sid++,athlete_name:name,test_date:date,session_type:'CMJ',
          jump_height:+(lerp(15,21,cl(j(0.1)))*drift).toFixed(1),
          peak_power:miss?null:Math.round(row.peak_power*drift*(1+(rnd()-0.5)*0.05)),
          rsi_mod:+(row.rsi*drift).toFixed(3),takeoff_velocity:+lerp(2.5,3.3,cl(j())).toFixed(2),
          conc_impulse:Math.round(row.conc_impulse*drift),ecc_impulse:Math.round(row.ecc_impulse*drift),ecc_rfd:miss?null:Math.round(row.ecc_rfd*drift),
          contraction_time:Math.round(row.contraction_time/drift),asymmetry:row.asymmetry,conc_impulse_asym:+lerp(3,9,rnd()).toFixed(1),ecc_braking_asym:+lerp(3,10,rnd()).toFixed(1)});
      }
    }
  });
  return {athletes,test_sessions:sessions,kpi_history:history,audit_log:[
    {id:1,changed_at:new Date(today.getTime()-3600e3).toISOString(),athlete_name:athletes[0].canonical_name,action:'update',changed_by:'demo@synthetic.invalid',changed_fields:{fields:['demo (synthetic entry)']}},
  ]};
}
