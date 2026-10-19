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
test('review helper remains private and migration 013 records the exact manual patch',()=>{
 const patch=read('supabase/patches/srs_interval_cap.sql');
 assert.match(patch,/language plpgsql security invoker set search_path = ''/);
 assert.match(patch,/revoke all on function sl_private\.review\(uuid,text,boolean,timestamptz\) from public,anon,authenticated/);
 const migration=read('supabase/migrations/202610180013_srs_interval_cap.sql');
 assert.equal(migration.slice(migration.indexOf('begin;')),patch.slice(patch.indexOf('begin;')));
 assert.equal(fs.readdirSync(path.join(root,'supabase/migrations')).filter(n=>n.includes('srs_interval')).length,1);
 assert.doesNotMatch(migration,/\b(?:drop|delete|truncate|alter)\b/i);
 assert.match(migration,/create or replace function sl_private\.review/);
 const build=read('scripts/build_deploy.py');assert.doesNotMatch(build,/srs_interval_cap/);
});

test('012 retains capped helper calls and manual queue uses that same scheduler',()=>{
 const xp=read('supabase/migrations/202610180012_xp_integrity.sql');
 assert.doesNotMatch(xp,/(?:create|alter|drop)\s+(?:or\s+replace\s+)?function\s+sl_private\.review\s*\(/i);
 assert.match(xp,/perform sl_private\.review\(a.user_id,wid,ok,at_time\)/);
 const queue=read('supabase/migrations/202610180009_manual_review_queue.sql');
 assert.match(queue,/p_action in \('remember','again'\)/);
 assert.match(queue,/perform public\.sl_apply_event[\s\S]*?'type','review_grade'/);
 assert.match(xp,/elsif typ='review_grade' then[\s\S]*?perform sl_private\.review/);
});
test('all migration interval writers are accounted for and import validates the CHECK maximum',()=>{
 const dir='supabase/migrations';
 const writers=fs.readdirSync(path.join(root,dir)).filter(n=>/\binterval_days\s*(?::=|=)/.test(read(`${dir}/${n}`))).sort();
 assert.deepEqual(writers,['202610170003_progress_rpc.sql','202610170004_import.sql','202610180013_srs_interval_cap.sql']);
 const importer=read(`${dir}/202610170004_import.sql`);
 assert.match(importer,/interval_value not between 0 and 365000/);
 assert.match(importer,/interval_days=interval_value/);
 // 012 moves this implementation into a private archive-only helper.
 const xp=read(`${dir}/202610180012_xp_integrity.sql`);
 assert.match(xp,/if p_mode='archive_only' then\s+return sl_private\.import_progress_legacy/);
});
test('disposable SQL suites cover boundary arithmetic, queue retries and installation preservation',()=>{
 const cases=read('supabase/tests/helpers/srs_boundary_cases.sql');
 for(const scenario of ['(0,0,2.5,1)','(1,1,2.5,3)','(0,2,1.3,1)',
   '(145999,5,2.5,364998)','(146000,5,2.5,365000)',
   '(146001,5,2.5,365000)','(130248,5,3.0,365000)','(365000,5,3.0,365000)',
   'manual remember','manual again','stale manual grade','duplicate grade',
   'delayed device','following favorite_set']) assert(cases.includes(scenario),scenario);
 assert.match(cases,/begin;[\s\S]*rollback;/);
 const upgrade=read('supabase/tests/009_srs_interval_cap.sql');
 assert.equal((upgrade.match(/\\ir \.\.\/migrations\/202610180013_srs_interval_cap\.sql/g)||[]).length,2);
 assert.match(upgrade,/\\ir \.\.\/patches\/srs_interval_cap\.sql/);
 assert.match(upgrade,/if v is distinct from t.data then raise exception/);
 assert.match(upgrade,/p.proacl is not distinct from b.acl/);
 const runner=read('scripts/test_supabase_local.py');
 assert.match(runner,/srs = run_file[\s\S]*integrity = run_file[\s\S]*srs_after_012 = run_file/);
 assert.match(runner,/\('clean_install_test', False\), \('manual_patch_upgrade_test', True\)/);
 assert.match(runner,/srs_skip_manual_patch=true/);
 assert.match(runner,/ordered_sql\(public_rpc_catalog\) == before_rpc/);
 assert.match(runner,/post_upgrade_rpc_cases.sql/);
});
