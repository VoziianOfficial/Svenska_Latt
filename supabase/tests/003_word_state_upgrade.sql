-- TEST ONLY. Disposable cluster; this file must never be run on real accounts.
create function pg_temp.ok(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',message; end if; raise notice 'PASS: %',message; end $$;
create function pg_temp.event(typ text, data jsonb) returns jsonb language sql as $$
 select jsonb_build_object('type',typ,'occurred_at','2026-10-16T12:00:00Z','timezone','UTC','data',data)
$$;
insert into auth.users(id,email) values('71000000-0000-0000-0000-000000000001','word-upgrade@example.invalid');
insert into public.sl_accounts(user_id,xp,answered,correct,revision)
 values('71000000-0000-0000-0000-000000000001',16,5,3,9);
-- Imported known words may have no learned_at. Both must keep their reward history.
insert into public.sl_words(user_id,word_id,is_known,is_favorite,learned_at,due_at,interval_days,repetitions,ease) values
 ('71000000-0000-0000-0000-000000000001','v-arbeta',true,true,'2026-10-15T10:00:00Z','2026-10-20T10:00:00Z',3,2,2.66),
 ('71000000-0000-0000-0000-000000000001','lex-0001',true,false,null,null,0,0,2.5);
create temp table before_words as select to_jsonb(w) row from public.sl_words w;
create temp table before_accounts as select to_jsonb(a) row from public.sl_accounts a;
create temp table before_acl as select oid,proacl from pg_proc where oid in ('public.sl_apply_event(uuid,bigint,jsonb)'::regprocedure,'public.sl_get_progress()'::regprocedure);
\ir ../migrations/202610180007_word_state.sql
select pg_temp.ok(not exists((select to_jsonb(w)-'known_rewarded' from public.sl_words w) except (select row from before_words)), 'upgrade preserves every existing word field');
select pg_temp.ok(not exists((select to_jsonb(a) from public.sl_accounts a) except (select row from before_accounts)), 'upgrade preserves account XP, statistics and revisions');
select pg_temp.ok(not exists(select 1 from before_acl b join pg_proc p on p.oid=b.oid where b.proacl is distinct from p.proacl), 'upgrade retains RPC identity and privileges');
select pg_temp.ok((select bool_and(known_rewarded) from public.sl_words where user_id='71000000-0000-0000-0000-000000000001'),'existing words retain reward eligibility history');

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-0000-0000-000000000001',true);
select pg_temp.ok(public.sl_get_progress()->'capabilities' ? 'unmark_known','server advertises support explicitly');
select public.sl_apply_event('72000000-0000-0000-0000-000000000001',9,pg_temp.event('unmark_known','{"word_id":"v-arbeta"}'));
select pg_temp.ok(not (public.sl_get_progress()->'state'->'known' ? 'v-arbeta'),'unmark removes only learned state');
select pg_temp.ok(public.sl_get_progress()->'state'->>'xp'='16' and public.sl_get_progress()->'state'->>'answered'='5','unmark preserves XP and answer statistics');
select pg_temp.ok(public.sl_get_progress()->'state'->'favorites' ? 'v-arbeta','unmark preserves favorite');
select pg_temp.ok((public.sl_apply_event('72000000-0000-0000-0000-000000000001',9,pg_temp.event('unmark_known','{"word_id":"v-arbeta"}'))->>'duplicate')::boolean,'unmark duplicate receipt precedes revision check');
do $$ begin
 begin perform public.sl_apply_event(gen_random_uuid(),9,pg_temp.event('mark_known','{"word_id":"v-arbeta"}')); raise exception 'stale accepted';
 exception when serialization_failure then raise notice 'PASS: stale revision rejected'; end;
 begin perform public.sl_apply_event('72000000-0000-0000-0000-000000000001',10,pg_temp.event('unmark_known','{"word_id":"v-prata"}')); raise exception 'body changed';
 exception when invalid_parameter_value then raise notice 'PASS: UUID body immutable'; end;
end $$;
reset role;
select pg_temp.ok((select learned_at='2026-10-15T10:00:00Z' and due_at='2026-10-20T10:00:00Z' and repetitions=2 and interval_days=3 and ease=2.66 from public.sl_words where user_id='71000000-0000-0000-0000-000000000001' and word_id='v-arbeta'),'unmark preserves learned timestamp and entire SRS history');
set local role authenticated;
select public.sl_apply_event('72000000-0000-0000-0000-000000000002',10,pg_temp.event('mark_known','{"word_id":"v-arbeta"}'));
select pg_temp.ok(public.sl_get_progress()->'state'->>'xp'='16','relearning never rewards previously known word');
select public.sl_apply_event('72000000-0000-0000-0000-000000000003',11,pg_temp.event('review_grade','{"word_id":"v-arbeta","correct":true}'));
select pg_temp.ok(public.sl_get_progress()->'state'->'reviews'->'v-arbeta'->>'rep'='4','positive review advances SRS');
select public.sl_apply_event('72000000-0000-0000-0000-000000000004',12,pg_temp.event('mark_review','{"word_id":"v-arbeta"}'));
select pg_temp.ok(public.sl_get_progress()->'state'->'known' ? 'v-arbeta','mark_review never clears learned status');
select pg_temp.ok(public.sl_get_progress()->'state'->'reviews'->'v-arbeta'->>'rep'='0' and public.sl_get_progress()->'state'->>'xp'='16','negative review resets SRS without XP');
select public.sl_apply_event(gen_random_uuid(),13,pg_temp.event('unmark_known','{"word_id":"lex-0001"}'));
select public.sl_apply_event(gen_random_uuid(),14,pg_temp.event('mark_known','{"word_id":"lex-0001"}'));
select pg_temp.ok(public.sl_get_progress()->'state'->>'xp'='16','imported word with null learned_at cannot regain reward');
select public.sl_apply_event(gen_random_uuid(),15,pg_temp.event('unmark_known','{"word_id":"v-arbeta"}'));
select public.sl_apply_event(gen_random_uuid(),16,pg_temp.event('flash_grade','{"word_id":"v-arbeta","correct":true}'));
select pg_temp.ok(public.sl_get_progress()->'state'->>'xp'='16','legacy positive flash grade cannot bypass reward history');
select public.sl_apply_event(gen_random_uuid(),17,pg_temp.event('mark_known','{"word_id":"v-prata"}'));
select pg_temp.ok(public.sl_get_progress()->'state'->>'xp'='24','genuinely new word earns exactly eight XP');
select public.sl_apply_event(gen_random_uuid(),18,pg_temp.event('review_grade','{"word_id":"v-studera","correct":true}'));
select pg_temp.ok(not (public.sl_get_progress()->'state'->'known' ? 'v-studera') and public.sl_get_progress()->'state'->>'xp'='24','review does not teach an unknown word or grant XP');
select set_config('request.jwt.claim.sub','71000000-0000-0000-0000-000000000002',true);
-- Valid Auth user required; RLS identity tested after adding the second test user.
reset role;
insert into auth.users(id) values('71000000-0000-0000-0000-000000000002');
set local role authenticated;
select pg_temp.ok(jsonb_array_length(public.sl_get_progress()->'state'->'known')=0,'other identity sees no learned words');
do $$ begin
 begin update public.sl_words set is_known=false; raise exception 'direct write allowed';
 exception when insufficient_privilege then raise notice 'PASS: direct table writes remain forbidden'; end;
end $$;
set local role anon;
do $$ begin
 begin perform public.sl_apply_event(gen_random_uuid(),0,pg_temp.event('unmark_known','{"word_id":"v-arbeta"}')); raise exception 'anon allowed';
 exception when insufficient_privilege then raise notice 'PASS: anonymous RPC forbidden'; end;
end $$;
rollback;
