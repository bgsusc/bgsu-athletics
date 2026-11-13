import test from 'node:test';
import assert from 'node:assert/strict';
import {services} from './support.js';

const plain=value=>JSON.parse(JSON.stringify(value));
test('session reads are gated by both client and authenticated user',async()=>{
  const {api}=services();let calls=0;
  api.sb={from(){calls++;throw new Error('unauthenticated query');}};
  await api.loadAllSessions();await api.loadTrackman();await api.loadKpiHistory();
  assert.equal(calls,0);
});
test('paginated session reads preserve the original 1000-row boundary',async()=>{
  const {api}=services();const ranges=[];
  api.sb={from:()=>({select:()=>({order(){return this;},async range(from,to){ranges.push([from,to]);return {data:Array.from({length:from===0?1000:2},(_,i)=>({id:from+i})),error:null};}})})};
  const result=await api.fetchAllRows('test_sessions','test_date',false);
  assert.equal(result.data.length,1002);assert.deepEqual(ranges,[[0,999],[1000,1999]]);
});
test('authentication delegates to Supabase and supports password-recovery events',async()=>{
  let authChange,signIn,resetRequest,updatedPassword;
  const client={auth:{
    onAuthStateChange:callback=>{authChange=callback;},
    getSession:async()=>({data:{session:null}}),
    signInWithPassword:async credentials=>{signIn=credentials;return {error:new Error('Synthetic rejected sign-in')};},
    resetPasswordForEmail:async(...args)=>{resetRequest=args;return {error:null};},
    updateUser:async request=>{updatedPassword=request;return {data:{user:{id:'synthetic-coach'}},error:null};},
  }};
  const context=services({config:{supabaseUrl:'https://synthetic.invalid',supabaseKey:'synthetic-public-key'},supabase:{createClient:()=>client},window:{location:{origin:'http://127.0.0.1',pathname:'/baseball/'}}});
  const {api,document}=context;
  await api.bootSupabase();assert.equal(api.currentUser,null);
  document.getElementById('login-email').value='coach@example.invalid';document.getElementById('login-password').value='synthetic-password';
  await api.doLogin();assert.equal(signIn.email,'coach@example.invalid');assert.match(document.getElementById('login-msg').innerHTML,/Synthetic rejected sign-in/);
  await api.doForgotPassword();assert.equal(resetRequest[0],'coach@example.invalid');assert.equal(resetRequest[1].redirectTo,'http://127.0.0.1/baseball/');
  authChange('PASSWORD_RECOVERY',{});assert.equal(document.getElementById('reset-password-overlay').style.display,'flex');
  document.getElementById('reset-password-new').value='synthetic-new-password';document.getElementById('reset-password-confirm').value='synthetic-new-password';
  await api.doSetNewPassword();assert.deepEqual(updatedPassword,{password:'synthetic-new-password'});assert.equal(api.currentUser.id,'synthetic-coach');
});
test('password-reset redirect returns to the Baseball route under any base path, without query or hash',async()=>{
  for(const [origin,pathname,expected] of [['http://127.0.0.1:5170','/baseball/','http://127.0.0.1:5170/baseball/'],['https://athletics.example.invalid','/apps/baseball/','https://athletics.example.invalid/apps/baseball/']]){
    let resetRequest,authChange;
    const client={auth:{onAuthStateChange:cb=>{authChange=cb;},getSession:async()=>({data:{session:null}}),resetPasswordForEmail:async(...args)=>{resetRequest=args;return {error:null};}}};
    const {api,document}=services({config:{supabaseUrl:'https://synthetic.invalid',supabaseKey:'synthetic-public-key'},supabase:{createClient:()=>client},window:{location:{origin,pathname,search:'?x=1',hash:'#access_token=synthetic'}}});
    await api.bootSupabase();
    document.getElementById('login-email').value='coach@example.invalid';
    await api.doForgotPassword();
    assert.equal(resetRequest[1].redirectTo,expected);
    authChange('PASSWORD_RECOVERY',{});
    assert.equal(document.getElementById('reset-password-overlay').style.display,'flex');
  }
});
