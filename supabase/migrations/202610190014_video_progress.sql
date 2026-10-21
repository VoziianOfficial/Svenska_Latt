-- REVIEW DRAFT: install only after 001-013 and explicit approval.
-- No user table, score, event, UUID, account revision or RLS policy is rewritten.
-- All 12 quiz identities and historical q0 answers remain stable.
begin;
set local lock_timeout='10s';
set local statement_timeout='60s';

-- Preserve the installed private bank rather than duplicating unrelated content.
-- The helper is private and created exactly once; repeated installation is safe.
do $preserve$
declare bank jsonb;
begin
  -- Reject unknown manual patches rather than advertising unverified guarantees.
  if (select md5(prosrc) from pg_proc where oid='public.sl_apply_event(uuid,bigint,jsonb)'::regprocedure)
    not in ('b94f2d1a9b9b55bc43c09f79d5cad60e','67e980064af15b0073227139518b42ac') then
    raise exception '014: unknown event writer; review required';
  end if;
  if (select md5(prosrc) from pg_proc where oid='public.sl_get_progress()'::regprocedure)
    not in ('88eb9b352c25e2e17193f830d4fd70d1','f9455ebdd0f051a3b78e95bc78c1da79') then
    raise exception '014: unknown progress reader; review required';
  end if;
  if to_regprocedure('sl_private.review(uuid,text,boolean,timestamptz)') is null
    or to_regprocedure('public.sl_review_change(uuid,text,text,uuid)') is null then
    raise exception '014 requires migrations 001-013';
  end if;
  if position('Viewing is a reversible preference' in
    pg_get_functiondef('public.sl_apply_event(uuid,bigint,jsonb)'::regprocedure))=0 then
    raise exception '014 requires the zero-XP writer from 012';
  end if;
  if position('least(365000' in
    pg_get_functiondef('sl_private.review(uuid,text,boolean,timestamptz)'::regprocedure))=0 then
    raise exception '014 requires the SRS cap from 013';
  end if;
  if to_regprocedure('sl_private.quiz_catalog_before_014()') is null then
    bank:=sl_private.quiz_catalog();
    execute 'create function sl_private.quiz_catalog_before_014() returns jsonb '
      || 'language sql immutable security invoker set search_path='''''
      || ' as ' || quote_literal('select ' || quote_literal(bank::text) || '::jsonb');
  end if;
end $preserve$;
revoke all on function sl_private.quiz_catalog_before_014() from public,anon,authenticated;

create or replace function sl_private.quiz_catalog() returns jsonb
language sql immutable security invoker set search_path='' as $function$
select sl_private.quiz_catalog_before_014() || $video_bank${
  "video:ur-hitta1": {
    "count": 5,
    "reward": 12,
    "questions": {
      "q0": {
        "answer": "Martina och Jamal"
      },
      "q1": {
        "answer": "Barcelona"
      },
      "q2": {
        "answer": "Ylva"
      },
      "q3": {
        "answer": "Hon missade bussen."
      },
      "q4": {
        "answer": "Ingenjör"
      }
    }
  },
  "video:ur-hitta2": {
    "count": 5,
    "reward": 12,
    "questions": {
      "q0": {
        "answer": "På ett äldreboende"
      },
      "q1": {
        "answer": "Ylva"
      },
      "q2": {
        "answer": "Han hittar inte till rätt adress."
      },
      "q3": {
        "answer": "Arbetskläder"
      },
      "q4": {
        "answer": "Utbildad personal"
      }
    }
  },
  "video:ur-hitta3": {
    "count": 5,
    "reward": 12,
    "questions": {
      "q0": {
        "answer": "Martina"
      },
      "q1": {
        "answer": "Gamla stan"
      },
      "q2": {
        "answer": "Juice"
      },
      "q3": {
        "answer": "Webbdesigner"
      },
      "q4": {
        "answer": "Från hennes mamma."
      }
    }
  },
  "video:ur-hitta4": {
    "count": 5,
    "reward": 12,
    "questions": {
      "q0": {
        "answer": "Sverige"
      },
      "q1": {
        "answer": "Axel"
      },
      "q2": {
        "answer": "Konrad"
      },
      "q3": {
        "answer": "För att hitta sin pappa."
      },
      "q4": {
        "answer": "Hon har ett möte med en webbyrå."
      }
    }
  },
  "video:ur-hitta5": {
    "count": 5,
    "reward": 12,
    "questions": {
      "q0": {
        "answer": "En gammal artikel"
      },
      "q1": {
        "answer": "Göran Hedlund"
      },
      "q2": {
        "answer": "Enskede gårds gymnasium"
      },
      "q3": {
        "answer": "Löpning"
      },
      "q4": {
        "answer": "Hans personnummer"
      }
    }
  },
  "video:ur-hitta6": {
    "count": 5,
    "reward": 12,
    "questions": {
      "q0": {
        "answer": "Konrad"
      },
      "q1": {
        "answer": "Camilla"
      },
      "q2": {
        "answer": "Sin mamma"
      },
      "q3": {
        "answer": "Gifta sig"
      },
      "q4": {
        "answer": "Han betalade inte tillbaka dem."
      }
    }
  },
  "video:ur-hitta7": {
    "count": 5,
    "reward": 12,
    "questions": {
      "q0": {
        "answer": "Sin pappa"
      },
      "q1": {
        "answer": "Rosén"
      },
      "q2": {
        "answer": "Göran"
      },
      "q3": {
        "answer": "Han kör taxi."
      },
      "q4": {
        "answer": "I går"
      }
    }
  },
  "video:ur-hitta8": {
    "count": 5,
    "reward": 12,
    "questions": {
      "q0": {
        "answer": "Jamal"
      },
      "q1": {
        "answer": "Kompletterande utbildning för ingenjörer"
      },
      "q2": {
        "answer": "Han har fått klagomål på henne."
      },
      "q3": {
        "answer": "Hon får inte undervisa medan saken utreds."
      },
      "q4": {
        "answer": "De skulle lura Jamals föräldrar."
      }
    }
  },
  "video:ur-hitta9": {
    "count": 5,
    "reward": 12,
    "questions": {
      "q0": {
        "answer": "Martina och Jamal"
      },
      "q1": {
        "answer": "De hjälpte henne att få tillbaka jobbet."
      },
      "q2": {
        "answer": "Hitta ett jobb"
      },
      "q3": {
        "answer": "Fatou, Martina och Mohammed"
      },
      "q4": {
        "answer": "Hon är den bästa lärare han har haft."
      }
    }
  },
  "video:v1": {
    "count": 5,
    "reward": 12,
    "start_questions": [
      {
        "question_id": "r014q0"
      },
      {
        "question_id": "r014q1"
      },
      {
        "question_id": "r014q2"
      },
      {
        "question_id": "r014q3"
      },
      {
        "question_id": "r014q4"
      }
    ],
    "questions": {
      "q0": {
        "answer": "Chokladkräm"
      },
      "r014q0": {
        "answer": "Skatteverket"
      },
      "r014q1": {
        "answer": "Konrad"
      },
      "r014q2": {
        "answer": "På måndagar klockan tre"
      },
      "r014q3": {
        "answer": "150 kronor"
      },
      "r014q4": {
        "answer": "Om Jamal har hittat en fru"
      }
    }
  },
  "video:v2": {
    "count": 5,
    "reward": 12,
    "start_questions": [
      {
        "question_id": "r014q0"
      },
      {
        "question_id": "r014q1"
      },
      {
        "question_id": "r014q2"
      },
      {
        "question_id": "r014q3"
      },
      {
        "question_id": "r014q4"
      }
    ],
    "questions": {
      "q0": {
        "answer": "Leen"
      },
      "r014q0": {
        "answer": "Hon sov."
      },
      "r014q1": {
        "answer": "Letar efter sin pappa"
      },
      "r014q2": {
        "answer": "Att ljuga för sina föräldrar"
      },
      "r014q3": {
        "answer": "Ylva"
      },
      "r014q4": {
        "answer": "Att bli hans flickvän"
      }
    }
  },
  "video:v4": {
    "count": 5,
    "reward": 12,
    "start_questions": [
      {
        "question_id": "r014q0"
      },
      {
        "question_id": "r014q1"
      },
      {
        "question_id": "r014q2"
      },
      {
        "question_id": "r014q3"
      },
      {
        "question_id": "r014q4"
      }
    ],
    "questions": {
      "q0": {
        "answer": "Liam"
      },
      "r014q0": {
        "answer": "Hennes mamma"
      },
      "r014q1": {
        "answer": "Stockholm"
      },
      "r014q2": {
        "answer": "I Barcelona"
      },
      "r014q3": {
        "answer": "En vecka"
      },
      "r014q4": {
        "answer": "Sin träningsjacka"
      }
    }
  }
}$video_bank$::jsonb;
$function$;
revoke all on function sl_private.quiz_catalog() from public,anon,authenticated;

-- Verify preservation of every previously trusted answer, including non-video
-- contexts. Any mismatch aborts the entire transaction before publication.
do $bank_guard$
declare prior record; q record; current_bank jsonb;
begin
  current_bank:=sl_private.quiz_catalog();
  for prior in select key,value from jsonb_each(sl_private.quiz_catalog_before_014()) loop
    if prior.key not like 'video:%' then
      if current_bank->prior.key is distinct from prior.value then
        raise exception '014 changed an unrelated quiz: %',prior.key;
      end if;
    else
      for q in select key,value from jsonb_each(prior.value->'questions') loop
        if current_bank->prior.key->'questions'->q.key is distinct from q.value then
          raise exception '014 changed a historical answer: %/%',prior.key,q.key;
        end if;
      end loop;
    end if;
  end loop;
end $bank_guard$;

-- Exact, bounded change to the reviewed 012 writer. No other writer logic or
-- ACL is replaced. Existing one-question clients/queued starts remain valid;
-- new clients send the current five questions. Replacement banks retain legacy q0
-- only for old sessions; start_questions prevents mixing generations. Reward keys stay stable.
do $writer_upgrade$
declare definition text;
  old_clause constant text := $old$if bank is null or n<>(bank->>'count')::integer then raise exception 'quiz_bank_count_mismatch' using errcode='22023'; end if;$old$;
  new_clause constant text := $new$if bank is null or not (
        (n=(bank->>'count')::integer and (not (bank ? 'start_questions') or
          ((d->'questions') @> (bank->'start_questions') and (bank->'start_questions') @> (d->'questions')))) or
        (d->>'mode'='video' and n=1 and d->'questions'='[{"question_id":"q0"}]'::jsonb
          and d->>'context_id'=any(array['ur-hitta1','ur-hitta2','ur-hitta3','ur-hitta4','ur-hitta5','ur-hitta6','ur-hitta7','ur-hitta8','ur-hitta9','v1','v2','v4']))
      ) then raise exception 'quiz_bank_count_mismatch' using errcode='22023'; end if;$new$;
begin
  definition:=pg_get_functiondef('public.sl_apply_event(uuid,bigint,jsonb)'::regprocedure);
  if position(new_clause in definition)>0 then
    null; -- Already installed; preserve the exact function and its ACL.
  elsif (length(definition)-length(replace(definition,old_clause,'')))=length(old_clause) then
    execute replace(definition,old_clause,new_clause);
  else
    raise exception '014: writer definition differs; review required';
  end if;
end $writer_upgrade$;

create or replace function public.sl_get_progress() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.sl_accounts; result jsonb;
begin
  a:=sl_private.lock_account();
  -- All writers take this same lock: the multi-query snapshot is coherent.
  select jsonb_build_object(
    'capabilities',jsonb_build_array('unmark_known','review_grade','known_reward_once','quiz_rewards_v1','video_set_v1','video_quizzes_v2','video_quizzes_v3'),
    'revision',a.revision,'content_version',sl_private.manifest()->>'version',
    'state',jsonb_build_object(
      'known',coalesce((select jsonb_agg(word_id order by word_id) from public.sl_words where user_id=a.user_id and is_known),'[]'),
      'favorites',coalesce((select jsonb_agg(word_id order by word_id) from public.sl_words where user_id=a.user_id and is_favorite),'[]'),
      'reviews',coalesce((select jsonb_object_agg(word_id,jsonb_build_object('due',round(extract(epoch from due_at)*1000),
        'interval',interval_days,'ease',ease,'rep',repetitions)) from public.sl_words where user_id=a.user_id and due_at is not null),'{}'),
      'completed',coalesce((select jsonb_agg(lesson_id order by lesson_id) from public.sl_lessons where user_id=a.user_id and completed),'[]'),
      'videos',coalesce((select jsonb_agg(content_id order by content_id) from public.sl_content where user_id=a.user_id and content_type='video' and is_completed),'[]'),
      'booksRead',coalesce((select jsonb_agg(content_id order by content_id) from public.sl_content where user_id=a.user_id and content_type='book' and is_completed),'[]'),
      'activity',coalesce((select jsonb_object_agg(day_key,n) from (
        select day_key,sum(n) n from (
          select key as day_key,value::bigint n from jsonb_each_text(a.legacy_activity)
          union all select activity_date::text,activity_delta::bigint from public.sl_events
            where user_id=a.user_id and activity_delta>0
        ) raw group by day_key
      ) totals),'{}'),
      'quizResults',coalesce((select jsonb_object_agg(quiz_id,jsonb_build_object('correct',best_correct,'total',best_total,'rewarded',rewarded)) from public.sl_quiz_results where user_id=a.user_id),'{}'),
      'answered',a.answered,'correct',a.correct,'xp',a.xp,
      'settings',jsonb_build_object('language',a.language,'level',a.sfi_level,'speechSpeed',a.speech_speed,'timezone',a.timezone),
      'profile',jsonb_build_object('name',a.display_name,'avatarPath',a.avatar_path)
    )) into result;
  return result;
end $$;

revoke all on function public.sl_get_progress() from public,anon;
grant execute on function public.sl_get_progress() to authenticated;
commit;
