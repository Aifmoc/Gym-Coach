-- Reports never overwrite the editable journal.
begin;
create table if not exists public.gym_coach_reports (
  user_id uuid not null references auth.users(id) on delete cascade,
  report_date date not null,
  generated_at timestamptz not null default now(),
  source_revision bigint not null,
  input_hash text not null,
  source_session jsonb,
  source_nutrition jsonb not null,
  report text not null check (length(report) between 1 and 100000),
  targets jsonb not null default '[]'::jsonb check (jsonb_typeof(targets)='array' and jsonb_array_length(targets)<=100),
  primary key (user_id, report_date)
);
alter table public.gym_coach_reports enable row level security;
revoke all on public.gym_coach_reports from public, anon, authenticated;
grant select on public.gym_coach_reports to authenticated;
create policy gym_coach_reports_read_own on public.gym_coach_reports
for select to authenticated using ((select auth.uid())=user_id);
comment on table public.gym_coach_reports is 'Private daily coaching delivered by the authorized automation. Browser accounts have read-only owner access.';
commit;
