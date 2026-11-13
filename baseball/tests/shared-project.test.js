import test from 'node:test';
import assert from 'node:assert/strict';
import {sharedProjectClient,hasSportAccess,TABLES} from '../src/services/data/shared-project.js';
import {services} from './support.js';

function fakeClient(sports=['baseball']){
  const calls=[];
  const chan={on(type,filter,cb){calls.push(['on',filter.table]);return chan;},subscribe(){calls.push(['subscribe']);return chan;}};
  return {calls,
    from:t=>{calls.push(['from',t]);return {select(){return this;}};},
    storage:{from:b=>{calls.push(['bucket',b]);return {};}},
    channel:n=>{calls.push(['channel',n]);return chan;},
    rpc:async name=>{calls.push(['rpc',name]);return {data:sports,error:null};},
    auth:{signOut:async()=>{calls.push(['signOut']);return {};}}};
}

test('the real client reads and writes only bb_ tables and the baseball photo bucket',()=>{
  const raw=fakeClient(),sb=sharedProjectClient(raw);
  for(const t of Object.keys(TABLES)) sb.from(t);
  sb.storage.from('athlete-photos');
  sb.channel('athletes-changes').on('postgres_changes',{event:'*',schema:'public',table:'athletes'},()=>{}).subscribe();
  assert.deepEqual(raw.calls.filter(c=>c[0]==='from').map(c=>c[1]),['bb_athletes','bb_test_sessions','bb_kpi_history','bb_trackman_pitches','bb_audit_log']);
  assert.deepEqual(raw.calls.find(c=>c[0]==='bucket'),['bucket','baseball-photos']);
  assert.deepEqual(raw.calls.find(c=>c[0]==='on'),['on','bb_athletes'],'realtime filter mapped');
  assert.throws(()=>sb.from('session_drills'),/no "session_drills" table/,'unknown tables fail loudly instead of reaching another sport');
});

test('sport access comes from my_sports()',async()=>{
  assert.equal(await hasSportAccess(fakeClient(['baseball','hockey'])),true);
  assert.equal(await hasSportAccess(fakeClient(['hockey'])),false);
  assert.equal(await hasSportAccess(fakeClient([])),false);
});

test('a login without Baseball access is signed out with a message and no data is loaded',async()=>{
  const {api,document}=services({config:{}});
  const raw=fakeClient(['hockey']);
  api.sb=sharedProjectClient(raw);api.currentUser={email:'coach@example.invalid'};
  await api.onLoginSuccess();
  assert.equal(raw.calls.filter(c=>c[0]==='from').length,0,'no table was read');
  assert.ok(raw.calls.some(c=>c[0]==='signOut'));
  assert.equal(api.currentUser,null);
  assert.match(document.getElementById('login-msg').innerHTML,/does not have access to the Baseball dashboard/);
});
