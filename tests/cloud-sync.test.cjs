const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Sync,merge,pack,unpack,validConfig}=require('../cloud-sync.js');
const copy=v=>JSON.parse(JSON.stringify(v));
const config={url:'https://test-project.supabase.co',publishableKey:'sb_publishable_test'};
const state=()=>({profile:{name:'Test'},exercises:[],foods:[],sessions:[],nutrition:[],dayFood:{},weights:[],builder:[],settings:{}});
class Storage{constructor(){this.data=new Map()}getItem(k){return this.data.get(k)||null}setItem(k,v){this.data.set(k,v)}removeItem(k){this.data.delete(k)}}
function server(){
  const api={row:null,writes:0,beforeWrite:null,error:null};
  api.fetch=async(url,options)=>{
    const response=(status,data)=>({ok:status>=200&&status<300,status,json:async()=>copy(data)});
    if(api.error)return response(api.error,{message:'Connection error'});
    const body=options.body?JSON.parse(options.body):{};
    if(url.includes('/auth/v1/token'))return response(200,{access_token:'test-access',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'test-user',email:'test@example.test'}});
    if(url.endsWith('/auth/v1/verify')){
      assert.equal(options.headers.Authorization,undefined);assert.deepEqual(body,{token_hash:'test-confirmation',type:'signup'});
      return response(200,{access_token:'test-access',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'test-user',email:'test@example.test'}});
    }
    if(url.includes('/auth/v1/logout'))return response(200,{});
    assert.equal(options.headers.Authorization,'Bearer test-access');
    if(url.includes('/rest/v1/gym_coach_state'))return response(200,api.row?[api.row]:[]);
    if(url.includes('/rest/v1/rpc/gym_coach_save')){
      if(api.beforeWrite){const callback=api.beforeWrite;api.beforeWrite=null;await callback(body);}
      if(body.p_expected_revision!==(api.row?.revision||0))return response(200,{ok:false,revision:null});
      api.writes++;api.row={document:copy(body.p_document),revision:(api.row?.revision||0)+1};return response(200,{ok:true,revision:api.row.revision});
    }
    throw Error('Unexpected request');
  };return api;
}
function client(api,data=state()){
  const holder={data:copy(data),online:true,states:[],storage:new Storage()};
  holder.sync=new Sync({config,fetch:api.fetch,storage:holder.storage,getData:()=>holder.data,onApply:next=>{holder.data=next},online:()=>holder.online,onStatus:info=>holder.states.push(info.state)});
  holder.stop=()=>clearTimeout(holder.sync.timer);return holder;
}
test('Public config rejects secret keys, arbitrary hosts and insecure URLs',()=>{
  assert.equal(validConfig(config),true);assert.equal(validConfig({...config,publishableKey:'sb_secret_do_not_use'}),false);
  assert.equal(validConfig({...config,url:'https://evil.test'}),false);assert.equal(validConfig({...config,url:'http://test-project.supabase.co'}),false);
});
test('Email confirmation from the app uploads the mobile data without following a redirect',async()=>{
  const api=server(),a=client(api);a.data.weights.push({date:'2020-01-01',weight:70});
  await a.sync.confirmEmail(config.url+'/auth/v1/verify?token=test-confirmation&type=signup&redirect_to=http%3A%2F%2Flocalhost%3A3000');
  assert.equal(a.sync.state,'synced');assert.equal(api.row.document.weights[0].weight,70);a.stop();
});
test('Confirmation links to other servers or other account actions never trigger an API request',async()=>{
  let calls=0;const a=client({fetch:async()=>{calls++;throw Error('Unexpected request')}});
  for(const link of ['https://evil.test/auth/v1/verify?token=test-confirmation&type=signup',config.url+'/auth/v1/verify?token=test-confirmation&type=recovery'])await assert.rejects(a.sync.confirmEmail(link));
  assert.equal(calls,0);a.stop();
});
test('Confirming a different account preserves this device owner and local data',async()=>{
  const a=client(server());a.sync.owner='another-account';const original=copy(a.data);
  await assert.rejects(a.sync.confirmEmail(config.url+'/auth/v1/verify?token=test-confirmation&type=signup'),/otra cuenta/);
  assert.equal(a.sync.session,null);assert.deepEqual(a.data,original);a.stop();
});
test('First mobile uploads; PC downloads that account with a recoverable local backup',async()=>{
  const api=server(),mobile=client(api);mobile.data.weights.push({date:'2020-01-01',weight:70});
  await mobile.sync.signIn('test@example.test','password');assert.equal(api.writes,1);
  const pc=client(api);await pc.sync.signIn('test@example.test','password');
  assert.deepEqual(pc.data.weights,mobile.data.weights);assert.equal(api.writes,1);assert.equal(pc.sync.read('backups').length,1);
  assert.equal(pc.sync.read('session').password,undefined);mobile.stop();pc.stop();
});
test('Offline changes in different devices and dates merge without losing either record',async()=>{
  const api=server(),a=client(api),b=client(api);await a.sync.signIn('test@example.test','password');await b.sync.signIn('test@example.test','password');
  a.online=false;a.data.weights.push({date:'2020-01-01',weight:70});await a.sync.sync();assert.equal(a.sync.state,'offline');
  b.data.weights.push({date:'2020-01-02',weight:71});await b.sync.sync();a.online=true;await a.sync.sync();await b.sync.sync();
  assert.equal(a.data.weights.length,2);assert.deepEqual(a.data.weights,b.data.weights);a.stop();b.stop();
});
test('Two devices creating the same day merge exercises and session duration',()=>{
  const result=merge({sessions:[]},{sessions:[{id:'mobile',date:'2020-01-01',startedAt:200,lastEntryAt:400,exercises:[{id:'a',sets:[]}]}]},{sessions:[{id:'pc',date:'2020-01-01',startedAt:100,lastEntryAt:300,exercises:[{id:'b',sets:[]}]}]});
  assert.deepEqual(result.conflicts,[]);assert.equal(result.value.sessions.length,1);assert.equal(result.value.sessions[0].exercises.length,2);
  assert.equal(result.value.sessions[0].startedAt,100);assert.equal(result.value.sessions[0].lastEntryAt,400);
});
test('Deletion propagates, while an edit against that deletion becomes a conflict',()=>{
  const base={weights:[{date:'2020-01-01',weight:70}]};assert.deepEqual(merge(base,{weights:[]},base).value.weights,[]);
  assert.equal(merge(base,{weights:[]},{weights:[{date:'2020-01-01',weight:71}]}).conflicts.length,1);
});
test('Coincident edits pause writes; resolving keeps unrelated records from both devices',async()=>{
  const api=server(),a=client(api),b=client(api);a.data.weights=[{date:'2020-01-01',weight:70}];
  await a.sync.signIn('test@example.test','password');await b.sync.signIn('test@example.test','password');
  a.data.weights[0].weight=71;a.data.settings.mobile=true;
  b.data.weights[0].weight=72;b.data.settings.pc=true;await b.sync.sync();const writes=api.writes;
  await a.sync.sync();assert.equal(a.sync.state,'conflict');assert.equal(api.writes,writes);assert.ok(a.sync.read('conflict_test-user'));
  await a.sync.resolve('local');assert.equal(api.row.document.weights[0].weight,71);assert.equal(api.row.document.settings.pc,true);assert.equal(api.row.document.settings.mobile,true);a.stop();b.stop();
});
test('Choosing remote on a conflict still preserves independent local fields',()=>{
  const result=merge({settings:{target:1}},{settings:{target:2,mobile:true}},{settings:{target:3,pc:true}},'',[],'remote');
  assert.deepEqual(result.value.settings,{target:3,pc:true,mobile:true});
});
test('An update while an upload is in flight remains pending, then reaches the cloud',async()=>{
  const api=server(),a=client(api);await a.sync.signIn('test@example.test','password');a.data.settings.first=true;
  api.beforeWrite=()=>{a.data.settings.second=true};await a.sync.sync();
  assert.equal(a.data.settings.second,true);assert.equal(a.sync.state,'pending');await a.sync.sync();assert.equal(api.row.document.settings.second,true);a.stop();
});
test('Compare-and-swap retries merge a concurrent remote update',async()=>{
  const api=server(),a=client(api);await a.sync.signIn('test@example.test','password');a.data.settings.mobile=true;
  api.beforeWrite=()=>{api.row.document.settings.pc=true;api.row.revision++};await a.sync.sync();
  assert.equal(api.row.document.settings.mobile,true);assert.equal(api.row.document.settings.pc,true);assert.equal(a.sync.state,'synced');a.stop();
});
test('Food logs combine independently and nutrition totals derive from the merged entries',()=>{
  const base=state();base.nutrition=[{date:'2020-01-01',fromLog:true,kcal:0}];base.dayFood={'2020-01-01':[]};
  const a=copy(base),b=copy(base);a.dayFood['2020-01-01'].push({id:'a',kcal:100,p:10,c:5,f:1});a.nutrition[0].kcal=100;
  b.dayFood['2020-01-01'].push({id:'b',kcal:200,p:20,c:10,f:2});b.nutrition[0].kcal=200;
  const result=merge(pack(base),pack(a),pack(b));assert.deepEqual(result.conflicts,[]);
  const value=unpack(result.value,a);assert.equal(value.dayFood['2020-01-01'].length,2);assert.equal(value.nutrition[0].kcal,300);assert.equal(value.nutrition[0].protein,30);
});
test('Food references retain their identity through reordered catalogs',()=>{
  const data=state();data.foods=[{name:'A'},{name:'B'}];data.myPlates=[{name:'Plate',parts:[{foodIndex:1,qty:100}]}];data.builder=[{foodIndex:0,qty:50}];
  const wire=pack(data);wire.foods.reverse();const result=unpack(wire,data);
  assert.equal(result.myPlates[0].parts[0].foodIndex,0);assert.equal(result.builder[0].foodIndex,1);assert.equal(wire.builder.length,0);
});
test('Failed upload preserves local data and expired login returns to sign-in state',async()=>{
  const api=server(),a=client(api);await a.sync.signIn('test@example.test','password');a.data.settings.offlineEdit=true;api.error=503;
  await a.sync.sync();assert.equal(a.data.settings.offlineEdit,true);assert.equal(a.sync.state,'error');a.stop();api.error=401;await a.sync.sync();assert.equal(a.sync.state,'signedout');assert.equal(a.sync.session,null);a.stop();
});
test('Sign-out during a download does not apply another response afterwards',async()=>{
  const api=server(),a=client(api);await a.sync.signIn('test@example.test','password');
  const request=a.sync.request.bind(a.sync);a.sync.request=async(path,opts)=>{const value=await request(path,opts);if(path.includes('/rest/v1/gym_coach_state'))await a.sync.signOut();return value;};
  api.row.document.settings.remote=true;await a.sync.sync();assert.equal(a.data.settings.remote,undefined);assert.equal(a.sync.session,null);a.stop();
});
