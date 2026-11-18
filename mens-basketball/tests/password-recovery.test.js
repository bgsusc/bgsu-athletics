import test from 'node:test';
import assert from 'node:assert/strict';
import {services} from './support.js';

// Reproduces "Auth session missing" on the Set New Password screen: the recovery session
// must survive until the new password is saved, even for a login without Men’s Basketball access.
function setup(hash,{sports=[]}={}){
  const calls=[];let authCb=null;
  const client={
    auth:{
      onAuthStateChange(cb){authCb=cb;},
      async getSession(){return {data:{session:hash.includes('access_token')?{user:{email:'coach@example.invalid'}}:null}};},
      async signOut(){calls.push('signOut');return {};},
      async updateUser({password}){calls.push('updateUser:'+password.length);return {data:{user:{email:'coach@example.invalid'}},error:null};},
    },
    rpc:async()=>{calls.push('rpc');return {data:sports,error:null};},
    from:t=>{calls.push('from:'+t);return {select(){return this;}};},
  };
  const c=services({config:{supabaseUrl:'https://synthetic.invalid',supabaseKey:'synthetic-anon-key'},supabase:{createClient:()=>client},
    window:{location:{hash,search:'',origin:'https://example.invalid',pathname:'/mens-basketball/'}}});
  return {...c,calls,fire:e=>authCb&&authCb(e,{user:{email:'coach@example.invalid'}})};
}

test('a reset link shows Set New Password and keeps the session (no access check, no sign-out, no data)',async()=>{
  const {api,document,calls,fire}=setup('#access_token=synthetic&type=recovery');
  await api.bootSupabase();
  fire('PASSWORD_RECOVERY');
  assert.equal(document.getElementById('reset-password-overlay').style.display,'flex');
  assert.deepEqual(calls.filter(c=>c==='signOut'||c==='rpc'||c.startsWith('from:')),[],'recovery session untouched');
  document.getElementById('reset-password-new').value='new-synthetic-pass';
  document.getElementById('reset-password-confirm').value='new-synthetic-pass';
  await api.doSetNewPassword();
  assert.ok(calls.includes('updateUser:18'),'password saved on the live recovery session');
  assert.match(document.getElementById('reset-password-msg').innerHTML,/Password updated/);
});

test('an expired or already-used reset link says so on the sign-in screen',async()=>{
  const {api,document}=setup('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  await api.bootSupabase();
  assert.match(document.getElementById('login-msg').innerHTML,/expired or was already used/);
});

test('a normal session (no reset link) still goes through the Men’s Basketball access check',async()=>{
  const {api,calls}=setup('#access_token=synthetic&type=signin',{sports:['hockey']});
  await api.bootSupabase();
  assert.ok(calls.includes('rpc')&&calls.includes('signOut'),'no Men’s Basketball access -> signed out');
});
