-- Revocacion administrable de cuentas y reduccion del acceso directo de despacho.

begin;

create or replace function public.set_provider_access_active(
  target_profile_id uuid,
  is_active boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_organization_id uuid;
  target_profile public.profiles%rowtype;
begin
  select profile.organization_id into actor_organization_id
  from public.profiles as profile
  where profile.id = actor_id
    and profile.active
    and profile.role = 'provider_admin';

  if actor_organization_id is null then
    raise exception using errcode = 'P0001', message = 'PROVIDER_ROLE_REQUIRED';
  end if;

  select profile.* into target_profile
  from public.profiles as profile
  where profile.id = target_profile_id
    and profile.organization_id = actor_organization_id
    and profile.role::text in ('company_admin', 'delivery')
  for update;

  if target_profile.id is null then
    raise exception using errcode = 'P0001', message = 'ACCESS_ACCOUNT_NOT_FOUND';
  end if;

  update public.profiles
  set active = is_active
  where id = target_profile.id
  returning * into target_profile;

  insert into public.audit_events (
    organization_id, actor_id, entity_type, entity_id, action, metadata
  ) values (
    actor_organization_id,
    actor_id,
    'profile',
    target_profile.id,
    case when is_active then 'access.account_reactivated' else 'access.account_deactivated' end,
    jsonb_build_object('role', target_profile.role::text, 'active', is_active)
  );

  return target_profile;
end;
$$;

create or replace function public.set_worker_account_active(
  target_diner_id uuid,
  is_active boolean
)
returns public.diners
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_organization_id uuid;
  target_diner public.diners%rowtype;
begin
  select profile.organization_id into actor_organization_id
  from public.profiles as profile
  where profile.id = actor_id
    and profile.active
    and profile.role = 'company_admin';

  if actor_organization_id is null then
    raise exception using errcode = 'P0001', message = 'COMPANY_ROLE_REQUIRED';
  end if;

  select diner.* into target_diner
  from public.diners as diner
  where diner.id = target_diner_id
    and diner.organization_id = actor_organization_id
    and diner.type = 'worker'
    and diner.auth_user_id is not null
  for update;

  if target_diner.id is null then
    raise exception using errcode = 'P0001', message = 'WORKER_NOT_FOUND';
  end if;

  update public.diners
  set active = is_active
  where id = target_diner.id
  returning * into target_diner;

  update public.profiles
  set active = is_active
  where id = target_diner.auth_user_id
    and organization_id = actor_organization_id
    and role = 'worker';

  if not found then
    raise exception using errcode = 'P0001', message = 'WORKER_NOT_FOUND';
  end if;

  insert into public.audit_events (
    organization_id, actor_id, entity_type, entity_id, action, metadata
  ) values (
    actor_organization_id,
    actor_id,
    'diner',
    target_diner.id,
    case when is_active then 'worker.account_reactivated' else 'worker.account_deactivated' end,
    jsonb_build_object('auth_user_id', target_diner.auth_user_id, 'active', is_active)
  );

  return target_diner;
end;
$$;

revoke all on function public.set_provider_access_active(uuid, boolean) from public, anon;
revoke all on function public.set_worker_account_active(uuid, boolean) from public, anon;
grant execute on function public.set_provider_access_active(uuid, boolean) to authenticated;
grant execute on function public.set_worker_account_active(uuid, boolean) to authenticated;

-- Despacho consume el manifiesto mediante la API, por lo que no necesita
-- consultar directamente personas, pedidos ni solicitudes desde PostgREST.
drop policy if exists "delivery can read organization diners" on public.diners;
drop policy if exists "delivery can read training sessions" on public.training_sessions;
drop policy if exists "delivery can read organization orders" on public.orders;
drop policy if exists "delivery can read extra requests" on public.exception_requests;

commit;
