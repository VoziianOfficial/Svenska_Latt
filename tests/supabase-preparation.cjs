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
function harness({conf=config,initial=null,failSdk=false,failSession=false,hash='#profile',search='',callbackFails=false,progress=false,hostname='example.github.io',environment=null}={}){
 const records={scripts:[],clients:[],rpc:[],storageWrites:[],fetch:[],sdkSubscriptions:0};
 const data=new Map([['sv-guest-v2','original-guest'],['sv-cloud-backup-'+A,'original-backup']]);
 let current=initial,handler=null,nextRpc=null;
 const client={
  auth:{
   onAuthStateChange(fn){records.sdkSubscriptions++;handler=fn;return {data:{subscription:{unsubscribe(){handler=null}}}}},
   async getSession(){return {data:{session:current},error:failSession?{code:'NETWORK_ERROR'}:null}},
   async setSession(input){records.callback=input;if(callbackFails)return {error:{code:'bad_token'}};current=token(A);return {data:{session:current},error:null}},
   async exchangeCodeForSession(code){records.code=code;return this.setSession({})},
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
 const ctx={console,URL,URLSearchParams,Response,Math,Date,setTimeout,clearTimeout,queueMicrotask,
  location:{origin:'https://example.test',pathname:'/svenska/',hostname,protocol:'https:',hash,search},
  history:{state:null,replaceState(state,title,path){records.cleanedUrl=path;const url=new URL(path,ctx.location.origin);ctx.location.hash=url.hash;ctx.location.search=url.search}},navigator:{},Image:function(){},SV_SUPABASE:conf,
  localStorage:{getItem:key=>data.get(key)||null,setItem(key,value){records.storageWrites.push(key);data.set(key,value)},removeItem(){throw Error('storage removal forbidden')},clear(){throw Error('storage clear forbidden')}},
  document:{addEventListener(){},querySelector(){return null},createElement(){return {dataset:{},remove(){this.removed=true}}},
   head:{appendChild(node){records.scripts.push(node);queueMicrotask(()=>{
    if(failSdk){node.onerror?.();return}
    ctx.supabase={createClient(url,key,options){records.clients.push({url,key,options});return client}};
    node.onload?.();
   })}}
  }
 };
 ctx.window=ctx;ctx.addEventListener=()=>{};if(environment)Object.assign(ctx,environment);vm.createContext(ctx);
 for(const file of ['supabase-client.js','supabase-auth.js','supabase-rpc.js',...(progress?['supabase-progress.js']:[])])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
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
 const h=harness(options);
 if(options?.cloudSnapshot)h.rpcResult(()=>({data:options.cloudSnapshot,error:null}));
 const saved={known:['v-arbeta'],favorites:['v-prata'],xp:91,settings:{language:'ru',level:'A'}};
 h.data.set('sv-guest-v2',JSON.stringify(saved));
 if(options?.accountState)h.data.set('sv-account-local-v1-'+A,JSON.stringify(options.accountState));
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
 assert.equal(vm.runInContext('user.id',h.ctx),A);assert.equal(vm.runInContext('state.xp',h.ctx),0);
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
 for(const file of ['supabase-client.js','supabase-auth.js','supabase-rpc.js','supabase-progress.js']){
  for(const target of ['index.html','scripts/build_deploy.py','server.py','sw.js'])assert.ok(fs.readFileSync(path.join(root,target),'utf8').includes(file),target+' includes '+file);
  assert.ok(html.indexOf(file)<html.indexOf('./app.js?'));
 }
 const rpc=fs.readFileSync(path.join(root,'supabase-rpc.js'),'utf8');assert.doesNotMatch(rpc,/localStorage|\.from\(/);
});

test('implicit email callback is scrubbed before initialize and restores Auth without progress calls',async()=>{
 const h=harness({hash:'#access_token=secret-access&refresh_token=secret-refresh&type=signup&expires_in=3600'});
 assert.equal(h.ctx.location.hash,'#profile');assert.equal(h.records.cleanedUrl,'/svenska/#profile');
 await h.ctx.SVAuth.initialize();
 assert.equal(h.records.callback.access_token,'secret-access');assert.equal(h.ctx.SVAuth.getState().user.id,A);
 assert.equal(h.ctx.SVAuth.getState().callbackError,null);assert.deepEqual(h.records.rpc,[]);assert.deepEqual(h.records.storageWrites,[]);
});
test('PKCE callback removes code, preserves normal route and unrelated query',async()=>{
 const h=harness({search:'?code=test-code&lang=sv',hash:'#profile'});
 assert.equal(h.records.cleanedUrl,'/svenska/?lang=sv#profile');
 await h.ctx.SVAuth.initialize();assert.equal(h.records.code,'test-code');assert.equal(h.ctx.SVAuth.getState().user.id,A);
});
test('expired, incomplete and rejected callbacks leave no credentials and preserve guest data',async()=>{
 for(const options of [{hash:'#error=access_denied&error_code=otp_expired&error_description=Expired'},{hash:'#access_token=incomplete'},{hash:'#access_token=a&refresh_token=b',callbackFails:true}]){
  const h=harness(options);await h.ctx.SVAuth.initialize();
  assert.equal(h.ctx.location.hash,'#profile');assert.equal(h.ctx.SVAuth.getState().callbackError,'AUTH_CALLBACK_FAILED');
  assert.equal(h.data.get('sv-guest-v2'),'original-guest');assert.deepEqual(h.records.storageWrites,[]);
 }
});
test('signed-in state never writes or restores legacy local XP; signout restores guest only',async()=>{
 const {h,saved}=await bootGuest({initial:token(A),accountState:{xp:25}});
 h.data.set('sv-account-local-v1-'+B,JSON.stringify({xp:8}));
 const before=[...h.data];
 vm.runInContext('state.xp=99;save()',h.ctx);
 assert.equal(JSON.parse(h.data.get('sv-account-local-v1-'+A)).xp,25);
 h.emit('SIGNED_IN',token(B));await new Promise(r=>setTimeout(r,5));
 assert.equal(vm.runInContext('state.xp',h.ctx),0);
 h.emit('SIGNED_IN',token(A));await new Promise(r=>setTimeout(r,5));
 assert.equal(vm.runInContext('state.xp',h.ctx),0);
 await h.ctx.SVAuth.signOut();await new Promise(r=>setTimeout(r,5));
 assert.equal(vm.runInContext('user',h.ctx),null);assert.equal(vm.runInContext('state.xp',h.ctx),91);
 assert.equal(h.data.get('sv-guest-v2'),JSON.stringify(saved));assert.deepEqual([...h.data],before);
 assert.deepEqual(h.records.storageWrites,[]);assert.deepEqual(h.records.rpc,[]);
});

function formHarness(h,mode='register'){
 const nodes={};
 for(const [selector,value] of Object.entries({'#auth-email':'person@example.test','#auth-pass':'test-password','#auth-name':'Test person','#auth-submit':'','#auth-error':'','#auth-status':''}))nodes[selector]={value,textContent:'',disabled:false};
 nodes['#auth-submit'].textContent='Submit';
 const form={dataset:{mode},querySelector:selector=>nodes[selector],busy:false,setAttribute(){this.busy=true},removeAttribute(){this.busy=false}};
 h.ctx.formNodes=nodes;h.ctx.testForm=form;
 h.ctx.document.querySelector=selector=>nodes[selector];
 vm.runInContext("closeAuth=()=>{window.closed=true};toast=msg=>{window.notice=msg};navigate=()=>{};",h.ctx);
 return {nodes,form};
}
test('existing signup handler shows confirmation persistently, clears password and resets loading',async()=>{
 const {h}=await bootGuest();const {nodes,form}=formHarness(h);
 let finish;h.client.auth.signUp=()=>new Promise(resolve=>finish=resolve);
 const pending=vm.runInContext('authSubmit(testForm)',h.ctx);
 await new Promise(r=>setTimeout(r,0));
 assert.equal(nodes['#auth-submit'].disabled,true);assert.equal(form.busy,true);
 finish({data:{session:null,user:{id:A}},error:null});await pending;
 assert.match(nodes['#auth-status'].textContent,/письмо|почт/);
 assert.equal(nodes['#auth-pass'].value,'');assert.equal(nodes['#auth-submit'].disabled,false);assert.equal(form.busy,false);
 assert.equal(vm.runInContext('user',h.ctx),null);assert.notEqual(h.ctx.closed,true);assert.deepEqual(h.records.rpc,[]);
});
test('login form uses prepared Auth, displays safe errors and clears loading after failure',async()=>{
 const {h}=await bootGuest();const {nodes}=formHarness(h,'login');
 h.client.auth.signInWithPassword=async()=>({error:{code:'invalid_credentials',message:'internal details should not appear'}});
 await vm.runInContext('authSubmit(testForm)',h.ctx);
 assert.equal(nodes['#auth-error'].textContent,'Неверная почта или пароль.');assert.equal(nodes['#auth-submit'].disabled,false);
 h.client.auth.signInWithPassword=async()=>({data:{session:token(A),user:token(A).user},error:null});
 await vm.runInContext('authSubmit(testForm)',h.ctx);
 assert.equal(vm.runInContext('user.id',h.ctx),A);assert.equal(h.ctx.closed,true);
 assert.equal(vm.runInContext('state.xp',h.ctx),0);assert.deepEqual(h.records.rpc,[]);
});
test('logout handler preserves identity and progress on failure and restores guest on success',async()=>{
 const {h,saved}=await bootGuest({initial:token(A)});formHarness(h,'login');
 h.ctx.document.querySelectorAll=()=>[];vm.runInContext('state.xp=12;save()',h.ctx);
 const original=h.client.auth.signOut;
 h.client.auth.signOut=async()=>({error:{code:'unexpected_failure'}});
 await vm.runInContext('logout()',h.ctx);assert.equal(vm.runInContext('user.id',h.ctx),A);assert.equal(vm.runInContext('state.xp',h.ctx),12);
 h.client.auth.signOut=original;await vm.runInContext('logout()',h.ctx);
 assert.equal(vm.runInContext('user',h.ctx),null);assert.equal(vm.runInContext('state.xp',h.ctx),91);
 assert.equal(h.data.get('sv-guest-v2'),JSON.stringify(saved));assert.equal(h.data.get('sv-cloud-backup-'+A),'original-backup');
});

test('without the cloud module account data stays unavailable instead of using legacy local XP',async()=>{
 const {h,saved}=await bootGuest({initial:token(A),accountState:{xp:34,known:['v-prata']}});
 assert.equal(vm.runInContext('user.id',h.ctx),A);assert.equal(vm.runInContext('state.xp',h.ctx),0);
 assert.equal(vm.runInContext('accountDataReady()',h.ctx),false);
 assert.equal(JSON.parse(h.data.get('sv-account-local-v1-'+A)).xp,34);
 assert.equal(h.data.get('sv-guest-v2'),JSON.stringify(saved));assert.deepEqual(h.records.storageWrites,[]);assert.deepEqual(h.records.rpc,[]);
});
test('email return during SDK outage is scrubbed and reports callback failure',async()=>{
 const h=harness({failSdk:true,hash:'#access_token=a&refresh_token=b'});
 assert.equal(h.ctx.location.hash,'#profile');
 const auth=await h.ctx.SVAuth.initialize();assert.equal(auth.status,'unavailable');assert.equal(auth.callbackError,'AUTH_CALLBACK_FAILED');
});

function cloudSnapshot(overrides={}){
 return {revision:7,content_version:'test-manifest-v1',state:{known:['v-arbeta','v-prata'],favorites:[],completed:[],videos:[],booksRead:[],reviews:{},activity:{},xp:42,answered:2,correct:1,
  settings:{language:'ru',level:'A',speechSpeed:'slow',timezone:'Europe/Stockholm'},profile:{name:'',avatarPath:null}},...overrides};
}
async function progressHarness(options={}){
 const h=harness({initial:token(A),progress:true,hostname:'127.0.0.1',...options});
 h.rpcResult(()=>({data:cloudSnapshot(),error:null}));
 await h.ctx.SVAuth.initialize();return h;
}
test('cloud read uses only sl_get_progress, validates and keeps a detached snapshot in memory',async()=>{
 const h=await progressHarness(),source=cloudSnapshot();h.rpcResult(()=>({data:source,error:null}));
 await h.ctx.SVProgress.initialize();const result=h.ctx.SVProgressDebug.status();
 assert.equal(result.status,'ready');assert.equal(result.revision,7);assert.equal(result.content_version,'test-manifest-v1');assert.equal(result.knownWords,2);assert.equal(result.xp,42);
 source.state.known.push('other');source.state.xp=999;
 assert.equal(h.ctx.SVProgressDebug.status().xp,42);assert.equal(h.ctx.SVProgressDebug.status().knownWords,2);
 assert.deepEqual(h.records.rpc.map(r=>r.name),['sl_get_progress']);assert.equal(h.records.rpc[0].retry,false);
 assert.equal(h.data.get('sv-guest-v2'),'original-guest');assert.equal(h.data.get('sv-cloud-backup-'+A),'original-backup');assert.deepEqual(h.records.storageWrites,[]);
 assert.doesNotMatch(JSON.stringify(result),/test-jwt|access_token|userId|avatarPath|Authorization/);
});
test('duplicate init, token refresh, repeated sign-in events and pending reads share one request',async()=>{
 const h=await progressHarness();let finish,started;
 const seen=new Promise(resolve=>started=resolve);
 h.rpcResult(()=>new Promise(resolve=>{finish=resolve;started()}));
 const one=h.ctx.SVProgress.initialize(),two=h.ctx.SVProgress.initialize();await seen;
 h.emit('TOKEN_REFRESHED',token(A));h.emit('SIGNED_IN',token(A));
 const three=h.ctx.SVProgressDebug.retry();await new Promise(r=>setTimeout(r,5));
 assert.equal(h.records.rpc.length,1);finish({data:cloudSnapshot(),error:null});
 await Promise.all([one,two,three]);
 await h.ctx.SVProgressDebug.retry();assert.equal(h.records.rpc.length,1);assert.equal(h.ctx.SVProgressDebug.status().status,'ready');
});
test('invalid cloud envelopes and state are rejected without storage writes',async()=>{
 const bad=[null,[],{},cloudSnapshot({revision:-1}),cloudSnapshot({revision:1.5}),cloudSnapshot({revision:Number.MAX_SAFE_INTEGER+1}),
  cloudSnapshot({content_version:''}),cloudSnapshot({content_version:42}),cloudSnapshot({state:null}),cloudSnapshot({state:[]})];
 for(const change of [{known:'wrong'},{known:['duplicate','duplicate']},{xp:'42'},{xp:-1},{correct:8},{reviews:[]},{activity:[]},{settings:{}},{profile:{name:'',avatarPath:7}}])bad.push(cloudSnapshot({state:{...cloudSnapshot().state,...change}}));
 for(const value of bad){
  const h=await progressHarness(),errors=[];h.rpcResult(()=>({data:value,error:null}));await h.ctx.SVProgress.initialize({onError:msg=>errors.push(msg)});
  assert.equal(h.ctx.SVProgressDebug.status().status,'error');assert.equal(h.ctx.SVProgressDebug.status().errorCode,'INVALID_PROGRESS_RESPONSE');
  assert.equal(errors.length,1);assert.equal(h.ctx.SVAuth.getState().user.id,A);assert.deepEqual(h.records.storageWrites,[]);
 }
});
test('RPC failure has safe diagnostics, no automatic retries and one explicit recovery',async()=>{
 const h=await progressHarness(),errors=[];
 h.rpcResult(()=>({error:{code:'42501',message:'secret-test-jwt',details:'private-data'}}));
 await h.ctx.SVProgress.initialize({onError:msg=>errors.push(msg)});
 assert.equal(h.ctx.SVProgressDebug.status().errorCode,'42501');assert.match(errors[0],/authenticated/);assert.doesNotMatch(JSON.stringify(h.ctx.SVProgressDebug.status()),/secret|private-data/);
 h.emit('TOKEN_REFRESHED',token(A));await new Promise(r=>setTimeout(r,5));assert.equal(h.records.rpc.length,1);
 h.rpcResult(()=>({data:cloudSnapshot(),error:null}));await h.ctx.SVProgressDebug.retry();
 assert.equal(h.ctx.SVProgressDebug.status().status,'ready');assert.equal(h.ctx.SVProgressDebug.status().attempts,2);assert.equal(h.records.rpc.length,2);assert.deepEqual(h.records.storageWrites,[]);
});
test('account change discards pending old cloud data and reads new identity once',async()=>{
 const h=await progressHarness();let finish,started;
 const seen=new Promise(resolve=>started=resolve);
 h.rpcResult(()=>new Promise(resolve=>{finish=resolve;started()}));
 const pending=h.ctx.SVProgress.initialize();await seen;
 h.rpcResult(()=>({data:cloudSnapshot({revision:11}),error:null}));h.emit('SIGNED_IN',token(B));
 await new Promise(r=>setTimeout(r,10));
 assert.equal(h.ctx.SVProgressDebug.status().revision,11);
 finish({data:cloudSnapshot({revision:99}),error:null});await pending;
 assert.equal(h.ctx.SVProgressDebug.status().revision,11);assert.equal(h.records.rpc.length,2);
 await h.ctx.SVAuth.signOut();assert.equal(h.ctx.SVProgressDebug.status().status,'idle');
 await new Promise(r=>setTimeout(r,5));assert.equal(h.ctx.SVProgressDebug.status().xp,null);assert.deepEqual(h.records.storageWrites,[]);
});
test('logout then login to same user reads a new snapshot; stale failure never notifies',async()=>{
 const h=await progressHarness(),errors=[];let finish,started;
 const seen=new Promise(resolve=>started=resolve);h.rpcResult(()=>new Promise(resolve=>{finish=resolve;started()}));
 const pending=h.ctx.SVProgress.initialize({onError:msg=>errors.push(msg)});await seen;
 await h.ctx.SVAuth.signOut();h.rpcResult(()=>({data:cloudSnapshot({revision:12}),error:null}));
 await h.ctx.SVAuth.signIn({email:'test@example.test',password:'test-password'});await new Promise(r=>setTimeout(r,10));
 finish({error:{code:'42501'}});await pending;
 assert.equal(h.ctx.SVProgressDebug.status().revision,12);assert.equal(errors.length,0);assert.equal(h.records.rpc.length,2);
});
test('guests and Auth outages send no progress RPC; debug API only exists on loopback HTTP',async()=>{
 for(const options of [{initial:null},{initial:null,failSdk:true},{initial:null,conf:{url:'',publishableKey:''}}]){
  const h=await progressHarness(options);await h.ctx.SVProgress.initialize();assert.equal(h.records.rpc.length,0);assert.equal(h.ctx.SVProgressDebug.status().status,'idle');
 }
 const h=await progressHarness({hostname:'example.github.io'});assert.equal(h.ctx.SVProgressDebug,undefined);await h.ctx.SVProgress.initialize();assert.equal(h.records.rpc.length,1);
});
test('application boot automatically reads cloud once and profile renders never repeat it',async()=>{
 const {h,saved}=await bootGuest({initial:token(A),progress:true,hostname:'127.0.0.1',accountState:{xp:23}});
 await h.ctx.SVProgress.initialize(); // boot's default RPC mock is intentionally malformed
 assert.equal(h.ctx.SVProgressDebug.status().status,'error');assert.equal(vm.runInContext('user.id',h.ctx),A);assert.equal(vm.runInContext('state.xp',h.ctx),0);
 assert.equal(vm.runInContext('accountDataReady()',h.ctx),false);
 assert.match(vm.runInContext('renderProfile()',h.ctx),/— XP/);
 h.rpcResult(()=>({data:cloudSnapshot(),error:null}));await h.ctx.SVProgressDebug.retry();
 for(let i=0;i<5;i++)vm.runInContext("route='profile';renderProfile()",h.ctx);
 h.emit('TOKEN_REFRESHED',token(A));await new Promise(r=>setTimeout(r,5));
 assert.equal(h.records.rpc.length,2);assert.equal(h.ctx.SVProgressDebug.status().xp,42);assert.equal(vm.runInContext('state.xp',h.ctx),42);
 assert.equal(h.data.get('sv-guest-v2'),JSON.stringify(saved));assert.deepEqual(h.records.storageWrites,[]);
});

test('successful automatic read renders cloud account data with local dev writes disabled',async()=>{
 const {h,saved}=await bootGuest({initial:token(A),progress:true,hostname:'localhost',accountState:{xp:23,known:['local-only']},cloudSnapshot:cloudSnapshot()});
 await h.ctx.SVProgress.initialize();
 assert.equal(h.ctx.SVProgressDebug.status().status,'ready');assert.equal(h.ctx.SVProgressDebug.status().xp,42);
 assert.equal(vm.runInContext('state.xp',h.ctx),42);assert.equal(vm.runInContext('state.known[0]',h.ctx),'v-arbeta');
 assert.equal(JSON.parse(h.data.get('sv-account-local-v1-'+A)).xp,23);
 assert.equal(h.ctx.SVProgress.writeEnabled,false);
 for(let i=0;i<5;i++)vm.runInContext("route='profile';renderProfile()",h.ctx);
 await new Promise(r=>setTimeout(r,5));assert.equal(h.records.rpc.length,1);
 assert.equal(h.data.get('sv-guest-v2'),JSON.stringify(saved));assert.deepEqual(h.records.storageWrites,[]);
});

test('preview compares account and cloud without reading guest or writing/calling RPC',async()=>{
 const {h}=await bootGuest({initial:token(A),progress:true,hostname:'localhost',accountState:{xp:23,known:['v-arbeta'],favorites:['v-prata'],completed:[],booksRead:[],answered:4,correct:3,activity:{'2026-10-16':2}},cloudSnapshot:cloudSnapshot({content_version:'static-afaa62b7426e09a7'})});
 await h.ctx.SVProgress.initialize();
 const before=[...h.data],calls=h.records.rpc.length,reads=[];
 const read=h.ctx.localStorage.getItem;h.ctx.localStorage.getItem=key=>{reads.push(key);return read(key)};
 const p=h.ctx.SVProgressDebug.preview();
 assert.equal(p.status,'preview');assert.equal(p.account.compatible,true);
 assert.equal(p.account.summary.xp,23);assert.equal(p.cloud.xp,42);assert.equal(p.account.summary.accuracy,75);
 assert.equal(p.account.summary.activeDays,1);assert.equal(p.account.summary.favorites,1);
 assert.deepEqual(Array.from(p.account.differences.known.cloudOnly),['v-prata']);
 assert.equal(p.guest.status,'excluded');assert.deepEqual(reads,['sv-account-local-v1-'+A]);
 p.cloud.activity.changed=1;assert.equal(h.ctx.SVProgressDebug.preview().cloud.activity.changed,undefined);
 assert.equal(h.records.rpc.length,calls);assert.deepEqual(h.records.storageWrites,[]);assert.deepEqual([...h.data],before);
 assert.doesNotMatch(JSON.stringify(p),/test-jwt|access_token|avatarPath|person@example/);
 const g=h.ctx.SVProgressDebug.preview({includeGuest:true});assert.equal(g.guest.summary.xp,91);assert.equal(g.account.summary.xp,23);
});
test('preview rejects incompatible raw local data without sanitizing or falling back to guest',async()=>{
 const {h}=await bootGuest({initial:token(A),progress:true,hostname:'localhost',cloudSnapshot:cloudSnapshot({content_version:'static-afaa62b7426e09a7'})});
 await h.ctx.SVProgress.initialize();const key='sv-account-local-v1-'+A;
 assert.equal(h.ctx.SVProgressDebug.preview().account.status,'absent');
 const invalid=[null,[],{xp:null},{xp:1000000001},{correct:2,answered:1},{known:['unknown']},{known:null},{activity:{'2026-02-30':1}},{activity:{'2026-10-17':10001}},
  {reviews:{'v-arbeta':{due:4102444800001,interval:1,ease:2.5,rep:1}}},{settings:{language:'bad'}},{profile:{name:'x'.repeat(71)}}];
 for(const s of invalid){h.data.set(key,JSON.stringify(s));const p=h.ctx.SVProgressDebug.preview();assert.equal(p.account.compatible,false,JSON.stringify(s))}
 h.data.set(key,'{');assert.equal(h.ctx.SVProgressDebug.preview().account.status,'unreadable');
 assert.deepEqual(h.records.storageWrites,[]);assert.equal(h.records.rpc.length,1);
});
test('preview checks content version and clears access immediately on identity changes',async()=>{
 const {h}=await bootGuest({initial:token(A),progress:true,hostname:'localhost',accountState:{xp:23},cloudSnapshot:cloudSnapshot()});
 await h.ctx.SVProgress.initialize();
 assert.ok(h.ctx.SVProgressDebug.preview().account.issues.includes('CONTENT_VERSION_UNVERIFIED_OR_MISMATCH'));
 h.emit('SIGNED_IN',token(B));assert.equal(h.ctx.SVProgressDebug.preview().status,'unavailable');
 await h.ctx.SVAuth.signOut();assert.equal(h.ctx.SVProgressDebug.preview().status,'unavailable');
 assert.deepEqual(h.records.storageWrites,[]);
});
test('preview catalog version tracks actual static content and detects frozen manifest drift',()=>{
 const {execFileSync}=require('node:child_process');
 const version=execFileSync('python3',['-c',"import sys;sys.path.insert(0,'scripts');from check_supabase_manifest import current_manifest;print(current_manifest()['version'])"],{cwd:root,encoding:'utf8'}).trim();
 const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
 assert.ok(app.includes("version:'"+version+"'"));
});

// Deliberate in-memory IndexedDB/Web Locks model. These are unit tests, not
// browser or live Supabase evidence. Shared objects model reloads and tabs.
function writerEnvironment(){
 const stores=new Map(),tails=new Map(),data=new Map([['sv-cloud-write-dev-v1','enabled']]);
 const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
 const indexedDB={async databases(){return stores.size?[{name:"sv-cloud-events-v1",version:1}]:[]},open(){const req={};setImmediate(()=>{
  req.result={name:"sv-cloud-events-v1",version:1,close(){},objectStoreNames:{contains:name=>stores.has(name)},createObjectStore(name){stores.set(name,new Map())},transaction(name){
   const tx={objectStore(){const map=stores.get(name);const operation=fn=>{const r={};setImmediate(()=>{
    try{r.result=clone(fn());r.onsuccess?.();setImmediate(()=>tx.oncomplete?.())}catch(e){tx.onerror?.()}
   });return r};return {
    get:key=>operation(()=>map.get(key)),getAll:()=>operation(()=>[...map.values()]),
    put:row=>operation(()=>{const copy=clone(row),key=name==='events'?copy.sequence:copy.userId;map.set(key,copy);return key}),
    add:row=>operation(()=>{const key=map.size+1;map.set(key,{...clone(row),sequence:key});return key})
   }}};return tx}};
  if(stores.size===0)req.onupgradeneeded?.();req.onsuccess?.();
 });return req}};
 const locks={request(name,fn){const task=(tails.get(name)||Promise.resolve()).catch(()=>{}).then(fn);tails.set(name,task);return task}};
 return {stores,data,environment:{indexedDB,navigator:{locks},crypto:require('node:crypto').webcrypto,
  setTimeout:(fn,ms)=>{const timer=setTimeout(fn,ms);if(ms===15000)timer.unref();return timer},
  localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem(){throw Error('forbidden')},clear(){throw Error('forbidden')}}}};
}
function writerServer({wordState=false}={}){
 const accounts=new Map();let offline=false,loseAck=false,active=0,maxActive=0;
 function account(id){if(!accounts.has(id))accounts.set(id,{history:new Set(),snapshot:cloudSnapshot({capabilities:wordState?['unmark_known','review_grade','known_reward_once']:[],revision:0,content_version:'writer-test-v1',state:{...cloudSnapshot().state,known:[],favorites:[],xp:0,answered:0,correct:0}}),receipts:new Map()});return accounts.get(id)}
 async function request(h){
  active++;maxActive=Math.max(maxActive,active);
  try{
   await new Promise(r=>setImmediate(r));
   if(offline)throw Error('offline');
   const call=h.records.rpc.at(-1),id=call.headers.Authorization.replace('Bearer test-jwt-',''),a=account(id),args=call.args;
   if(call.name==='sl_get_progress')return {data:JSON.parse(JSON.stringify(a.snapshot))};
   assert.equal(call.name,'sl_apply_event');const event=args.p_event;
   if(a.receipts.has(args.p_event_id)){
    assert.equal(JSON.stringify(event),a.receipts.get(args.p_event_id));
    return {data:{duplicate:true,progress:JSON.parse(JSON.stringify(a.snapshot)),applied_revision:a.snapshot.revision}};
   }
   if(args.p_expected_revision!==a.snapshot.revision)return {error:{code:'40001'}};
   assert.ok(/(Z|[+-]\d\d:\d\d)$/.test(event.occurred_at));assert.ok(event.timezone);assert.equal(event.xp,undefined);assert.equal(event.data.xp,undefined);
   const s=a.snapshot.state,w=event.data.word_id;
   if(event.type==='mark_known'&&!s.known.includes(w)){s.known.push(w);if(!wordState||!a.history.has(w))s.xp+=8;a.history.add(w)}
   else if(event.type==='unmark_known'){assert.ok(wordState);s.known=s.known.filter(id=>id!==w)}
   else if(['mark_review','review_grade'].includes(event.type)){
    const previous=s.reviews[w]||{rep:0,interval:0,ease:2.5},ok=event.type==='review_grade'&&event.data.correct;
    s.reviews[w]={rep:ok?previous.rep+1:0,interval:ok?(previous.rep===0?1:3):0,ease:previous.ease,due:Date.parse(event.occurred_at)+(ok?86400000:600000)};
   }
   else if(event.type==='favorite_set')s.favorites=event.data.value?[...new Set([...s.favorites,w])]:s.favorites.filter(x=>x!==w);
   a.snapshot.revision++;a.receipts.set(args.p_event_id,JSON.stringify(event));
   if(loseAck){loseAck=false;throw Error('lost acknowledgement')}
   return {data:{duplicate:false,applied_revision:a.snapshot.revision,progress:JSON.parse(JSON.stringify(a.snapshot))}};
  }finally{active--}
 }
 return {account,request,get maxActive(){return maxActive},set offline(v){offline=v},set loseAck(v){loseAck=v}};
}
async function startWriter(shared=writerEnvironment(),server=writerServer(),id=A,extra={}){
 const h=harness({initial:token(id),progress:true,hostname:'localhost',environment:shared.environment,...extra});
 h.rpcResult(()=>server.request(h));const snapshots=[],errors=[];
 await h.ctx.SVProgress.initialize({previewCatalog:()=>({version:'writer-test-v1',words:['v-arbeta','v-prata']}),
  onSnapshot:(s,owner)=>snapshots.push({s,owner}),onError:e=>errors.push(e)});
 await h.ctx.SVProgressDebug?.flush();return {h,shared,server,snapshots,errors};
}
async function send(w,type,id='v-arbeta',value){
 assert.equal(await w.h.ctx.SVProgress.enqueue(type,id,value),true);await w.h.ctx.SVProgressDebug.flush();
}
test('HTTPS releases save account events without a dev flag; loopback remains opt-in',async()=>{
 const shared=writerEnvironment();shared.data.delete('sv-cloud-write-dev-v1');
 const w=await startWriter(shared,writerServer(),A,{hostname:'example.github.io'});
 assert.equal(w.h.ctx.SVProgress.writeEnabled,true);assert.equal(w.h.ctx.SVProgressDebug,undefined);
 assert.equal(await w.h.ctx.SVProgress.enqueue('mark_known','v-arbeta'),true);
 for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r));
 assert.equal(w.server.account(A).snapshot.state.xp,8);
 const reloaded=await startWriter(shared,w.server,A,{hostname:'example.github.io'});
 assert.equal(reloaded.snapshots.at(-1).s.xp,8);
 const local=harness({initial:token(A),progress:true,hostname:'localhost',environment:shared.environment});
 assert.equal(local.ctx.SVProgress.writeEnabled,false);
});
test('mark known and favorite add/remove publish server results; client sends no XP',async()=>{
 const w=await startWriter();await send(w,'mark_known');await send(w,'favorite_set','v-arbeta',true);await send(w,'favorite_set','v-arbeta',false);
 assert.equal(w.server.account(A).snapshot.state.xp,8);assert.equal(w.snapshots.at(-1).s.xp,8);
 assert.deepEqual(Array.from(w.snapshots.at(-1).s.favorites),[]);assert.equal(w.server.account(A).snapshot.revision,3);
 assert.ok([...w.shared.stores.get('events').values()].every(r=>r.status==='applied'));
});
test('lost ACK retries immutable event and UUID without a second XP award',async()=>{
 const w=await startWriter();w.server.loseAck=true;await send(w,'mark_known');
 assert.equal((await w.h.ctx.SVProgressDebug.queue()).events[0].status,'pending');
 await w.h.ctx.SVProgressDebug.flush();
 const calls=w.h.records.rpc.filter(r=>r.name==='sl_apply_event');assert.equal(calls.length,2);assert.deepEqual(calls[0].args,calls[1].args);
 assert.equal(w.server.account(A).snapshot.state.xp,8);assert.equal(w.server.account(A).snapshot.revision,1);
});
test('offline queue survives reload and preserves account, guest and backup bytes',async()=>{
 const w=await startWriter();w.shared.data.set('sv-guest-v2','guest-untouched');w.shared.data.set('backup','backup-untouched');
 w.server.offline=true;await send(w,'mark_known');const old=[...w.shared.stores.get('events').values()][0];
 w.server.offline=false;const reloaded=await startWriter(w.shared,w.server);
 assert.equal(w.server.account(A).snapshot.state.xp,8);const row=[...w.shared.stores.get('events').values()][0];
 assert.equal(row.eventId,old.eventId);assert.equal(row.eventJson,old.eventJson);assert.equal(row.status,'applied');
 assert.equal(w.shared.data.get('sv-guest-v2'),'guest-untouched');assert.equal(w.shared.data.get('backup'),'backup-untouched');
 assert.equal(reloaded.snapshots.at(-1).s.xp,8);
});
test('logout prevents sending; a different account never drains the first account queue; relogin resumes',async()=>{
 const w=await startWriter();w.server.offline=true;await send(w,'mark_known');await w.h.ctx.SVAuth.signOut();
 w.server.offline=false;await w.h.ctx.SVProgressDebug.flush();assert.equal(w.server.account(A).snapshot.state.xp,0);
 const other=await startWriter(w.shared,w.server,B);assert.equal(w.server.account(B).snapshot.state.xp,0);
 await send(other,'favorite_set','v-prata',true);assert.deepEqual(w.server.account(B).snapshot.state.favorites,['v-prata']);
 await startWriter(w.shared,w.server,A);assert.equal(w.server.account(A).snapshot.state.xp,8);assert.equal(w.server.account(B).snapshot.state.xp,0);
});
test('revision conflict rebases mark_known with the same event UUID/body',async()=>{
 const w=await startWriter();w.server.account(A).snapshot.revision=4;await send(w,'mark_known');
 const calls=w.h.records.rpc.filter(r=>r.name==='sl_apply_event');assert.equal(calls.length,2);
 assert.equal(calls[0].args.p_event_id,calls[1].args.p_event_id);assert.deepEqual(calls[0].args.p_event,calls[1].args.p_event);
 assert.equal(calls[0].args.p_expected_revision,0);assert.equal(calls[1].args.p_expected_revision,4);assert.equal(w.server.account(A).snapshot.state.xp,8);
});
test('favorite revision conflict stops stale intent until explicit acknowledgement and a new UI intent',async()=>{
 const w=await startWriter();w.server.account(A).snapshot.revision=1;await send(w,'favorite_set','v-arbeta',true);
 let q=await w.h.ctx.SVProgressDebug.queue();assert.equal(q.events[0].status,'conflict');
 await w.h.ctx.SVProgressDebug.flush();assert.equal(w.h.records.rpc.filter(r=>r.name==='sl_apply_event').length,1);
 assert.deepEqual(w.server.account(A).snapshot.state.favorites,[]);
 await w.h.ctx.SVProgressDebug.acknowledgeConflict(q.events[0].eventId);await w.h.ctx.SVProgressDebug.flush();
 assert.equal((await w.h.ctx.SVProgressDebug.queue()).events[0].status,'cancelled');
 await send(w,'favorite_set','v-arbeta',true);assert.deepEqual(w.server.account(A).snapshot.state.favorites,['v-arbeta']);
});
test('two tabs share a lock and send each durable intent only once',async()=>{
 const shared=writerEnvironment(),server=writerServer(),one=await startWriter(shared,server),two=await startWriter(shared,server);
 server.offline=true;await send(one,'mark_known');server.offline=false;
 await Promise.all([one.h.ctx.SVProgressDebug.flush(),two.h.ctx.SVProgressDebug.flush()]);
 assert.equal(server.account(A).snapshot.state.xp,8);assert.equal(server.account(A).snapshot.revision,1);assert.equal(server.maxActive,1);
});
test('local unsynced progress, changed baseline and content mismatch block without erasing data',async()=>{
 const shared=writerEnvironment();shared.data.set('sv-account-local-v1-'+A,JSON.stringify({xp:23}));
 const w=await startWriter(shared);assert.equal((await w.h.ctx.SVProgressDebug.queue()).error,'LOCAL_PROGRESS_CONFLICT');
 assert.equal(await w.h.ctx.SVProgress.enqueue('mark_known','v-arbeta'),false);assert.equal(shared.data.get('sv-account-local-v1-'+A),'{"xp":23}');
 const ok=await startWriter();ok.shared.data.set('sv-account-local-v1-'+A,'{"xp":9}');
 assert.equal(await ok.h.ctx.SVProgress.enqueue('mark_known','v-arbeta'),false);assert.equal(ok.server.account(A).snapshot.revision,0);
 const version=await startWriter();version.server.account(A).snapshot.content_version='other';
 assert.equal(await version.h.ctx.SVProgress.enqueue('mark_known','v-arbeta'),true);await version.h.ctx.SVProgressDebug.flush();
 assert.equal(version.h.records.rpc.filter(r=>r.name==='sl_apply_event').length,0);
 assert.equal((await version.h.ctx.SVProgressDebug.queue()).error,'CONTENT_VERSION_MISMATCH');
});
test('missing IndexedDB or Web Locks fails closed and queues no mutation',async()=>{
 for(const override of [{indexedDB:undefined},{navigator:{}}]){
  const shared=writerEnvironment();Object.assign(shared.environment,override);const w=await startWriter(shared);
  assert.equal(await w.h.ctx.SVProgress.enqueue('mark_known','v-arbeta'),false);assert.equal(w.server.account(A).snapshot.revision,0);
 }
});

