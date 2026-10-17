const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const A='10000000-0000-0000-0000-000000000001',B='10000000-0000-0000-0000-000000000002';
const eid='20000000-0000-0000-0000-000000000001';
const token=id=>({user:{id},access_token:'test-jwt-'+id});
const config={url:'https://preparation-test.supabase.co',publishableKey:'sb_publishable_test_only'};
function harness({conf=config,initial=null,failSdk=false,failSession=false}={}){
 const records={scripts:[],clients:[],rpc:[],storageWrites:[],fetch:[],sdkSubscriptions:0};
 const data=new Map([['sv-guest-v2','original-guest'],['sv-cloud-backup-'+A,'original-backup']]);
 let current=initial,handler=null,nextRpc=null;
 const client={
  auth:{
   onAuthStateChange(fn){records.sdkSubscriptions++;handler=fn;return {data:{subscription:{unsubscribe(){handler=null}}}}},
   async getSession(){return {data:{session:current},error:failSession?{code:'NETWORK_ERROR'}:null}},
   async getUser(jwt){return {data:{user:{id:jwt.replace('test-jwt-','')}},error:null}},
   async signUp(input){records.signup=input;return {data:{user:{id:A},session:null},error:null}},
   async signInWithPassword(input){records.signin=input;current=token(A);handler?.('SIGNED_IN',current);return {data:{session:current,user:current.user},error:null}},
   async signOut(options){records.signout=options;current=null;handler?.('SIGNED_OUT',null);return {error:null}}
  },
  from(){throw Error('legacy table access forbidden')},
  rpc(name,args){
   const row={name,args,headers:{}};records.rpc.push(row);
   const builder={setHeader(key,value){row.headers[key]=value;return builder},retry(value){row.retry=value;return builder},
    then(resolve,reject){return Promise.resolve(nextRpc?nextRpc():{data:{ok:true},error:null}).then(resolve,reject)}};
   return builder;
  }
 };
 const ctx={console,URL,Response,Math,Date,setTimeout,clearTimeout,queueMicrotask,
  location:{origin:'https://example.test',pathname:'/svenska/',hostname:'example.github.io',protocol:'https:',hash:'#profile'},
  navigator:{},Image:function(){},SV_SUPABASE:conf,
  localStorage:{getItem:key=>data.get(key)||null,setItem(key,value){records.storageWrites.push(key);data.set(key,value)},removeItem(){throw Error('storage removal forbidden')},clear(){throw Error('storage clear forbidden')}},
  document:{addEventListener(){},createElement(){return {dataset:{},remove(){this.removed=true}}},
   head:{appendChild(node){records.scripts.push(node);queueMicrotask(()=>{
    if(failSdk){node.onerror?.();return}
    ctx.supabase={createClient(url,key,options){records.clients.push({url,key,options});return client}};
    node.onload?.();
   })}}
  }
 };
 ctx.window=ctx;ctx.addEventListener=()=>{};vm.createContext(ctx);
 for(const file of ['supabase-client.js','supabase-auth.js','supabase-rpc.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
 return {ctx,records,data,client,emit(event,value){current=value;handler?.(event,value)},rpcResult(fn){nextRpc=fn}};
}
const rejectCode=(code)=>err=>err.code===code;

test('empty configuration: no SDK/client/storage mutations',async()=>{
 const h=harness({conf:{url:'',publishableKey:''}});
 assert.equal((await h.ctx.SVAuth.initialize()).status,'unconfigured');
 assert.equal(h.records.scripts.length,0);assert.deepEqual(h.records.storageWrites,[]);
 assert.equal(h.data.get('sv-guest-v2'),'original-guest');
});
test('secret/legacy keys and foreign URL rejected before loading SDK',async()=>{
 for(const conf of [{...config,publishableKey:'sb_secret_do_not_use'},{...config,publishableKey:'eyJservice_role'},
  {...config,url:'https://evil.test'},{...config,publishableKey:''}]){
  const h=harness({conf});assert.equal(h.ctx.SVSupabase.configuration().configured,false);
  await assert.rejects(h.ctx.SVSupabase.getClient(),rejectCode('INVALID_PUBLIC_CONFIGURATION'));
  assert.equal(h.records.scripts.length,0);
 }
});
test('single pinned SDK and client; restored session stays separate from learning data',async()=>{
 const h=harness({initial:token(A)});
 await Promise.all([h.ctx.SVAuth.initialize(),h.ctx.SVAuth.initialize(),h.ctx.SVSupabase.getClient()]);
 assert.equal(h.records.clients.length,1);assert.equal(h.records.scripts.length,1);
 assert.match(h.records.scripts[0].src,/@supabase\/supabase-js@2\.118\.0\/dist\/umd\/supabase\.js$/);
 assert.equal(h.records.clients[0].options.auth.persistSession,true);
 assert.equal(h.records.clients[0].options.auth.autoRefreshToken,true);
 assert.equal(h.records.clients[0].options.auth.detectSessionInUrl,false);
 assert.equal(h.ctx.SVAuth.getState().user.id,A);assert.equal(h.ctx.location.hash,'#profile');
 assert.equal(h.records.rpc.length,0);assert.deepEqual(h.records.storageWrites,[]);
});
test('SDK unavailable is recoverable and never touches guest storage',async()=>{
 const h=harness({failSdk:true});assert.equal((await h.ctx.SVAuth.initialize()).status,'unavailable');
 assert.equal(h.records.scripts[0].removed,true);assert.equal(h.records.clients.length,0);
 assert.equal(h.data.get('sv-guest-v2'),'original-guest');assert.deepEqual(h.records.storageWrites,[]);
});
test('failed session restore preserves caches and performs no progress calls',async()=>{
 const h=harness({failSession:true});assert.equal((await h.ctx.SVAuth.initialize()).status,'unavailable');
 assert.equal(h.data.get('sv-cloud-backup-'+A),'original-backup');assert.deepEqual(h.records.rpc,[]);
});
test('signup awaiting email confirmation does not import or replace progress',async()=>{
 const h=harness();const result=await h.ctx.SVAuth.signUp({email:' test@example.test ',password:'password-test',name:' Test '});
 assert.equal(result.session,null);assert.equal(h.ctx.SVAuth.getState().status,'signed_out');
 assert.equal(h.records.signup.options.emailRedirectTo,'https://example.test/svenska/');
 assert.equal(h.records.signup.options.data.display_name,'Test');assert.deepEqual(h.records.rpc,[]);
 assert.deepEqual(h.records.storageWrites,[]);
});
test('sign in/out and external events notify outside SDK callback without progress writes',async()=>{
 const h=harness(),events=[];const unsubscribe=h.ctx.SVAuth.subscribe(value=>events.push(value));
 await h.ctx.SVAuth.signIn({email:'test@example.test',password:'test-password'});
 assert.equal(h.ctx.SVAuth.getState().user.id,A);h.emit('TOKEN_REFRESHED',token(A));
 const before=h.ctx.SVAuth.getState().identityRevision;h.emit('SIGNED_IN',token(B));
 assert.ok(h.ctx.SVAuth.getState().identityRevision>before);
 await h.ctx.SVAuth.signOut();assert.equal(h.ctx.SVAuth.getState().user,null);
 assert.equal(h.records.signout.scope,'local');assert.equal(events.length,0);
 await new Promise(resolve=>setTimeout(resolve,5));assert.ok(events.some(e=>e.event==='TOKEN_REFRESHED'));
 unsubscribe();assert.deepEqual(h.records.rpc,[]);assert.deepEqual(h.records.storageWrites,[]);
});
test('RPC requires expected owner and authenticated session; mismatch sends nothing',async()=>{
 const h=harness({initial:token(A)});
 await assert.rejects(h.ctx.SVRpc.getProgress(),rejectCode('EXPECTED_USER_ID_REQUIRED'));
 await assert.rejects(h.ctx.SVRpc.getProgress({expectedUserId:B}),rejectCode('AUTH_USER_MISMATCH'));
 assert.equal(h.records.rpc.length,0);
 const guest=harness();await assert.rejects(guest.ctx.SVRpc.getProgress({expectedUserId:A}),rejectCode('AUTH_USER_MISMATCH'));
});
test('explicit RPC mapping retains IDs, payload and binds captured JWT; no retry',async()=>{
 const h=harness({initial:token(A)});await h.ctx.SVAuth.initialize();
 await h.ctx.SVRpc.getProgress({expectedUserId:A});
 const event={type:'mark_known',occurred_at:'2026-10-17T00:00:00Z',timezone:'Europe/Stockholm',data:{word_id:'v-arbeta'}};
 await h.ctx.SVRpc.applyEvent({expectedUserId:A,eventId:eid,expectedRevision:12,event});
 await h.ctx.SVRpc.importProgress({expectedUserId:A,importId:eid,sourceId:A,expectedRevision:13,state:{xp:8},mode:'archive_only'});
 assert.deepEqual(h.records.rpc.map(r=>r.name),['sl_get_progress','sl_apply_event','sl_import_progress']);
 assert.equal(h.records.rpc[1].args.p_event_id,eid);assert.equal(h.records.rpc[1].args.p_expected_revision,12);
 assert.equal(h.records.rpc[2].args.p_mode,'archive_only');
 for(const r of h.records.rpc){assert.equal(r.headers.Authorization,'Bearer '+token(A).access_token);assert.equal(r.retry,false)}
 assert.deepEqual(h.records.storageWrites,[]);
});
test('conflict SQLSTATE preserved and not retried',async()=>{
 const h=harness({initial:token(A)});h.rpcResult(()=>({error:{code:'40001',message:'revision_conflict'},data:null}));
 await assert.rejects(h.ctx.SVRpc.applyEvent({expectedUserId:A,eventId:eid,expectedRevision:0,event:{type:'mark_known'}}),rejectCode('40001'));
 assert.equal(h.records.rpc.length,1);
});
test('cached session user cannot relabel another users JWT',async()=>{
 const h=harness({initial:{user:{id:B},access_token:token(A).access_token}});
 await assert.rejects(h.ctx.SVRpc.getProgress({expectedUserId:B}),rejectCode('AUTH_USER_MISMATCH'));
 assert.equal(h.records.rpc.length,0);
});
test('account change while RPC pending discards response; request retains original owner JWT',async()=>{
 const h=harness({initial:token(A)});let resolveRpc,started;
 const start=new Promise(resolve=>started=resolve);
 h.rpcResult(()=>new Promise(resolve=>{resolveRpc=resolve;started()}));
 const pending=h.ctx.SVRpc.getProgress({expectedUserId:A});await start;
 h.emit('SIGNED_IN',token(B));resolveRpc({data:{state:'A data'},error:null});
 await assert.rejects(pending,rejectCode('AUTH_CONTEXT_CHANGED'));
 assert.equal(h.records.rpc[0].headers.Authorization,'Bearer '+token(A).access_token);
 assert.deepEqual(h.records.storageWrites,[]);
});

async function bootGuest(options){
 const h=harness(options);const saved={known:['v-arbeta'],favorites:['v-prata'],xp:91,settings:{language:'ru',level:'A'}};
 h.data.set('sv-guest-v2',JSON.stringify(saved));
 h.ctx.fetch=async url=>{h.records.fetch.push(url);assert.ok(['./words.json','./lessons.json','./books.json'].includes(url));
  return new Response(fs.readFileSync(path.join(root,url),'utf8'),{headers:{'Content-Type':'application/json'}})};
 const source=fs.readFileSync(path.join(root,'app.js'),'utf8').replace(/\nboot\(\);/g,'');
 vm.runInContext(source,h.ctx);
 vm.runInContext('render=()=>{};bindEvents=()=>{};',h.ctx);
 await vm.runInContext('boot()',h.ctx);await h.ctx.SVAuth.initialize();
 return {h,saved};
}
test('configured boot restores Auth independently, keeps guest state and all backups unchanged',async()=>{
 const {h,saved}=await bootGuest({initial:token(A)});
 assert.equal(vm.runInContext('user',h.ctx),null);assert.equal(vm.runInContext('state.xp',h.ctx),91);
 assert.equal(h.ctx.SVAuth.getState().user.id,A);
 assert.equal(h.data.get('sv-guest-v2'),JSON.stringify(saved));
 assert.equal(h.data.get('sv-cloud-backup-'+A),'original-backup');
 assert.deepEqual(h.records.storageWrites,[]);assert.deepEqual(h.records.rpc,[]);
});
test('guest boot works with absent configuration and with SDK outage',async()=>{
 for(const options of [{conf:{url:'',publishableKey:''}},{failSdk:true}]){
  const {h,saved}=await bootGuest(options);assert.equal(vm.runInContext('state.xp',h.ctx),91);
  assert.equal(h.data.get('sv-guest-v2'),JSON.stringify(saved));assert.deepEqual(h.records.storageWrites,[]);
 }
});
test('no legacy cloud requests; modules included in page, build, server and worker',()=>{
 const app=fs.readFileSync(path.join(root,'app.js'),'utf8');assert.doesNotMatch(app,/learning_progress|cloudClient/);
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 for(const file of ['supabase-client.js','supabase-auth.js','supabase-rpc.js']){
  for(const target of ['index.html','scripts/build_deploy.py','server.py','sw.js'])assert.ok(fs.readFileSync(path.join(root,target),'utf8').includes(file),target+' includes '+file);
  assert.ok(html.indexOf(file)<html.indexOf('./app.js?'));
 }
 const rpc=fs.readFileSync(path.join(root,'supabase-rpc.js'),'utf8');assert.doesNotMatch(rpc,/localStorage|\.from\(/);
});
