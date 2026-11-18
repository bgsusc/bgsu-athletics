import test from 'node:test';
import assert from 'node:assert/strict';
import {services} from './support.js';

// Baseball started from VALD imports with no roster: sessions were saved but no athlete
// existed, so the Dashboard and Roster Setup stayed empty.
test('athletes found only in imported data are added to the roster with no position set',()=>{
  const {api}=services();
  api.ATHLETES=[{id:0,name:'Synthetic Existing',_canonicalName:'Synthetic Existing',pos:'G',_posLocked:true,yr:'Jr',av:'a0',trend:[],_sources:[]}];
  api.SESSIONS=[
    {athlete_name:'Synthetic Existing',test_date:'2026-11-10',jump_height:18,peak_power:4800},
    {athlete_name:'Synthetic Newplayer',test_date:'2026-11-10',jump_height:19,peak_power:5000},
    {athlete_name:'  synthetic   newplayer ',test_date:'2026-11-11',jump_height:19.5,peak_power:5100},
    {athlete_name:'Synthetic Other',test_date:'2026-11-10',jump_height:17,peak_power:4500},
  ];
  api.KPI_HISTORY=[{athlete_name:'Synthetic Testonly',metric_key:'courtSprint',test_date:'2026-11-10',value:3.3}];
  assert.deepEqual(api.missingRosterNames().sort(),['Synthetic Newplayer','Synthetic Other','Synthetic Testonly']);
  assert.equal(api.addAthletesFromData(),3);
  const added=api.ATHLETES.filter(a=>a.name!=='Synthetic Existing');
  assert.equal(added.length,3);
  assert.ok(added.every(a=>!api.posIsSet(a)),'positions are left for the coach to assign');
  assert.ok(added.every(a=>a.yr===''&&!/undefined|NaN/.test(JSON.stringify(a))));
  const np=api.ATHLETES.find(a=>a.name==='Synthetic Newplayer');
  assert.equal(np.peakPower,5100,'force plate data is attached to the new athlete');
  assert.equal(api.ATHLETES.find(a=>a.name==='Synthetic Existing').pos,'G','existing athletes untouched');
  assert.equal(api.addAthletesFromData({quiet:true}),0,'running again adds nobody');
});