test('UI handlers enqueue supported actions without local XP and block other account mutations',async()=>{
 const w=await startWriter(),h=w.h;
 const source=fs.readFileSync(path.join(root,'app.js'),'utf8').replace(/\nboot\(\);/g,'');vm.runInContext(source,h.ctx);
 h.ctx.document.querySelector=()=>null;h.ctx.scrollTo=()=>{};
 vm.runInContext("toast=()=>{};headerStats=()=>{};render=()=>{};user={id:'"+A+"'};state=defaultState();WORDS=[{id:'v-arbeta'}]",h.ctx);
 await h.ctx.SVProgress.initialize({onSnapshot:s=>{h.ctx.serverState=s;vm.runInContext('state=sanitize(serverState)',h.ctx)}});
 await h.ctx.SVProgressDebug.flush();
 vm.runInContext("action({dataset:{action:'mark-known',id:'v-arbeta'}})",h.ctx);
 assert.equal(vm.runInContext('state.xp',h.ctx),0);
 // Enqueue waits for IDB commit; allow it to acquire the cross-tab lock.
 await new Promise(r=>setTimeout(r,10));await h.ctx.SVProgressDebug.flush();
 assert.equal(vm.runInContext('state.xp',h.ctx),8);assert.equal(vm.runInContext('state.known.length',h.ctx),1);
 vm.runInContext("mutate(()=>{state.xp+=100;state.answered++})",h.ctx);
 assert.equal(vm.runInContext('state.xp',h.ctx),8);assert.equal(vm.runInContext('state.answered',h.ctx),0);
 assert.equal(w.shared.data.get('sv-account-local-v1-'+A),undefined);
});
test('multiple offline intents retain order and immutable bodies across recovery',async()=>{
 const w=await startWriter();w.server.offline=true;
 await send(w,'mark_known','v-arbeta');await send(w,'favorite_set','v-arbeta',true);await send(w,'mark_known','v-prata');
 const before=[...w.shared.stores.get('events').values()].map(r=>[r.eventId,r.eventJson]);
 w.server.offline=false;await w.h.ctx.SVProgressDebug.flush();
 assert.equal(w.server.account(A).snapshot.state.xp,16);assert.equal(w.server.account(A).snapshot.revision,3);
 assert.deepEqual(w.server.account(A).snapshot.state.favorites,['v-arbeta']);
 assert.deepEqual([...w.shared.stores.get('events').values()].map(r=>[r.eventId,r.eventJson]),before);
});
test('queue write failure sends nothing and existing event records are never cleared',async()=>{
 const w=await startWriter();w.server.offline=true;await send(w,'mark_known');
 const original=w.shared.stores.get('events');const before=JSON.stringify([...original]);
 original.set=()=>{throw Error('quota')};
 assert.equal(await w.h.ctx.SVProgress.enqueue('mark_known','v-prata'),false);
 assert.equal(JSON.stringify([...original]),before);assert.equal(w.server.account(A).snapshot.revision,0);
});
test('reload while offline resumes existing queue on the online event after the initial read failed',async()=>{
 const w=await startWriter();w.server.offline=true;await send(w,'mark_known');
 const handlers={};w.shared.environment.addEventListener=(name,fn)=>handlers[name]=fn;
 const reloaded=await startWriter(w.shared,w.server);
 assert.equal(reloaded.h.ctx.SVProgressDebug.status().status,'error');assert.ok(handlers.online);
 w.server.offline=false;await handlers.online();
 assert.equal(w.server.account(A).snapshot.state.xp,8);assert.equal((await reloaded.h.ctx.SVProgressDebug.queue()).events[0].status,'applied');
});


