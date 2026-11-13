import test from 'node:test';
import assert from 'node:assert/strict';
import {services} from './support.js';

const HEADER='PitchNo,Date,Time,PitchUID,Pitcher,Batter,TaggedPitchType,RelSpeed,SpinRate,InducedVertBreak,HorzBreak,Extension,RelHeight,ExitSpeed,Angle,Distance,HitSpinRate';

function setup(){
  const c=services();
  c.api.ATHLETES=[
    {id:1,name:'Synthetic Pitcher',_canonicalName:'Synthetic Pitcher',pos:'P'},
    {id:2,name:'Synthetic Hitter',_canonicalName:'Synthetic Hitter',pos:'IF'},
  ];
  return c.api;
}

test('standard TrackMan CSV parses: Last, First names, US dates, quoted fields, blanks',()=>{
  const api=setup();
  const csv=[HEADER,
    '1,10/5/2026,15:01,uid-1,"Pitcher, Synthetic","Hitter, Synthetic",Fastball,92.4,2310,17.2,-9.1,6.3,5.9,101.2,24,388,2100',
    '2,2026-10-06,15:02,uid-2,"Pitcher, Synthetic",,Slider,84.0,2550,1.0,4.2,6.2,5.8,,,,',
    '3,,15:03,uid-3,"Pitcher, Synthetic",,Fastball,91,,,,,,,,,',
  ].join('\n');
  const {rows,missing,skipped}=api.parseTrackmanCSV(csv,'synthetic.csv');
  assert.deepEqual(missing,[]);assert.equal(skipped,1,'row without a date is skipped');
  assert.equal(rows.length,2);
  assert.equal(rows[0].pitcher_name,'Synthetic Pitcher');assert.equal(rows[0].batter_name,'Synthetic Hitter');
  assert.equal(rows[0].pitch_date,'2026-10-05');assert.equal(rows[1].pitch_date,'2026-10-06');
  assert.equal(rows[0].rel_speed,92.4);assert.equal(rows[0].exit_speed,101.2);assert.equal(rows[0].launch_angle,24);
  assert.equal(rows[1].exit_speed,null,'blank cells become null, never 0');
  assert.equal(rows[0].source_file,'synthetic.csv');
});

test('files without the required Trackman columns are rejected with the column names',()=>{
  const api=setup();
  const r=api.parseTrackmanCSV('Name,Velo\nA,90');
  assert.equal(r.rows.length,0);
  assert.ok(r.missing.includes('date')&&r.missing.includes('pitcher')&&r.missing.includes('batter'));
});

test('hitting metrics: max/avg EV, launch angle, distance, hard-hit and sweet-spot %',()=>{
  const api=setup();
  const bbe=[[100,20,380],[96,30,400],[90,5,200],[80,-10,40],[105,10,300]];
  api.TRACKMAN=bbe.map(([ev,la,d],i)=>({pitch_date:'2026-10-0'+(i+1),batter_name:'Synthetic Hitter',exit_speed:ev,launch_angle:la,distance:d,hit_spin:1000}));
  const m=api.trackmanMetrics(api.ATHLETES[1]);
  assert.equal(m.maxExitVelo,105);assert.equal(m.avgExitVelo,94.2);assert.equal(m.avgLaunchAngle,11);
  assert.equal(m.maxDistance,400);assert.equal(m.bbeCount,5);
  assert.equal(m.hardHitPct,60,'3 of 5 at 95+ mph');
  assert.equal(m.sweetSpotPct,60,'3 of 5 between 8 and 32 degrees');
  assert.equal(m.maxPitchVelo,undefined,'a hitter has no pitching metrics');
});

test('percentages need at least 5 batted balls',()=>{
  const api=setup();
  api.TRACKMAN=[1,2,3].map(i=>({pitch_date:'2026-10-0'+i,batter_name:'Synthetic Hitter',exit_speed:100,launch_angle:20}));
  const m=api.trackmanMetrics(api.ATHLETES[1]);
  assert.equal(m.maxExitVelo,100);assert.equal(m.hardHitPct,undefined);assert.equal(m.sweetSpotPct,undefined);
});

test('pitching metrics use tagged fastballs; untagged files fall back to all pitches',()=>{
  const api=setup();
  const p=(type,v,spin,ivb,hb)=>({pitch_date:'2026-10-01',pitcher_name:'Synthetic Pitcher',pitch_type:type,rel_speed:v,spin_rate:spin,ivb,hb,extension:6.2,rel_height:5.8});
  api.TRACKMAN=[p('Fastball',92,2300,18,-10),p('Sinker',90,2200,8,-14),p('Slider',85,2600,1,5),p('ChangeUp',83,1800,6,-12)];
  let m=api.trackmanMetrics(api.ATHLETES[0]);
  assert.equal(m.maxPitchVelo,92);assert.equal(m.avgFbVelo,91);assert.equal(m.avgSpinRate,2250);
  assert.equal(m.avgIVB,13);assert.equal(m.avgHB,12,'horizontal break reported as magnitude');
  assert.equal(m.avgExtension,6.2);assert.equal(m.pitchCount,4);
  api.TRACKMAN=api.TRACKMAN.map(r=>({...r,pitch_type:'Undefined'}));
  m=api.trackmanMetrics(api.ATHLETES[0]);
  assert.equal(m.avgFbVelo,87.5,'all pitches when nothing is tagged');
});

test('enrichment sets metrics on athletes and clears them when data goes away',()=>{
  const api=setup();
  api.TRACKMAN=[{pitch_date:'2026-10-01',batter_name:'Synthetic Hitter',exit_speed:99}];
  api.enrichAthletesFromTrackman();
  assert.equal(api.ATHLETES[1].maxExitVelo,99);assert.equal(api.ATHLETES[0].maxExitVelo,null);
  api.TRACKMAN=[];api.enrichAthletesFromTrackman();
  assert.equal(api.ATHLETES[1].maxExitVelo,null);
});

test('re-importing the same pitches is de-duplicated (PitchUID, else row contents)',()=>{
  const api=setup();
  api.TRACKMAN=[{pitch_uid:'uid-1',pitch_date:'2026-10-01',pitcher_name:'Synthetic Pitcher',rel_speed:90}];
  const incoming=[
    {pitch_uid:'uid-1',pitch_date:'2026-10-01',pitcher_name:'Synthetic Pitcher',rel_speed:90},
    {pitch_uid:'uid-2',pitch_date:'2026-10-01',pitcher_name:'Synthetic Pitcher',rel_speed:91},
    {pitch_uid:null,pitch_date:'2026-10-02',pitcher_name:'Synthetic Pitcher',rel_speed:88},
    {pitch_uid:null,pitch_date:'2026-10-02',pitcher_name:'Synthetic Pitcher',rel_speed:88},
  ];
  assert.equal(api.newTrackmanRowsOnly(incoming).length,2);
});

test('Trackman reads are gated by client and authenticated user, and a missing table is not fatal',async()=>{
  const api=setup();let calls=0;
  api.sb={from(){calls++;throw new Error('unauthenticated query');}};
  await api.loadTrackman();assert.equal(calls,0);
  api.currentUser={email:'coach@example.invalid'};
  api.sb={from:()=>({select:()=>({order(){return this;},async range(){return {data:null,error:{message:'relation "trackman_pitches" does not exist'}};}})})};
  await api.loadTrackman();
  assert.deepEqual(api.TRACKMAN,[]);assert.match(api.tmLoadError,/does not exist/);
});
