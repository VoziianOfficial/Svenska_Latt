-- TEST ONLY: disposable PostgreSQL cluster, after the 007 upgrade assertions.
\ir ../migrations/202610180009_manual_review_queue.sql
create function pg_temp.ok(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',message; end if; raise notice 'PASS: %',message; end $$;
create function pg_temp.event(typ text, data jsonb) returns jsonb language sql as $$
 select jsonb_build_object('type',typ,'occurred_at','2026-10-16T12:00:00Z','timezone','UTC','data',data)
$$;
insert into auth.users(id,email) values('91000000-0000-0000-0000-000000000001','queue@example.invalid'),('91000000-0000-0000-0000-000000000002','queue-other@example.invalid');
select pg_temp.ok(not has_function_privilege('anon','public.sl_review_list()','execute') and not has_function_privilege('anon','public.sl_review_change(uuid,text,text,uuid)','execute'),'anonymous RPC access denied');
create function pg_temp.queue_failure() returns trigger language plpgsql as $$
begin if current_setting('sl.test_failure',true)='on' then raise exception 'injected_queue_failure';end if;return new;end $$;
create trigger test_queue_failure before update on public.sl_review_queue for each row execute function pg_temp.queue_failure();
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
select public.sl_get_progress();
select public.sl_apply_event('92000000-0000-0000-0000-000000000001',0,pg_temp.event('mark_known','{"word_id":"v-arbeta"}'));
select public.sl_apply_event('92000000-0000-0000-0000-000000000002',1,pg_temp.event('favorite_set','{"word_id":"v-arbeta","value":true}'));
create temp table queue_before as select public.sl_get_progress() s;
select pg_temp.ok(public.sl_review_list()->'entries'='[]','SRS words never populate manual queue');
select public.sl_review_change('93000000-0000-0000-0000-000000000001','v-arbeta','add');
select pg_temp.ok(public.sl_get_progress()=(select s from queue_before),'add preserves all progress, revision, SRS, favorites and XP');
select pg_temp.ok(jsonb_array_length(public.sl_review_list()->'entries')=1,'added word appears in queue');
select pg_temp.ok((public.sl_review_change('93000000-0000-0000-0000-000000000001','v-arbeta','add')->>'duplicate')::boolean,'lost ACK retry has durable receipt');
select public.sl_review_change('93000000-0000-0000-0000-000000000002','v-arbeta','add');
select pg_temp.ok(jsonb_array_length(public.sl_review_list()->'entries')=1,'different requests cannot duplicate word');
select public.sl_review_change('93000000-0000-0000-0000-000000000003','v-arbeta','again','93000000-0000-0000-0000-000000000001');
select pg_temp.ok((public.sl_review_list()->'entries'->0->>'active')::boolean,'not remembered keeps word in queue');
select pg_temp.ok(public.sl_get_progress()->'state'->'reviews'->'v-arbeta'->>'rep'='0','negative grade updates SRS');
create temp table before_failure as select public.sl_get_progress() s;
set local sl.test_failure='on';
do $$ begin
 begin perform public.sl_review_change('93000000-0000-0000-0000-000000000099','v-arbeta','remember','93000000-0000-0000-0000-000000000003');raise exception 'failure was not injected';
 exception when raise_exception then if sqlerrm<>'injected_queue_failure' then raise;end if;end;
end $$;
set local sl.test_failure='off';
select pg_temp.ok(public.sl_get_progress()=(select s from before_failure) and (public.sl_review_list()->'entries'->0->>'active')::boolean,'failed queue completion rolls back SRS, history and queue together');
select pg_temp.ok((public.sl_review_change('93000000-0000-0000-0000-000000000004','v-arbeta','remember','93000000-0000-0000-0000-000000000001')->>'conflict')::boolean,'stale exercise cannot remove newer queue entry');
select public.sl_review_change('93000000-0000-0000-0000-000000000005','v-arbeta','remember','93000000-0000-0000-0000-000000000003');
select pg_temp.ok(not (public.sl_review_list()->'entries'->0->>'active')::boolean,'remember removes active queue item atomically');
select pg_temp.ok(public.sl_get_progress()->'state'->'reviews'->'v-arbeta'->>'rep'='1','positive grade updates SRS');
select pg_temp.ok(public.sl_get_progress()->'state'->>'xp'='8' and public.sl_get_progress()->'state'->'known' ? 'v-arbeta' and public.sl_get_progress()->'state'->'favorites' ? 'v-arbeta','grades preserve known, favorite and XP');
select pg_temp.ok((public.sl_review_change('93000000-0000-0000-0000-000000000006','v-arbeta','add')->>'conflict')::boolean,'delayed old add cannot resurrect tombstone');
select public.sl_review_change('93000000-0000-0000-0000-000000000007','v-arbeta','add','93000000-0000-0000-0000-000000000005');
select pg_temp.ok(not (public.sl_review_change('93000000-0000-0000-0000-000000000005','v-arbeta','remember','93000000-0000-0000-0000-000000000003')->>'conflict')::boolean,'old successful retry uses receipt');
select pg_temp.ok((public.sl_review_list()->'entries'->0->>'active')::boolean,'old successful retry cannot remove a readded word');
create temp table before_remove as select public.sl_get_progress() s;
select public.sl_review_change('93000000-0000-0000-0000-000000000008','v-arbeta','remove','93000000-0000-0000-0000-000000000007');
select pg_temp.ok(public.sl_get_progress()=(select s from before_remove),'manual removal preserves entire progress');
select pg_temp.ok(not (public.sl_review_list()->'entries'->0->>'active')::boolean,'manual removal persists');
do $$ begin
 begin perform public.sl_review_change('93000000-0000-0000-0000-000000000008','v-arbeta','add');raise exception 'UUID body changed';
 exception when invalid_parameter_value then raise notice 'PASS: receipt body immutable';end;
 begin perform public.sl_review_change(gen_random_uuid(),'not-a-word','add');raise exception 'invalid word accepted';
 exception when others then if sqlerrm='invalid word accepted' then raise;end if;raise notice 'PASS: catalog validated';end;
 begin delete from public.sl_review_queue;raise exception 'direct mutation allowed';
 exception when insufficient_privilege then raise notice 'PASS: direct writes denied';end;
end $$;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000002',true);
select pg_temp.ok(public.sl_review_list()->'entries'='[]','other account queue isolated');
select pg_temp.ok((select count(*)=0 from public.sl_review_queue),'RLS hides other account rows');
select pg_temp.ok((select count(*)=0 from public.sl_review_receipts),'RLS hides other account receipts');
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
select pg_temp.ok(jsonb_array_length(public.sl_review_list()->'entries')=1,'relogin restores server queue');
commit;

drop trigger test_queue_failure on public.sl_review_queue;
