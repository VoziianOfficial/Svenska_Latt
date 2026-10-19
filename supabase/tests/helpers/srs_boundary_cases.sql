-- TEST ONLY. Reusable before/after 012; caller must install the capped helper.
-- All fixtures and test functions roll back, so this suite can run repeatedly.
begin;
create function pg_temp.srs_ok(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',message; end if; raise notice 'PASS: %',message; end $$;
insert into auth.users(id,email) values('98000000-0000-0000-0000-000000000001','srs@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','98000000-0000-0000-0000-000000000001',true);
select public.sl_get_progress();
reset role;
insert into public.sl_words(user_id,word_id,is_favorite) values('98000000-0000-0000-0000-000000000001','v-arbeta',true);

-- Real PostgreSQL arithmetic, including half rounding and the reported 390744 overflow.
do $$ declare c record; w public.sl_words; at_time timestamptz:='2026-10-18T12:00:00Z'; begin
  for c in select * from (values
    (0,0,2.5,1), (1,1,2.5,3), (0,2,1.3,1),
    (145999,5,2.5,364998), (146000,5,2.5,365000),
    (146001,5,2.5,365000), (130248,5,3.0,365000), (365000,5,3.0,365000)
  ) cases(days,reps,ease,expected) loop
    update public.sl_words set interval_days=c.days,repetitions=c.reps,ease=c.ease,last_reviewed_at=null
      where user_id='98000000-0000-0000-0000-000000000001' and word_id='v-arbeta';
    perform sl_private.review('98000000-0000-0000-0000-000000000001','v-arbeta',true,at_time);
    select * into strict w from public.sl_words where user_id='98000000-0000-0000-0000-000000000001' and word_id='v-arbeta';
    perform pg_temp.srs_ok(w.interval_days=c.expected and w.repetitions=c.reps+1
      and w.ease=least(3,c.ease+0.08)
      and w.due_at=at_time+make_interval(secs=>c.expected::double precision*86400),
      format('SRS boundary days=%s ease=%s expected=%s',c.days,c.ease,c.expected));
  end loop;
  perform sl_private.review('98000000-0000-0000-0000-000000000001','v-arbeta',true,at_time-interval '1 day');
  select * into strict w from public.sl_words where user_id='98000000-0000-0000-0000-000000000001' and word_id='v-arbeta';
  perform pg_temp.srs_ok(w.interval_days=365000 and w.last_reviewed_at=at_time
    and extract(epoch from (w.due_at-at_time))=365000::bigint*86400,'repeated cap and delayed device preserve review clock');
  perform sl_private.review('98000000-0000-0000-0000-000000000001','v-arbeta',false,at_time);
  select * into strict w from public.sl_words where user_id='98000000-0000-0000-0000-000000000001' and word_id='v-arbeta';
  perform pg_temp.srs_ok(w.interval_days=0 and w.repetitions=0 and w.ease=2.82
    and w.due_at=at_time+interval '10 minutes','wrong answer resets cap to ten minute retry');
end $$;
select pg_temp.srs_ok(not has_function_privilege('anon','sl_private.review(uuid,text,boolean,timestamptz)','execute')
  and not has_function_privilege('authenticated','sl_private.review(uuid,text,boolean,timestamptz)','execute'),'capped helper remains private');
update public.sl_words set interval_days=365000,repetitions=5,ease=3,last_reviewed_at=null
  where user_id='98000000-0000-0000-0000-000000000001' and word_id='v-arbeta';
set local role authenticated;
select public.sl_review_change('98100000-0000-0000-0000-000000000001','v-arbeta','add');
select public.sl_review_change('98100000-0000-0000-0000-000000000002','v-arbeta','remember','98100000-0000-0000-0000-000000000001');
select pg_temp.srs_ok((select interval_days=365000 and repetitions=6 and is_favorite and not is_known
  from public.sl_words where word_id='v-arbeta'),'manual remember caps SRS and preserves flags');
select pg_temp.srs_ok(not (public.sl_review_list()->'entries'->0->>'active')::boolean
  and public.sl_get_progress()->'state'->>'xp'='0','manual remember completes queue without XP');
create temp table srs_after_remember as select public.sl_get_progress() progress,public.sl_review_list() queue;
select pg_temp.srs_ok((public.sl_review_change('98100000-0000-0000-0000-000000000002','v-arbeta','remember','98100000-0000-0000-0000-000000000001')->>'duplicate')::boolean,
  'manual remember retry returns durable receipt');
select pg_temp.srs_ok(public.sl_get_progress()=(select progress from srs_after_remember)
  and public.sl_review_list()=(select queue from srs_after_remember),'duplicate grade preserves entire progress and queue');
select public.sl_review_change('98100000-0000-0000-0000-000000000003','v-arbeta','add','98100000-0000-0000-0000-000000000002');
create temp table srs_before_stale as select public.sl_get_progress() progress,public.sl_review_list() queue;
select pg_temp.srs_ok((public.sl_review_change('98100000-0000-0000-0000-000000000004','v-arbeta','remember','98100000-0000-0000-0000-000000000001')->>'conflict')::boolean,
  'stale manual grade conflicts at cap');
select pg_temp.srs_ok(public.sl_get_progress()=(select progress from srs_before_stale)
  and public.sl_review_list()=(select queue from srs_before_stale),'stale grade preserves entire progress and queue');
select public.sl_review_change('98100000-0000-0000-0000-000000000005','v-arbeta','again','98100000-0000-0000-0000-000000000003');
select pg_temp.srs_ok((select interval_days=0 and repetitions=0 and due_at=last_reviewed_at+interval '10 minutes'
  and is_favorite and not is_known from public.sl_words where word_id='v-arbeta')
  and (public.sl_review_list()->'entries'->0->>'active')::boolean
  and public.sl_get_progress()->'state'->>'xp'='0','manual again resets capped SRS and keeps queue active without XP');
reset role;
update public.sl_words set interval_days=365000,repetitions=5,ease=3
  where user_id='98000000-0000-0000-0000-000000000001' and word_id='v-arbeta';
set local role authenticated;
select public.sl_apply_event('98200000-0000-0000-0000-000000000001',(public.sl_get_progress()->>'revision')::bigint,
  jsonb_build_object('type','mark_known','occurred_at',clock_timestamp(),'timezone','UTC','data',jsonb_build_object('word_id','v-arbeta')));
select public.sl_apply_event('98200000-0000-0000-0000-000000000002',(public.sl_get_progress()->>'revision')::bigint,
  jsonb_build_object('type','favorite_set','occurred_at',clock_timestamp(),'timezone','UTC','data',jsonb_build_object('word_id','v-arbeta','value',false)));
select pg_temp.srs_ok((select interval_days=365000 and is_known and not is_favorite from public.sl_words where word_id='v-arbeta')
  and public.sl_get_progress()->'state'->>'xp'='8','mark_known at cap and following favorite_set succeed with expected XP');
rollback;
