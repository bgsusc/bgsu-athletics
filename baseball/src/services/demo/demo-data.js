// 100% synthetic Baseball demo dataset. No real athlete, name, or measurement is
// used. Values are generated from a fixed seed inside plausible college ranges,
// with dates relative to "today" so the recency windows stay populated.
import {DEMO_AVATAR} from './demo-avatar.js';
function prng(seed){let t=seed>>>0;return()=>{t+=0x6D2B79F5;let r=Math.imul(t^t>>>15,1|t);r^=r+Math.imul(r^r>>>7,61|r);return((r^r>>>14)>>>0)/4294967296;};}
const iso=(today,daysAgo)=>new Date(today.getTime()-daysAgo*86400000).toISOString().slice(0,10);
const lerp=(lo,hi,q)=>lo+(hi-lo)*q;
const cl=v=>Math.min(1,Math.max(0,v));

// Names are placeholders on purpose: "Demo <Position> <Word>".
export const DEMO_ROSTER=[
  ['P',0.84,'Sr'],['P',0.72,'Jr'],['P',0.63,'Jr'],['P',0.55,'So'],['P',0.44,'Fr'],['P',0.36,'Fr'],
  ['C',0.70,'Jr'],['C',0.48,'So'],
  ['IF',0.80,'Sr'],['IF',0.68,'Jr'],['IF',0.58,'So'],['IF',0.46,'So'],['IF',0.35,'Fr'],
  ['OF',0.78,'Sr'],['OF',0.61,'Jr'],['OF',0.42,'Fr'],
];
// Names carry NO digits: the app's identity normalisation (normName) strips digits, so
// "Demo Pitcher 01" and "Demo Pitcher 02" would be merged into one athlete by dedupe.
const SUFFIX=['Alpha','Bravo','Charlie','Delta','Echo','Foxtrot'];
export const DEMO_WORD={P:'Pitcher',C:'Catcher',IF:'Infielder',OF:'Outfielder'};
// Intentionally incomplete records (indexes into DEMO_ROSTER) for missing-data handling.
const NO_FORCE_PLATE=new Set([5,12]);   // no VALD sessions or force-plate fields
const NO_STRENGTH=new Set([4]);         // no lift tests
const NO_SPEED=new Set([7]);            // no sprint tests
const NO_TESTING=new Set([15]);         // nothing but a name and position (and no Trackman)
const FEW_BBE=new Set([12]);            // only 3 batted balls: percentages stay blank
const UNTAGGED=new Set([5]);            // Trackman pitch types missing ("Undefined")

const PITCHES=[['Fastball',0],['Slider',-7],['Curveball',-12],['ChangeUp',-8]];