test('current debug export has queue and version even with writes disabled and no session',async()=>{
 const h=harness({progress:true,hostname:'localhost'});
 for(const name of ['status','retry','preview','queue','diagnostics'])assert.equal(typeof h.ctx.SVProgressDebug[name],'function');
 assert.equal(h.ctx.SVProgressDebug.moduleVersion,'2026-10-18-account-cloud-1');
 const d=await h.ctx.SVProgressDebug.diagnostics();
 assert.equal(d.writeEnabled,false);assert.equal(d.queue.ready,false);
 assert.equal(d.queue.storage.status,'unavailable');assert.equal(d.queue.events.length,0);
 assert.equal(h.records.rpc.length,0);assert.deepEqual(h.records.storageWrites,[]);
});
test('flag requires reload and exact enabled value; diagnostic reads preserve disabled queue',async()=>{
 const shared=writerEnvironment(),w=await startWriter(shared);w.server.offline=true;await send(w,'mark_known');
 const before=JSON.stringify([...shared.stores].map(([name,rows])=>[name,[...rows]])),bytes=JSON.stringify([...shared.data]);
 shared.data.set('sv-cloud-write-dev-v1','disabled');
 assert.equal((await w.h.ctx.SVProgressDebug.diagnostics()).reloadRequired,true);
 const h=harness({progress:true,initial:token(A),hostname:'localhost',environment:shared.environment});
 h.rpcResult(()=>({data:cloudSnapshot()}));await h.ctx.SVProgress.initialize();
 const calls=h.records.rpc.length;
 const q=await h.ctx.SVProgressDebug.queue();assert.equal(q.enabled,false);assert.equal(q.events[0].status,'pending');
 assert.equal(q.storage.status,'ready');assert.equal(q.storage.version,1);
 assert.equal(h.records.rpc.length,calls);assert.equal(JSON.stringify([...shared.stores].map(([name,rows])=>[name,[...rows]])),before);
 shared.data.set('sv-cloud-write-dev-v1','enabled');
 const d=await h.ctx.SVProgressDebug.diagnostics();assert.equal(d.reloadRequired,true);assert.equal(d.writeEnabled,false);
 assert.equal(JSON.stringify([...shared.data]),bytes);
 for(const value of ['true','1','Enabled']){
  shared.data.set('sv-cloud-write-dev-v1',value);
  assert.equal(harness({progress:true,hostname:'localhost',environment:shared.environment}).ctx.SVProgress.writeEnabled,false);
 }
});
test('inspection of absent, inaccessible or unsupported IDB never opens or creates a database',async()=>{
 for(const [indexedDB,status] of [
  [{databases:async()=>[]},'absent'],
  [{databases:async()=>{throw Error('denied')}},'error'],
  [{},'unsupported']
 ]){
  indexedDB.open=()=>{throw Error('inspection must not open absent database')};
  const h=harness({progress:true,hostname:'localhost',environment:{indexedDB}});
  assert.equal((await h.ctx.SVProgressDebug.queue()).storage.status,status);
  assert.equal(h.records.rpc.length,0);assert.deepEqual(h.records.storageWrites,[]);
 }
});
test('inspection hides other accounts and signed-out rows without enabling writes',async()=>{
 const w=await startWriter();w.server.offline=true;await send(w,'mark_known');
 w.shared.stores.get('events').set(99,{sequence:99,userId:B,eventId:'other-account',eventJson:'{}',status:'pending'});
 assert.equal((await w.h.ctx.SVProgressDebug.queue()).events.length,1);
 await w.h.ctx.SVAuth.signOut();assert.equal((await w.h.ctx.SVProgressDebug.queue()).events.length,0);
});
test('IDB inspection reports blocked opens and aborts a disappeared database upgrade',async()=>{
 for(const mode of ['blocked','missing']){
  let aborted=false;
  const indexedDB={databases:async()=>[{name:'sv-cloud-events-v1',version:1}],open(){
   const req={transaction:{abort(){aborted=true}}};setImmediate(()=>mode==='blocked'?req.onblocked():req.onupgradeneeded());return req;
  }};
  const h=harness({progress:true,hostname:'localhost',environment:{indexedDB}});
  assert.equal((await h.ctx.SVProgressDebug.queue()).storage.status,mode==='blocked'?'blocked':'absent');
  assert.equal(aborted,mode==='missing');assert.equal(h.records.rpc.length,0);
 }
});

