-- Las políticas de service_days y menu_options consultan filas creadas dentro
-- de save_menu_week_draft. Estos helpers deben ser VOLATILE para ver los
-- cambios realizados por sentencias anteriores de la misma llamada RPC.

begin;

create or replace function private.menu_week_belongs_to_current_org(target_menu_week_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.menu_weeks as menu_week
    join public.profiles as profile on profile.organization_id = menu_week.organization_id
    where menu_week.id = target_menu_week_id
      and profile.id = (select auth.uid())
      and profile.active
  )
$$;

create or replace function private.service_day_belongs_to_current_org(target_service_day_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.service_days as service_day
    join public.menu_weeks as menu_week on menu_week.id = service_day.menu_week_id
    join public.profiles as profile on profile.organization_id = menu_week.organization_id
    where service_day.id = target_service_day_id
      and profile.id = (select auth.uid())
      and profile.active
  )
$$;

revoke all on function private.menu_week_belongs_to_current_org(uuid) from public, anon;
revoke all on function private.service_day_belongs_to_current_org(uuid) from public, anon;
grant execute on function private.menu_week_belongs_to_current_org(uuid) to authenticated;
grant execute on function private.service_day_belongs_to_current_org(uuid) to authenticated;

comment on function private.menu_week_belongs_to_current_org(uuid) is
  'Valida pertenencia organizacional y ve semanas recién insertadas dentro de operaciones atómicas.';
comment on function private.service_day_belongs_to_current_org(uuid) is
  'Valida pertenencia organizacional y ve días recién insertados dentro de operaciones atómicas.';

commit;
