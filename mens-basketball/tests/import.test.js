import test from 'node:test';
import assert from 'node:assert/strict';
import {services} from './support.js';

// Custom CSV headers are matched by "contains": similar names must not steal each other's
// column (approach vs standing vertical), and the mile run must accept m:ss.
test('custom CSV maps each basketball test header to its own metric',()=>{
  const {api}=services();
  api.ATHLETES=[];
  const headers=['Name','Position','Approach Vertical','Standing Vertical','3/4 Court Sprint','Lane Agility','1 Mile Run','Front Squat 1RM','Bench Press'];
  const row=['Synthetic Player','PG','36.5','29.5','3.21','11.05','6:15','295','245'];
  api.processRows([headers,row],'custom');
  const a=api.parsedData[0];
  assert.equal(a.pos,'G','PG normalises to G');
  assert.deepEqual({approachJump:a.approachJump,cmjHeight:a.cmjHeight,courtSprint:a.courtSprint,laneAgility:a.laneAgility,mileRun:a.mileRun,frontSquatMax:a.frontSquatMax,benchMax:a.benchMax},
    {approachJump:36.5,cmjHeight:29.5,courtSprint:3.21,laneAgility:11.05,mileRun:375,frontSquatMax:295,benchMax:245});
});

test('standing vertical never takes an approach column, even when it comes first',()=>{
  const {api}=services();
  api.ATHLETES=[];
  api.processRows([['Name','Approach Vertical Jump','Vertical'],['Synthetic Player','37','30']],'custom');
  assert.equal(api.parsedData[0].approachJump,37);assert.equal(api.parsedData[0].cmjHeight,30);
  api.processRows([['Name','Approach Vertical Jump'],['Synthetic Player','37']],'custom');
  assert.equal(api.parsedData[0].cmjHeight,null,'no standing column -> blank, not the approach value');
});

test('mile times accept m:ss, m:ss.s and plain seconds',()=>{
  const {api}=services();
  api.ATHLETES=[];
  for(const [raw,want] of [['6:15',375],['5:59.5',359.5],['402',402],['',null]]){
    api.processRows([['Name','Mile Run'],['Synthetic Player',raw]],'custom');
    assert.equal(api.parsedData[0].mileRun,want,raw);
  }
});