test('account change during diagnostic IDB read hides the captured account events',async()=>{
 const w=await startWriter();w.server.offline=true;await send(w,'mark_known');
 const original=w.h.ctx.indexedDB.databases;let release;
 w.h.ctx.indexedDB.databases=()=>new Promise(resolve=>{release=resolve});
 const inspection=w.h.ctx.SVProgressDebug.queue();
 await w.h.ctx.SVAuth.signOut();release(await original());
 const q=await inspection;assert.equal(q.ready,false);assert.equal(q.events.length,0);
});

test('repeated learned clicks and concurrent pending intents produce one durable mark_known',async()=>{
 const w=await startWriter();w.server.offline=true;
 await Promise.all([w.h.ctx.SVProgress.enqueue('mark_known','v-arbeta'),w.h.ctx.SVProgress.enqueue('mark_known','v-arbeta')]);
 await w.h.ctx.SVProgressDebug.flush();
 assert.equal((await w.h.ctx.SVProgressDebug.queue()).events.length,1);
 assert.equal(w.snapshots.at(-1).s.xp,0);
 w.server.offline=false;await w.h.ctx.SVProgress.retry();
 await w.h.ctx.SVProgress.enqueue('mark_known','v-arbeta');await w.h.ctx.SVProgressDebug.flush();
 assert.equal((await w.h.ctx.SVProgressDebug.queue()).events.length,1);
 assert.equal(w.server.account(A).snapshot.revision,1);assert.equal(w.snapshots.at(-1).s.xp,8);
});

