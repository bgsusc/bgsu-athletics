import test from 'node:test';
import assert from 'node:assert/strict';
import {services} from './support.js';

// Custom/standard CSV headers are matched by "contains", so similar test names must
// never steal each other's column (e.g. 10-yd Split vs 10-yd Fly, Back vs Front Squat).
test('custom CSV maps each baseball test header to its own metric',()=>{
  const {api}=services();
  api.ATHLETES=[];
  const headers=['Name','Position','10-yd Fly','10-yd Split','60-yd Dash','Home to 1st','Front Squat 1RM (lbs)','Back Squat 1RM (lbs)','Trap Bar Deadlift','Bench Press','Med Ball Velo','Broad Jump','Vertical Jump'];
  const row=['Synthetic Player','SS','1.02','1.61','6.88','4.31','285','365','455','225','41.5','108','31.5'];
  api.processRows([headers,row],'custom');
  const a=api.parsedData[0];
  assert.equal(a.pos,'IF','SS normalises to IF');
  assert.deepEqual(
    {fly10:a.fly10,split10:a.split10,sixtyYard:a.sixtyYard,homeToFirst:a.homeToFirst,frontSquatMax:a.frontSquatMax,backSquatMax:a.backSquatMax,trapBarMax:a.trapBarMax,benchMax:a.benchMax,medBallVelo:a.medBallVelo,broadJump:a.broadJump,cmjHeight:a.cmjHeight},
    {fly10:1.02,split10:1.61,sixtyYard:6.88,homeToFirst:4.31,frontSquatMax:285,backSquatMax:365,trapBarMax:455,benchMax:225,medBallVelo:41.5,broadJump:108,cmjHeight:31.5});
});

test('a file with only a front squat column does not fill back squat (and vice versa)',()=>{
  const {api}=services();
  api.ATHLETES=[];
  api.processRows([['Name','Front Squat 1RM'],['Synthetic Player','300']],'custom');
  assert.equal(api.parsedData[0].frontSquatMax,300);assert.equal(api.parsedData[0].backSquatMax,null);
  api.processRows([['Name','Back Squat'],['Synthetic Player','350']],'custom');
  assert.equal(api.parsedData[0].backSquatMax,350);assert.equal(api.parsedData[0].frontSquatMax,null);
});

test('Back Squat is a scored, position-normed strength metric',()=>{
  const {api}=services();
  const m=api.getM('backSquatMax');
  assert.equal(m.label,'Back Squat (1RM)');assert.equal(m.group,'strength');assert.equal(m.hb,true);
  for(const p of api.POSITIONS) assert.ok(api.NORMS[p].backSquatMax);
  assert.equal(api.DB_FIELDS.backSquatMax,'back_squat_max');assert.equal(api.DB_FIELDS.backSquatMaxDate,'back_squat_max_date');
  const [,hi]=api.NORMS.C.backSquatMax;
  assert.equal(api.calcCompositeVB({name:'X',pos:'C',backSquatMax:hi}),100);
});
