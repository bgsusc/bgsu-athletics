import test from 'node:test';
import assert from 'node:assert/strict';
import {services} from './support.js';

const base=pos=>({name:'Synthetic Player',_canonicalName:'Synthetic Player',pos});

test('positions are P / C / IF / OF and common spellings normalise to them',()=>{
  const {api}=services();
  assert.deepEqual(api.POSITIONS,['P','C','IF','OF']);
  for(const [raw,want] of [['RHP','P'],['lhp','P'],['C','C'],['Catcher','C'],['SS','IF'],['2B','IF'],['1b','IF'],['UTIL','IF'],['CF','OF'],['lf','OF'],['Outfield','OF'],['IF','IF'],['',null],['DH',null]]){
    assert.equal(api.normPos(raw),want,raw);
  }
});

test('composite: a metric at the top of its position range scores 100, at the bottom 0, times reversed',()=>{
  const {api}=services();
  const [lo,hi]=api.NORMS.OF.cmjHeight;
  assert.equal(api.calcCompositeVB({...base('OF'),cmjHeight:hi}),100);
  assert.equal(api.calcCompositeVB({...base('OF'),cmjHeight:lo}),0);
  const [fast,slow]=api.NORMS.OF.sixtyYard;
  assert.equal(api.calcCompositeVB({...base('OF'),sixtyYard:fast}),100,'fastest end of the range = 100');
  assert.equal(api.calcCompositeVB({...base('OF'),sixtyYard:slow}),0);
  assert.equal(api.calcCompositeVB({...base('OF'),sixtyYard:fast-1}),100,'clamped beyond the range');
  assert.equal(api.calcCompositeVB(base('OF')),0,'no data scores 0');
});

test('composite: each position is graded against its own ranges',()=>{
  const {api}=services();
  const t=6.95; // inside both ranges, faster relative to catchers than to outfielders
  const c=api.calcCompositeVB({...base('C'),sixtyYard:t}), of=api.calcCompositeVB({...base('OF'),sixtyYard:t});
  assert.ok(c>of,`catcher ${c} > outfielder ${of} for the same 60-yd time`);
});

test('composite: pitchers are scored on pitching, everyone else on hitting',()=>{
  const {api}=services();
  const pitchTop={maxPitchVelo:api.NORMS.P.maxPitchVelo[1],avgFbVelo:api.NORMS.P.avgFbVelo[1]};
  const hitBottom={maxExitVelo:api.NORMS.P.maxExitVelo[0],avgExitVelo:api.NORMS.P.avgExitVelo[0]};
  assert.equal(api.calcCompositeVB({...base('P'),...pitchTop,...hitBottom}),100,'pitcher ignores his batted balls');
  assert.equal(api.calcCompositeVB({...base('IF'),...pitchTop,...hitBottom}),0,'infielder ignores his pitching');
});

test('composite: descriptive Trackman and asymmetry metrics are shown but never scored',()=>{
  const {api}=services();
  for(const k of ['avgLaunchAngle','avgBattedSpin','avgIVB','avgHB','avgRelHeight','asymmetry','rsi']) assert.ok(api.COMPOSITE_EXCLUDE.includes(k),k);
  const a={...base('IF'),cmjHeight:api.NORMS.IF.cmjHeight[1]};
  assert.equal(api.calcCompositeVB({...a,avgLaunchAngle:-40,avgBattedSpin:0,asymmetry:50}),api.calcCompositeVB(a));
});

test('tiers keep the shared thresholds',()=>{
  const {api}=services();
  assert.deepEqual([80,79,63,62,45,44].map(api.calcTier),['Elite','Advanced','Advanced','Proficient','Proficient','Developing']);
});

test('every metric has norms for every position (except the composite itself)',()=>{
  const {api}=services();
  for(const m of api.ALL_METRICS.filter(m=>m.group!=='score'&&!['takeoffVelocity','concImpulseAsym','eccBrakingAsym','avgLaunchAngle','avgBattedSpin','avgIVB','avgHB','avgRelHeight'].includes(m.key))){
    for(const p of api.POSITIONS){
      const r=api.NORMS[p][m.key];
      assert.ok(Array.isArray(r)&&r.length===2&&r[0]<r[1],`${p}.${m.key}`);
    }
  }
  assert.ok(!api.ALL_METRICS.some(m=>m.group==='firstbeat'),'no wearable metrics');
});