test('activity feedback exposes pending state, reports success only after ACK, and stays account scoped',async()=>{
 const w=await startWriter(),updates=[];
 await w.h.ctx.SVProgress.initialize({onActivity:s=>updates.push(s)});
 w.server.offline=true;await send(w,'favorite_set','v-arbeta',true);
 assert.equal(updates.some(s=>s.completed),false);
 assert.equal(w.h.ctx.SVProgress.activity().pending[0].wordId,'v-arbeta');
 assert.deepEqual(Array.from(w.snapshots.at(-1).s.favorites),[]);assert.equal(w.snapshots.at(-1).s.xp,0);
 const detached=w.h.ctx.SVProgress.activity();detached.pending.length=0;
 assert.equal(w.h.ctx.SVProgress.activity().pending.length,1);
 w.server.offline=false;await w.h.ctx.SVProgress.retry();
 assert.equal(updates.filter(s=>s.completed).length,1);
 assert.equal(updates.find(s=>s.completed).completed.type,'favorite_set');
 assert.equal(w.h.ctx.SVProgress.activity().pending.length,0);assert.equal(w.snapshots.at(-1).s.xp,0);
 await w.h.ctx.SVAuth.signOut();assert.equal(w.h.ctx.SVProgress.activity().pending.length,0);
});

