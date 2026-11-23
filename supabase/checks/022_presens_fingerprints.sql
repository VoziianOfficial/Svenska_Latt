-- READ ONLY, generated from baseline-verified candidate 022.
begin transaction read only;
select sl_private.manifest()->>'version'='static-18bd9e23b62c3382' as content_version_ok;
select md5(prosrc)='0a625c1bfee5c4458e4e6b7a6da161c1' as manifest_md5_ok from pg_proc where oid='sl_private.manifest()'::regprocedure;
select md5(prosrc)='c2913150b7f6e4451410cfdf300d4bea' as catalog_md5_ok from pg_proc where oid='sl_private.quiz_catalog()'::regprocedure;
select md5(prosrc)='2a54002f56a0230fa2f03a89fab871b9' as reader_md5_ok from pg_proc where oid='public.sl_get_progress()'::regprocedure;
select md5(prosrc)='82ffbac7b24326523ca60c888c1538c7' as writer_md5_ok from pg_proc where oid='public.sl_apply_event(uuid,bigint,jsonb)'::regprocedure;
commit;
