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
function harness({conf=config,initial=null,failSdk=false,failSession=false,hash='#profile',search='',callbackFails=false,progress=false,hostname='example.github.io'}={}){
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
  document:{addEventListener(){},createElement(){return {dataset:{},remove(){this.removed=true}}},
   head:{appendChild(node){records.scripts.push(node);queueMicrotask(()=>{
    if(failSdk){node.onerror?.();return}
    ctx.supabase={createClient(url,key,options){records.clients.push({url,key,options});return client}};
    node.onload?.();
   })}}
  }
 };
 ctx.window=ctx;ctx.addEventListener=()=>{};vm.createContext(ctx);
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
test('account switches and signout keep guest, each account and backups isolated',async()=>{
 const {h,saved}=await bootGuest({initial:token(A)});
 vm.runInContext('state.xp=25;save()',h.ctx);
 assert.equal(JSON.parse(h.data.get('sv-account-local-v1-'+A)).xp,25);
 h.emit('SIGNED_IN',token(B));await new Promise(r=>setTimeout(r,5));
 assert.equal(vm.runInContext('state.xp',h.ctx),0);
 vm.runInContext('state.xp=8;save()',h.ctx);
 h.emit('SIGNED_IN',token(A));await new Promise(r=>setTimeout(r,5));
 assert.equal(vm.runInContext('state.xp',h.ctx),25);
 await h.ctx.SVAuth.signOut();await new Promise(r=>setTimeout(r,5));
 assert.equal(vm.runInContext('user',h.ctx),null);assert.equal(vm.runInContext('state.xp',h.ctx),91);
 assert.equal(h.data.get('sv-guest-v2'),JSON.stringify(saved));assert.equal(h.data.get('sv-cloud-backup-'+A),'original-backup');
 assert.equal(JSON.parse(h.data.get('sv-account-local-v1-'+B)).xp,8);assert.deepEqual(h.records.rpc,[]);
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

test('reload restores existing local account progress without taking guest progress',async()=>{
 const {h,saved}=await bootGuest({initial:token(A),accountState:{xp:34,known:['v-prata']}});
 assert.equal(vm.runInContext('user.id',h.ctx),A);assert.equal(vm.runInContext('state.xp',h.ctx),34);
 assert.equal(vm.runInContext('state.known[0]',h.ctx),'v-prata');
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
 assert.equal(h.ctx.SVProgressDebug.status().status,'error');assert.equal(vm.runInContext('user.id',h.ctx),A);assert.equal(vm.runInContext('state.xp',h.ctx),23);
 h.rpcResult(()=>({data:cloudSnapshot(),error:null}));await h.ctx.SVProgressDebug.retry();
 for(let i=0;i<5;i++)vm.runInContext("route='profile';renderProfile()",h.ctx);
 h.emit('TOKEN_REFRESHED',token(A));await new Promise(r=>setTimeout(r,5));
 assert.equal(h.records.rpc.length,2);assert.equal(h.ctx.SVProgressDebug.status().xp,42);assert.equal(vm.runInContext('state.xp',h.ctx),23);
 assert.equal(h.data.get('sv-guest-v2'),JSON.stringify(saved));assert.deepEqual(h.records.storageWrites,[]);
});

test('successful automatic read on restored login never replaces local account progress',async()=>{
 const {h,saved}=await bootGuest({initial:token(A),progress:true,hostname:'localhost',accountState:{xp:23,known:['local-only']},cloudSnapshot:cloudSnapshot()});
 await h.ctx.SVProgress.initialize();
 assert.equal(h.ctx.SVProgressDebug.status().status,'ready');assert.equal(h.ctx.SVProgressDebug.status().xp,42);
 assert.equal(vm.runInContext('state.xp',h.ctx),23);assert.equal(vm.runInContext('state.known[0]',h.ctx),'local-only');
 for(let i=0;i<5;i++)vm.runInContext("route='profile';renderProfile()",h.ctx);
 await new Promise(r=>setTimeout(r,5));assert.equal(h.records.rpc.length,1);
 assert.equal(h.data.get('sv-guest-v2'),JSON.stringify(saved));assert.deepEqual(h.records.storageWrites,[]);
});
