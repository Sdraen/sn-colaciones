-- Exige una sesion aal2 para toda operacion administrativa sensible.

begin;

create or replace function private.current_user_has_role(expected_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.active
      and profile.role = expected_role
      and (
        expected_role not in ('company_admin', 'provider_admin')
        or coalesce((select auth.jwt()->>'aal'), 'aal1') = 'aal2'
      )
  )
$$;

create or replace function private.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.active
      and profile.role in ('company_admin', 'provider_admin')
      and coalesce((select auth.jwt()->>'aal'), 'aal1') = 'aal2'
  )
$$;

-- Las RPC SECURITY DEFINER pueden omitir RLS. Este trigger conserva la
-- exigencia de MFA incluso cuando una operacion administrativa usa una RPC.
create or replace function private.require_admin_mfa_for_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
begin
  select profile.role::text
  into actor_role
  from public.profiles as profile
  where profile.id = (select auth.uid())
    and profile.active;

  if actor_role in ('company_admin', 'provider_admin')
    and coalesce((select auth.jwt()->>'aal'), 'aal1') <> 'aal2'
  then
    raise exception using errcode = 'P0001', message = 'MFA_REQUIRED';
  end if;

  return null;
end;
$$;

revoke all on function private.require_admin_mfa_for_write() from public, anon;
grant execute on function private.require_admin_mfa_for_write() to authenticated;

drop trigger if exists require_admin_mfa_write on public.profiles;
create trigger require_admin_mfa_write
before insert or update or delete on public.profiles
for each statement execute function private.require_admin_mfa_for_write();

drop trigger if exists require_admin_mfa_write on public.diners;
create trigger require_admin_mfa_write
before insert or update or delete on public.diners
for each statement execute function private.require_admin_mfa_for_write();

drop trigger if exists require_admin_mfa_write on public.menu_weeks;
create trigger require_admin_mfa_write
before insert or update or delete on public.menu_weeks
for each statement execute function private.require_admin_mfa_for_write();

drop trigger if exists require_admin_mfa_write on public.service_days;
create trigger require_admin_mfa_write
before insert or update or delete on public.service_days
for each statement execute function private.require_admin_mfa_for_write();

drop trigger if exists require_admin_mfa_write on public.menu_options;
create trigger require_admin_mfa_write
before insert or update or delete on public.menu_options
for each statement execute function private.require_admin_mfa_for_write();

drop trigger if exists require_admin_mfa_write on public.training_sessions;
create trigger require_admin_mfa_write
before insert or update or delete on public.training_sessions
for each statement execute function private.require_admin_mfa_for_write();

drop trigger if exists require_admin_mfa_write on public.exception_requests;
create trigger require_admin_mfa_write
before insert or update or delete on public.exception_requests
for each statement execute function private.require_admin_mfa_for_write();

drop trigger if exists require_admin_mfa_write on public.orders;
create trigger require_admin_mfa_write
before insert or update or delete on public.orders
for each statement execute function private.require_admin_mfa_for_write();

drop trigger if exists require_admin_mfa_write on public.service_calendar_blocks;
create trigger require_admin_mfa_write
before insert or update or delete on public.service_calendar_blocks
for each statement execute function private.require_admin_mfa_for_write();

drop trigger if exists require_admin_mfa_write on public.notifications;
create trigger require_admin_mfa_write
before insert or update or delete on public.notifications
for each statement execute function private.require_admin_mfa_for_write();

drop trigger if exists require_admin_mfa_write on public.service_delivery_tracking;
create trigger require_admin_mfa_write
before insert or update or delete on public.service_delivery_tracking
for each statement execute function private.require_admin_mfa_for_write();

drop trigger if exists require_admin_mfa_write on public.service_receipt_checks;
create trigger require_admin_mfa_write
before insert or update or delete on public.service_receipt_checks
for each statement execute function private.require_admin_mfa_for_write();

drop trigger if exists require_admin_mfa_write on public.audit_events;
create trigger require_admin_mfa_write
before insert or update or delete on public.audit_events
for each statement execute function private.require_admin_mfa_for_write();

commit;
