-- TEST ONLY. Persistent pre-upgrade fixtures in a disposable ordered database.
insert into auth.users(id,email) values('99000000-0000-0000-0000-000000000001','upgrade-queue@example.invalid');
set role authenticated;
select set_config('request.jwt.claim.sub','99000000-0000-0000-0000-000000000001',false);
select public.sl_get_progress();
select public.sl_apply_event('99100000-0000-0000-0000-000000000001',0,
  '{"type":"mark_known","occurred_at":"2026-10-16T10:00:00Z","timezone":"UTC","data":{"word_id":"v-arbeta"}}');
select public.sl_apply_event('99100000-0000-0000-0000-000000000002',1,
  '{"type":"favorite_set","occurred_at":"2026-10-16T10:00:00Z","timezone":"UTC","data":{"word_id":"v-arbeta","value":true}}');
select public.sl_review_change('99100000-0000-0000-0000-000000000003','v-arbeta','add');
reset role;
-- Valid pre-existing SRS data at the CHECK maximum; the migration must not rewrite it.
update public.sl_words set interval_days=365000,repetitions=5,ease=3
where user_id='99000000-0000-0000-0000-000000000001' and word_id='v-arbeta';