test('dictionary and flashcard know actions share IDs and server XP, while repeat stays separate',async()=>{
 const w=await startWriter(),h=w.h;
 const source=fs.readFileSync(path.join(root,'app.js'),'utf8').replace(/\nboot\(\);/g,'');vm.runInContext(source,h.ctx);
 h.ctx.document.querySelector=()=>null;h.ctx.scrollTo=()=>{};
 vm.runInContext("toast=()=>{};headerStats=()=>{};render=()=>{};user={id:'"+A+"'};state=defaultState();WORDS=[{id:'v-arbeta',word:'arbeta',ru:'работать',type:'verb'},{id:'v-prata',word:'prata',ru:'говорить',type:'verb'}];flash.ids=['v-arbeta'];",h.ctx);
 await h.ctx.SVProgress.initialize({onSnapshot:s=>{h.ctx.serverState=s;vm.runInContext('state=sanitize(serverState)',h.ctx)}});
 await h.ctx.SVProgressDebug.flush();
 await vm.runInContext("action({dataset:{action:'flash-grade',value:'1'}})",h.ctx);await h.ctx.SVProgressDebug.flush();
 await vm.runInContext("action({dataset:{action:'mark-known',id:'v-arbeta'}})",h.ctx);await h.ctx.SVProgressDebug.flush();
 assert.equal(h.records.rpc.filter(r=>r.name==='sl_apply_event').length,1);assert.equal(vm.runInContext('state.xp',h.ctx),8);
 await vm.runInContext("action({dataset:{action:'flash-grade',value:'0'}})",h.ctx);
 await vm.runInContext("action({dataset:{action:'mark-review',id:'v-arbeta'}})",h.ctx);
 assert.equal(h.records.rpc.filter(r=>r.name==='sl_apply_event').length,1);
 assert.match(vm.runInContext("wordEntry(WORDS[0])",h.ctx),/aria-label="✓ Знаю" title="✓ Знаю">✓ Знаю<\/button>/);
 assert.match(vm.runInContext("routeParam='v-arbeta';renderWord()",h.ctx),/✓ Знаю/);
 assert.match(vm.runInContext('renderProfile()',h.ctx),/data-action="show-learned"/);
 assert.equal(vm.runInContext("routeParam='learned';filteredWords().map(w=>w.id).join(',')",h.ctx),'v-arbeta');
 assert.equal(vm.runInContext("flashFilter.scope='known';createFlashDeck();flash.ids.join(',')",h.ctx),'v-arbeta');
 assert.doesNotMatch(vm.runInContext("authText('local')",h.ctx),/Supabase|RPC|IndexedDB/);
});

