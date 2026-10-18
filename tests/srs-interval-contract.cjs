// Static compatibility checks only: this file does not execute SQL.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n),'utf8');
test('review patch keeps the 001-011 scheduler contract with only the existing interval cap added',()=>{
 const core=read('supabase/migrations/202610170001_core.sql');
 assert.match(core,/interval_days integer not null default 0 check \(interval_days between 0 and 365000\)/);
 const original=read('supabase/migrations/202610170003_progress_rpc.sql').split('create function sl_private.review(')[1].split('\ncreate function public.sl_get_progress()')[0].trim();
 const patch=read('supabase/patches/srs_interval_cap.sql');
 const actual=patch.split('create or replace function sl_private.review(')[1].split('\n\nrevoke all')[0].trim();
 const expected=original.replace('w.interval_days := case w.repetitions when 1 then 1 when 2 then 3\n      else greatest(1,round(w.interval_days*w.ease)::integer) end;', 'w.interval_days := least(365000,case w.repetitions when 1 then 1 when 2 then 3\n      else greatest(1,round(w.interval_days*w.ease)::integer) end);');
 assert.notEqual(expected,original);assert.equal(actual,expected);
 assert.doesNotMatch(patch,/\bxp\s*[:=+]|sl_apply_event|sl_import_progress|quiz_rewards_v1/);
});
test('review helper remains private, invoker-scoped and excluded from automatic migrations',()=>{
 const patch=read('supabase/patches/srs_interval_cap.sql');
 assert.match(patch,/language plpgsql security invoker set search_path = ''/);
 assert.match(patch,/revoke all on function sl_private\.review\(uuid,text,boolean,timestamptz\) from public,anon,authenticated/);
 assert.equal(fs.readdirSync(path.join(root,'supabase/migrations')).filter(n=>n.includes('srs_interval')).length,0);
 const build=read('scripts/build_deploy.py');assert.doesNotMatch(build,/srs_interval_cap/);
});
