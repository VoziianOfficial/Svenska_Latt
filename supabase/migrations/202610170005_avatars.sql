begin;
-- No ON CONFLICT overwrite: an existing bucket needs a human configuration review.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('avatars','avatars',false,1048576,array['image/jpeg','image/png','image/webp']);

-- Policy helper has no privileges beyond the caller's RLS.
create function public.sl_avatar_access(object_name text) returns boolean
language sql stable security invoker set search_path = '' as $$
  select auth.uid() is not null
    and object_name ~ ('^' || auth.uid()::text || '/[a-zA-Z0-9_-]{1,80}\.(jpg|jpeg|png|webp)$')
    and exists(select 1 from public.sl_accounts where user_id=auth.uid() and deletion_requested_at is null)
$$;
revoke all on function public.sl_avatar_access(text) from public, anon, authenticated;
grant execute on function public.sl_avatar_access(text) to authenticated;

create policy sl_avatar_read on storage.objects for select to authenticated
  using(bucket_id='avatars' and public.sl_avatar_access(name));
create policy sl_avatar_insert on storage.objects for insert to authenticated
  with check(bucket_id='avatars' and public.sl_avatar_access(name));
create policy sl_avatar_update on storage.objects for update to authenticated
  using(bucket_id='avatars' and public.sl_avatar_access(name))
  with check(bucket_id='avatars' and public.sl_avatar_access(name));
create policy sl_avatar_delete on storage.objects for delete to authenticated
  using(bucket_id='avatars' and public.sl_avatar_access(name));

-- Deletion is two-phase: freeze writes/uploads, remove files through Storage API,
-- then delete the auth user using a trusted server/Admin API. Never DELETE the
-- storage.objects metadata directly in production: that leaves orphaned blobs.
create function public.sl_request_account_deletion(p_expected_revision bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid:=auth.uid(); a public.sl_accounts;
begin
  if u is null then raise exception 'authentication_required' using errcode='28000'; end if;
  select * into a from public.sl_accounts where user_id=u for update;
  if not found then raise exception 'account_not_initialized'; end if;
  if a.deletion_requested_at is null then
    if p_expected_revision is null or a.revision<>p_expected_revision then raise exception 'revision_conflict' using errcode='40001'; end if;
    update public.sl_accounts set deletion_requested_at=now(),revision=revision+1,updated_at=now() where user_id=u;
  end if;
  return jsonb_build_object('status','pending_storage_cleanup','user_id',u);
end $$;
revoke all on function public.sl_request_account_deletion(bigint) from public, anon, authenticated;
grant execute on function public.sl_request_account_deletion(bigint) to authenticated;
commit;