test('guest known actions remain local and award XP once per word',async()=>{
 const h=harness();vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8').replace(/\nboot\(\);/g,''),h.ctx);
 vm.runInContext("render=()=>{};headerStats=()=>{};WORDS=[{id:'v-arbeta'}];state=defaultState();",h.ctx);
 await vm.runInContext("learnWord('v-arbeta')",h.ctx);await vm.runInContext("learnWord('v-arbeta')",h.ctx);
 assert.equal(vm.runInContext('state.xp',h.ctx),8);assert.equal(JSON.parse(h.data.get('sv-guest-v2')).known.length,1);
 assert.equal(h.records.rpc.length,0);
});

test('explicit retry of a rejected event retains its original UUID and body',async()=>{
 const w=await startWriter();let reject=true;
 w.h.rpcResult(()=>w.h.records.rpc.at(-1).name==='sl_apply_event'&&reject?{error:{code:'22023'}}:w.server.request(w.h));
 await send(w,'mark_known');
 assert.equal((await w.h.ctx.SVProgressDebug.queue()).events[0].status,'blocked');
 await w.h.ctx.SVProgressDebug.flush();
 assert.equal(w.h.records.rpc.filter(r=>r.name==='sl_apply_event').length,1);
 reject=false;await w.h.ctx.SVProgress.retry();
 const calls=w.h.records.rpc.filter(r=>r.name==='sl_apply_event');
 assert.equal(calls.length,2);assert.equal(calls[0].args.p_event_id,calls[1].args.p_event_id);
 assert.deepEqual(calls[0].args.p_event,calls[1].args.p_event);assert.equal(w.snapshots.at(-1).s.xp,8);
});

test('accepting current favorites retains cancelled conflict and requires a new explicit favorite intent',async()=>{
 const w=await startWriter();w.server.account(A).snapshot.revision=1;
 await send(w,'favorite_set','v-arbeta',true);
 await w.h.ctx.SVProgress.acceptCurrentFavorites();
 assert.equal((await w.h.ctx.SVProgressDebug.queue()).events[0].status,'cancelled');
 assert.equal(w.h.ctx.SVProgress.activity().pending.length,0);
 assert.deepEqual(Array.from(w.snapshots.at(-1).s.favorites),[]);
 await send(w,'favorite_set','v-arbeta',true);
 assert.deepEqual(Array.from(w.snapshots.at(-1).s.favorites),['v-arbeta']);assert.equal(w.snapshots.at(-1).s.xp,0);
});

async function wordStateWriter(){return startWriter(writerEnvironment(),writerServer({wordState:true}))}
function loadWordUI(w){
 const h=w.h;vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8').replace(/\nboot\(\);/g,''),h.ctx);
 h.ctx.document.querySelector=()=>null;h.ctx.scrollTo=()=>{};
 vm.runInContext("render=()=>{};toast=()=>{};headerStats=()=>{};user={id:'"+A+"'};state=defaultState();WORDS=[{id:'v-arbeta',word:'arbeta',inf:'arbeta',ru:'работать',type:'verb',group:'1',category:'Работа'},{id:'v-prata',word:'prata',inf:'prata',ru:'говорить',type:'verb',group:'1',category:'Общение'},{id:'lex-0357',word:'hörlurar',ru:'наушники',type:'noun',category:'Техника'}]",h.ctx);
 return h.ctx.SVProgress.initialize({onSnapshot:s=>{h.ctx.serverState=s;vm.runInContext('state=sanitize(serverState)',h.ctx)}}).then(()=>h.ctx.SVProgressDebug.flush());
}

test('new word actions stay gated until the server explicitly advertises capabilities',async()=>{
 const w=await startWriter();assert.equal(w.h.ctx.SVProgress.supports('unmark_known'),false);
 assert.equal(await w.h.ctx.SVProgress.enqueue('unmark_known','v-arbeta'),false);
 assert.equal(await w.h.ctx.SVProgress.enqueue('review_grade','v-arbeta',true),false);
 assert.equal((await w.h.ctx.SVProgressDebug.queue()).events.length,0);
});

test('known toggle removes the mark without confirmation, retains XP across reload and relogin',async()=>{
 const w=await wordStateWriter();await loadWordUI(w);
 await vm.runInContext("learnWord('v-arbeta')",w.h.ctx);await w.h.ctx.SVProgressDebug.flush();
 await vm.runInContext("action({dataset:{action:'mark-known',id:'v-arbeta'}})",w.h.ctx);
 await w.h.ctx.SVProgressDebug.flush();
 assert.equal((await w.h.ctx.SVProgressDebug.queue()).events.length,2,'one toggle sends one unmark event');
 assert.equal(vm.runInContext('state.known.length',w.h.ctx),0);assert.equal(vm.runInContext('state.xp',w.h.ctx),8);
 assert.equal(vm.runInContext("routeParam='learned';filteredWords().length",w.h.ctx),0);
 assert.equal(vm.runInContext("routeParam='';filteredWords().length",w.h.ctx),3,'unmarked word remains in general dictionary');
 const reloaded=await startWriter(w.shared,w.server);assert.equal(reloaded.snapshots.at(-1).s.known.length,0);
 await reloaded.h.ctx.SVAuth.signOut();const relogged=await startWriter(w.shared,w.server);
 await send(relogged,'mark_known');assert.equal(relogged.snapshots.at(-1).s.xp,8);assert.equal(relogged.snapshots.at(-1).s.known.length,1);
});

test('offline unmark and lost ACK preserve UUID and award history, then recover on reload',async()=>{
 const w=await wordStateWriter();await send(w,'mark_known');w.server.offline=true;
 await send(w,'unmark_known');await w.h.ctx.SVProgress.enqueue('unmark_known','v-arbeta');
 assert.equal((await w.h.ctx.SVProgressDebug.queue()).events.length,2);
 assert.equal(w.snapshots.at(-1).s.known.length,1,'no optimistic unmark');
 const intent=[...w.shared.stores.get('events').values()][1];w.server.offline=false;w.server.loseAck=true;
 await w.h.ctx.SVProgress.retry();assert.equal(w.server.account(A).snapshot.state.known.length,0);
 const reloaded=await startWriter(w.shared,w.server);await reloaded.h.ctx.SVProgressDebug.flush();
 const receipt=[...w.shared.stores.get('events').values()][1];
 assert.equal(receipt.eventId,intent.eventId);assert.equal(receipt.eventJson,intent.eventJson);assert.equal(receipt.status,'applied');
 await send(reloaded,'mark_known');assert.equal(reloaded.snapshots.at(-1).s.xp,8);
});

test('word status revision conflicts never silently overwrite a newer decision',async()=>{
 const w=await wordStateWriter();await send(w,'mark_known');w.server.account(A).snapshot.revision++;
 await send(w,'unmark_known');assert.equal((await w.h.ctx.SVProgressDebug.queue()).events[1].status,'conflict');
 assert.equal(w.server.account(A).snapshot.state.known.length,1);
 await w.h.ctx.SVProgress.acceptCurrentWordState();
 assert.equal((await w.h.ctx.SVProgressDebug.queue()).events[1].status,'cancelled');
 await send(w,'unmark_known');assert.equal(w.server.account(A).snapshot.state.known.length,0);
 // An old mark_known is also a mutable intent once the server supports unmark.
 w.server.account(A).snapshot.revision++;await send(w,'mark_known');
 assert.equal((await w.h.ctx.SVProgressDebug.queue()).events[3].status,'conflict');
 assert.equal(w.snapshots.at(-1).s.xp,8);
});

test('existing review_grade events retain SRS semantics without clearing known or adding XP',async()=>{
 const w=await wordStateWriter();await send(w,'mark_known');await send(w,'review_grade','v-arbeta',true);
 assert.equal(w.server.account(A).snapshot.state.reviews['v-arbeta'].rep,1);
 await send(w,'review_grade','v-arbeta',false);
 assert.equal(w.server.account(A).snapshot.state.reviews['v-arbeta'].rep,0);
 assert.equal(w.server.account(A).snapshot.state.known.length,1);assert.equal(w.server.account(A).snapshot.state.xp,8);
});

test('guest unmark preserves history, favorites and XP after saving and rereading',async()=>{
 const h=harness();vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8').replace(/\nboot\(\);/g,''),h.ctx);
 h.ctx.document.querySelector=()=>null;
 vm.runInContext("render=()=>{};toast=()=>{};headerStats=()=>{};WORDS=[{id:'v-arbeta'}];state=sanitize({known:['v-arbeta'],favorites:['v-arbeta'],xp:8,reviews:{'v-arbeta':{rep:2,interval:3,ease:2.6,due:123}}})",h.ctx);
 await vm.runInContext("unlearnWord('v-arbeta')",h.ctx);
 assert.equal(vm.runInContext("state.reviews['v-arbeta'].rep",h.ctx),2);assert.equal(vm.runInContext('state.favorites.length',h.ctx),1);
 vm.runInContext('state=readLocalState()',h.ctx);await vm.runInContext("learnWord('v-arbeta')",h.ctx);
 assert.equal(vm.runInContext('state.xp',h.ctx),8);assert.equal(h.records.rpc.length,0);
});

