import test from 'node:test';
import assert from 'node:assert/strict';
import {services} from './support.js';

const base=pos=>({name:'Synthetic Player',_canonicalName:'Synthetic Player',pos});

test('positions are G / F / C and common spellings normalise to them',()=>{
  const {api}=services();
  assert.deepEqual(api.POSITIONS,['G','F','C']);
  for(const [raw,want] of [['PG','G'],['sg','G'],['Guard','G'],['G/F','G'],['SF','F'],['pf','F'],['Wing','F'],['F/C','F'],['C','C'],['Center','C'],['5','C'],['',null],['Coach',null]]){
    assert.equal(api.normPos(raw),want,raw);
  }
});

test('composite: top of the position range scores 100, bottom 0, times reversed',()=>{
  const {api}=services();
  const [lo,hi]=api.NORMS.G.approachJump;
  assert.equal(api.calcCompositeVB({...base('G'),approachJump:hi}),100);
  assert.equal(api.calcCompositeVB({...base('G'),approachJump:lo}),0);
  for(const k of ['courtSprint','laneAgility','mileRun']){
    const [fast,slow]=api.NORMS.G[k];
    assert.equal(api.calcCompositeVB({...base('G'),[k]:fast}),100,`${k}: fastest = 100`);
    assert.equal(api.calcCompositeVB({...base('G'),[k]:slow}),0,`${k}: slowest = 0`);
  }
  assert.equal(api.calcCompositeVB(base('G')),0,'no data scores 0');
});

test('composite: each position is graded against its own ranges',()=>{
  const {api}=services();
  const c=api.calcCompositeVB({...base('C'),approachJump:33}), g=api.calcCompositeVB({...base('G'),approachJump:33});
  assert.ok(c>g,`a 33" approach is better for a center (${c}) than a guard (${g})`);
});

test('strength (front squat, bench) counts; asymmetry and RSI are shown but not scored',()=>{
  const {api}=services();
  assert.equal(api.calcCompositeVB({...base('F'),frontSquatMax:api.NORMS.F.frontSquatMax[1],benchMax:api.NORMS.F.benchMax[1]}),100);
  const a={...base('F'),cmjHeight:api.NORMS.F.cmjHeight[1]};
  assert.equal(api.calcCompositeVB({...a,asymmetry:50,rsi:0.01}),api.calcCompositeVB(a));
});

test('the mile run is shown as m:ss',()=>{
  const {api}=services();
  assert.equal(api.fmtMile(375),'6:15');assert.equal(api.fmtMile(359.6),'6:00');assert.equal(api.fmtMile(420),'7:00');
  assert.equal(api.getM('mileRun').fmt(399),'6:39');
});

test('tiers keep the shared thresholds',()=>{
  const {api}=services();
  assert.deepEqual([80,79,63,62,45,44].map(api.calcTier),['Elite','Advanced','Advanced','Proficient','Proficient','Developing']);
});

test('every scored metric has norms for every position; no baseball or wearable metrics remain',()=>{
  const {api}=services();
  const scored=api.ALL_METRICS.filter(m=>m.group!=='score'&&!['takeoffVelocity','concImpulseAsym','eccBrakingAsym'].includes(m.key));
  for(const m of scored) for(const p of api.POSITIONS){const r=api.NORMS[p][m.key];assert.ok(Array.isArray(r)&&r[0]<r[1],`${p}.${m.key}`);}
  const keys=api.ALL_METRICS.map(m=>m.key);
  for(const k of ['approachJump','cmjHeight','courtSprint','laneAgility','mileRun','frontSquatMax','benchMax','peakPower']) assert.ok(keys.includes(k),k);
  for(const k of ['sixtyYard','homeToFirst','trapBarMax','backSquatMax','medBallVelo','maxExitVelo','jumpVol','acwr']) assert.ok(!keys.includes(k),k);
});
