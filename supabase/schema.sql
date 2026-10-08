-- Apply to the project's SQL editor before activating cloud-config.js.
-- Each signed-in user can access only their own document. Anonymous access is absent.
begin;
create table if not exists public.gym_coach_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  document jsonb not null check (jsonb_typeof(document)='object'),
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.gym_coach_state enable row level security;
revoke all on public.gym_coach_state from anon;
revoke all on public.gym_coach_state from authenticated;
grant select,insert,update on public.gym_coach_state to authenticated;
drop policy if exists gym_coach_owner on public.gym_coach_state;
create policy gym_coach_owner on public.gym_coach_state for all to authenticated
using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

create or replace function public.gym_coach_save(p_document jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_revision bigint;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if jsonb_typeof(p_document)<>'object' or not (p_document ? 'profile' and p_document ? 'exercises')
     or octet_length(p_document::text)>10000000 then raise exception 'Invalid document'; end if;
  if p_expected_revision=0 then
    insert into public.gym_coach_state(user_id,document,revision) values(v_uid,p_document,1)
    on conflict(user_id) do nothing returning revision into v_revision;
  else
    update public.gym_coach_state set document=p_document,revision=revision+1,updated_at=now()
    where user_id=v_uid and revision=p_expected_revision returning revision into v_revision;
  end if;
  return jsonb_build_object('ok',v_revision is not null,'revision',v_revision);
end $$;
revoke all on function public.gym_coach_save(jsonb,bigint) from public,anon;
grant execute on function public.gym_coach_save(jsonb,bigint) to authenticated;
commit;