export function buildDemoTables(today=new Date()) {
  const rnd=prng(20261113);
  const athletes=[],sessions=[],history=[],trackman=[];
  let sid=1,hid=1,tid=1;
  const counts={P:0,C:0,IF:0,OF:0};
  const names=[];
  DEMO_ROSTER.forEach(([pos,q,yr],i)=>{
    const n=++counts[pos];
    const name=`Demo ${DEMO_WORD[pos]} ${SUFFIX[n-1]}`;
    names.push(name);
    const j=(spread=0.08)=>q+(rnd()-0.5)*spread*2;
    const latest=iso(today,4+i%5);
    const row={
      id:i+1,canonical_name:name,display_name:name,initials:`D${pos[0]}${n}`,pos,yr,age:18+['Fr','So','Jr','Sr'].indexOf(yr)+Math.floor(rnd()*2),av:`a${i%6}`,
      photo_url:DEMO_AVATAR,name_locked:true,pos_locked:true,archived:false,sources:[{file:'demo-synthetic.csv',date:iso(today,5),keys:['broadJump','cmjHeight','sixtyYard']}],
      trend:Array.from({length:6},(_,k)=>Math.round(30+q*45+k*2+(rnd()-0.5)*6)),
    };
    const set=(col,val)=>{row[col]=val;row[col+'_date']=latest;};
    const none=NO_TESTING.has(i);
    if(!none){set('broad_jump',+lerp(96,118,cl(j())).toFixed(0));set('cmj_height',+lerp(24,35,cl(j())).toFixed(1));}
    if(!none&&!NO_SPEED.has(i)){
      const fast=pos==='OF'?0.15:pos==='IF'?0.08:pos==='C'?-0.1:0;
      set('sixty_yard',+lerp(7.7,6.5,cl(j()+fast)).toFixed(2));
      set('split_10',+lerp(1.78,1.52,cl(j()+fast)).toFixed(2));
      set('fly_10',+lerp(1.22,0.96,cl(j()+fast)).toFixed(2));
      if(pos!=='P') set('home_to_first',+lerp(4.9,4.05,cl(j()+fast)).toFixed(2));
    }
    if(!none&&!NO_STRENGTH.has(i)){
      set('trap_bar_max',Math.round(lerp(365,535,cl(j()))/5)*5);
      set('back_squat_max',Math.round(lerp(275,425,cl(j()))/5)*5);
      set('front_squat_max',Math.round(lerp(225,335,cl(j()))/5)*5);
      set('bench_max',Math.round(lerp(185,285,cl(j()))/5)*5);
      set('med_ball_velo',+lerp(33,46,cl(j())).toFixed(1));
    }
    if(!NO_FORCE_PLATE.has(i)&&!none){
      row.peak_power=Math.round(lerp(2400,4700,cl(j())));row.rsi=+lerp(0.30,0.58,cl(j())).toFixed(3);
      row.asymmetry=+lerp(13,2.5,cl(j(0.15))).toFixed(1);row.ecc_rfd=Math.round(lerp(2300,4300,cl(j())));
      row.conc_impulse=Math.round(lerp(170,255,cl(j())));row.ecc_impulse=Math.round(lerp(150,230,cl(j())));row.contraction_time=Math.round(lerp(780,610,cl(j())));
    }
    athletes.push(row);

    // Dated testing history (4 testing blocks) trending up to the current value.
    const tracked=[['broadJump','broad_jump',false],['cmjHeight','cmj_height',false],['sixtyYard','sixty_yard',true],['split10','split_10',true],
      ['fly10','fly_10',true],['homeToFirst','home_to_first',true],['trapBarMax','trap_bar_max',false],['backSquatMax','back_squat_max',false],['frontSquatMax','front_squat_max',false],
      ['benchMax','bench_max',false],['medBallVelo','med_ball_velo',false]];
    for(const [key,col,lowerBetter] of tracked){
      if(row[col]==null)continue;
      [150,100,50,0].forEach((ago,k)=>{
        const f=(3-k)*0.02;                    // earlier blocks were weaker/slower
        history.push({id:hid++,athlete_name:name,metric_key:key,test_date:iso(today,Math.max(ago,4+i%5)),value:+(row[col]*(lowerBetter?1+f:1-f)).toFixed(3),source:'demo-synthetic'});
      });
    }

    // VALD force-plate sessions (every ~12 days) — absent for incomplete records.
    if(!NO_FORCE_PLATE.has(i)&&!none){
      for(let k=0;k<7;k++){
        const date=iso(today,3+i%4+k*12);const drift=1-k*0.012;
        const miss=(k===3&&i%4===1);                  // an occasional half-empty session
        sessions.push({id:sid++,athlete_name:name,test_date:date,session_type:'CMJ',
          jump_height:+(lerp(14,20,cl(j(0.1)))*drift).toFixed(1),
          peak_power:miss?null:Math.round(row.peak_power*drift*(1+(rnd()-0.5)*0.05)),
          rsi_mod:+(row.rsi*drift).toFixed(3),takeoff_velocity:+lerp(2.3,3.1,cl(j())).toFixed(2),
          conc_impulse:Math.round(row.conc_impulse*drift),ecc_impulse:Math.round(row.ecc_impulse*drift),ecc_rfd:miss?null:Math.round(row.ecc_rfd*drift),
          contraction_time:Math.round(row.contraction_time/drift),asymmetry:row.asymmetry,conc_impulse_asym:+lerp(3,9,rnd()).toFixed(1),ecc_braking_asym:+lerp(3,10,rnd()).toFixed(1)});
      }
    }

    // Trackman: pitchers throw bullpens; everyone else takes batting-practice swings.
    if(none) return;
    const days=[2,9,16,23,30,37];
    if(pos==='P'){
      const top=lerp(86,95,cl(j()));const spin=lerp(2050,2500,cl(j()));const ext=lerp(5.5,6.7,cl(j()));const rel=lerp(5.4,6.3,rnd());
      days.forEach((d,s)=>{
        for(let k=0;k<22;k++){
          const [type,dv]=PITCHES[k%4===0||k%3===0?0:k%4];const fb=type==='Fastball';
          trackman.push({id:tid++,pitch_uid:`demo-${tid}`,pitch_date:iso(today,d),pitcher_name:name,batter_name:null,
            pitch_type:UNTAGGED.has(i)?'Undefined':type,rel_speed:+(top-2.2+dv+rnd()*2.2+s*0.15).toFixed(1),
            spin_rate:Math.round((fb?spin:spin+250)+(rnd()-0.5)*120),ivb:+(fb?lerp(13,20,q)+(rnd()-0.5)*2:(rnd()-0.5)*8).toFixed(1),
            hb:+(fb?-lerp(6,12,rnd()):lerp(2,10,rnd())).toFixed(1),extension:+(ext+(rnd()-0.5)*0.2).toFixed(2),rel_height:+(rel+(rnd()-0.5)*0.15).toFixed(2),
            exit_speed:null,launch_angle:null,distance:null,hit_spin:null,source_file:'demo-synthetic.csv'});
        }
      });
    } else {
      const evTop=lerp(94,109,cl(j()));
      (FEW_BBE.has(i)?[2]:days).forEach((d,s)=>{
        const swings=FEW_BBE.has(i)?3:14;
        for(let k=0;k<swings;k++){
          const ev=+(evTop-rnd()*22+s*0.2).toFixed(1);const la=+(lerp(-15,45,rnd())).toFixed(1);
          const carry=Math.max(0.12,1-((la-28)/32)**2);
          trackman.push({id:tid++,pitch_uid:`demo-${tid}`,pitch_date:iso(today,d),pitcher_name:null,batter_name:name,
            pitch_type:'Fastball',rel_speed:null,spin_rate:null,ivb:null,hb:null,extension:null,rel_height:null,
            exit_speed:ev,launch_angle:la,distance:Math.round(la<5?ev*1.3:ev*4.15*carry),hit_spin:Math.round(lerp(800,3200,rnd())),source_file:'demo-synthetic.csv'});
        }
      });
    }
  });
  return {athletes,test_sessions:sessions,kpi_history:history,trackman_pitches:trackman,audit_log:[
    {id:1,changed_at:new Date(today.getTime()-3600e3).toISOString(),athlete_name:athletes[0].canonical_name,action:'update',changed_by:'demo@synthetic.invalid',changed_fields:{fields:['demo (synthetic entry)']}},
  ]};
}