test('learned, favorites, search, group and category filters have explicit scopes and reliable resets',async()=>{
 const w=await wordStateWriter();await loadWordUI(w);
 vm.runInContext("state.known=['v-arbeta','lex-0357'];state.favorites=['lex-0357'];route='dictionary';routeParam='learned';dictFilter.fav=true",w.h.ctx);
 assert.equal(vm.runInContext('filteredWords().length',w.h.ctx),2,'stale hidden favorite flag cannot hide learned words');
 vm.runInContext("dictFilter.text='hör';dictFilter.category='Техника'",w.h.ctx);
 assert.equal(vm.runInContext('filteredWords()[0].id',w.h.ctx),'lex-0357');
 vm.runInContext("dictFilter.group='1'",w.h.ctx);assert.equal(vm.runInContext('filteredWords().length',w.h.ctx),0);
 assert.match(vm.runInContext('renderDictionary()',w.h.ctx),/Сбрось поиск и фильтры/);
 await vm.runInContext("action({dataset:{action:'dict-reset'}})",w.h.ctx);assert.equal(vm.runInContext('filteredWords().length',w.h.ctx),2);
 vm.runInContext("navigate('dictionary','favorites')",w.h.ctx);assert.equal(vm.runInContext('filteredWords()[0].id',w.h.ctx),'lex-0357');
 vm.runInContext("dictFilter.text='does-not-exist';navigate('home');navigate('dictionary')",w.h.ctx);assert.equal(vm.runInContext('filteredWords().length',w.h.ctx),3);
 vm.runInContext("location.hash='#dictionary/learned';hydrateLocation()",w.h.ctx);assert.equal(vm.runInContext('filteredWords().length',w.h.ctx),2);
});


test('a stale UI identity cannot send an unmark to the previous account',async()=>{
 const w=await wordStateWriter();await loadWordUI(w);await send(w,'mark_known');
 vm.runInContext("user={id:'"+B+"'}",w.h.ctx);
 await vm.runInContext("unlearnWord('v-arbeta')",w.h.ctx);
 assert.equal((await w.h.ctx.SVProgressDebug.queue()).events.length,1);
 assert.equal(w.server.account(A).snapshot.state.known.length,1);
});

test('automatic SRS words cannot start manual review when manual queue is unavailable',async()=>{
 const w=await wordStateWriter();await loadWordUI(w);
 vm.runInContext("state.reviews={'v-arbeta':{due:0,rep:0,interval:0,ease:2.5}}",w.h.ctx);
 await vm.runInContext("action({dataset:{action:'start-review'}})",w.h.ctx);
 assert.equal(vm.runInContext("route+'|'+routeParam",w.h.ctx),'home|');
 assert.equal(vm.runInContext('quiz.active',w.h.ctx),false);
 assert.equal((await w.h.ctx.SVProgressDebug.queue()).events.length,0,'opening exercise does not record a result');
});

test('pending new events remain durable and unsent if server support is withdrawn',async()=>{
 const w=await wordStateWriter();await send(w,'mark_known');w.server.offline=true;await send(w,'unmark_known');
 w.server.account(A).snapshot.capabilities=[];w.server.offline=false;
 const before=w.h.records.rpc.filter(r=>r.name==='sl_apply_event').length;
 await w.h.ctx.SVProgress.retry();
 assert.equal(w.h.records.rpc.filter(r=>r.name==='sl_apply_event').length,before);
 assert.equal((await w.h.ctx.SVProgressDebug.queue()).error,'FEATURE_UNAVAILABLE');
 assert.equal((await w.h.ctx.SVProgressDebug.queue()).events[1].status,'pending');
 w.server.account(A).snapshot.capabilities=['unmark_known','review_grade'];await w.h.ctx.SVProgress.retry();
 assert.equal(w.snapshots.at(-1).s.known.length,0);assert.equal(w.snapshots.at(-1).s.xp,8);
});

test('study RPC adapters bind all four operations to verified owner, preserve UUID and do not retry',async()=>{
 const h=harness({initial:token(A)});await h.ctx.SVAuth.initialize();
 await h.ctx.SVRpc.studyStatus({expectedUserId:A,month:'2026-10-01'});
 await h.ctx.SVRpc.studySettings({expectedUserId:A,enabled:true,timezone:'Europe/Stockholm',generation:0});
 await h.ctx.SVRpc.studyOpen({expectedUserId:A,leaseId:eid});
 await h.ctx.SVRpc.studyCommit({expectedUserId:A,id:eid,leaseId:eid,segments:[[1000,2000]],close:true});
 assert.deepEqual(h.records.rpc.map(r=>r.name),['sl_study_status','sl_study_settings','sl_study_open','sl_study_commit']);
 assert.equal(h.records.rpc[0].args.p_month,'2026-10-01');assert.equal(h.records.rpc[1].args.p_generation,0);
 assert.equal(h.records.rpc[3].args.p_id,eid);assert.equal(h.records.rpc[3].args.p_close,true);
 for(const row of h.records.rpc){assert.equal(row.headers.Authorization,'Bearer '+token(A).access_token);assert.equal(row.retry,false)}
 assert.equal(h.records.storageWrites.length,0);
});
test('study RPC refuses guest and mismatched account before any network mutation',async()=>{
 const h=harness({initial:token(A)});
 for(const name of ['studyStatus','studySettings','studyOpen','studyCommit'])await assert.rejects(h.ctx.SVRpc[name]({expectedUserId:B}),rejectCode('AUTH_USER_MISMATCH'));
 const g=harness();await assert.rejects(g.ctx.SVRpc.studyOpen({expectedUserId:A,leaseId:eid}),rejectCode('AUTH_USER_MISMATCH'));
 assert.equal(h.records.rpc.length+g.records.rpc.length,0);
});
test('in-flight study response is discarded when account changes',async()=>{
 const h=harness({initial:token(A)});let finish,started;
 const start=new Promise(resolve=>started=resolve);h.rpcResult(()=>new Promise(resolve=>{finish=resolve;started()}));
 const pending=h.ctx.SVRpc.studyOpen({expectedUserId:A,leaseId:eid});await start;
 h.emit('SIGNED_IN',token(B));finish({data:{available:true},error:null});
 await assert.rejects(pending,rejectCode('AUTH_CONTEXT_CHANGED'));
 assert.equal(h.records.rpc[0].headers.Authorization,'Bearer '+token(A).access_token);
});


test('hung progress read times out, leaves stored progress intact and ignores a late response',async()=>{
 const h=harness({initial:token(A),progress:true,hostname:'localhost'});await h.ctx.SVAuth.initialize();
 let release;h.rpcResult(()=>new Promise(r=>release=r));
 const originalTimeout=h.ctx.setTimeout;h.ctx.setTimeout=(fn,ms)=>originalTimeout(fn,ms===8000?10:ms);
 await h.ctx.SVProgress.initialize();
 assert.equal(h.ctx.SVProgressDebug.status().status,'error');
 assert.equal(h.data.get('sv-guest-v2'),'original-guest');
 release({data:cloudSnapshot(),error:null});await new Promise(r=>setImmediate(r));
 assert.equal(h.ctx.SVProgressDebug.status().status,'error');
 h.rpcResult(()=>({data:cloudSnapshot(),error:null}));await h.ctx.SVProgressDebug.retry();
 assert.equal(h.ctx.SVProgressDebug.status().status,'ready');
});

test('HTTPS profile restores Supabase XP after reload and relogin, without importing legacy or guest data',async()=>{
 const progress=cloudSnapshot({revision:29,state:{...cloudSnapshot().state,xp:1280,known:['v-prata']}});
 const options={initial:token(A),progress:true,hostname:'example.github.io',accountState:{xp:0},cloudSnapshot:progress};
 for(let reload=0;reload<2;reload++){
  const {h,saved}=await bootGuest(options);await h.ctx.SVProgress.initialize();
  assert.equal(vm.runInContext('state.xp',h.ctx),1280);
  assert.equal(vm.runInContext('state.known[0]',h.ctx),'v-prata');
  assert.equal(vm.runInContext('accountDataReady()',h.ctx),true);
  await h.ctx.SVAuth.signOut();await new Promise(r=>setTimeout(r,5));
  assert.equal(vm.runInContext('state.xp',h.ctx),91);
  await h.ctx.SVAuth.signIn({email:'test@example.test',password:'test-password'});
  await new Promise(r=>setTimeout(r,5));
  assert.equal(vm.runInContext('state.xp',h.ctx),1280);
  assert.equal(h.data.get('sv-guest-v2'),JSON.stringify(saved));
  assert.equal(h.data.get('sv-account-local-v1-'+A),JSON.stringify({xp:0}));
  assert.deepEqual(h.records.storageWrites,[]);
  assert.ok(h.records.rpc.every(r=>r.name==='sl_get_progress'));
 }
});
