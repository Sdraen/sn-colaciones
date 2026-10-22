-- Registra trabajadores externos con su empresa de origen.
-- El valor del enum se utiliza en la migracion siguiente, una vez confirmado.

alter type public.app_role add value if not exists 'external_worker';

alter table public.profiles
  add column if not exists external_company_name text;

alter table public.profiles
  add constraint profiles_external_company_check check (
    (
      role::text = 'external_worker'
      and nullif(btrim(external_company_name), '') is not null
      and char_length(btrim(external_company_name)) between 2 and 120
    )
    or (
      role::text <> 'external_worker'
      and external_company_name is null
    )
  );

comment on column public.profiles.external_company_name is
  'Empresa de origen de un trabajador externo autorizado a consultar y reservar colaciones.';

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
    and profile.role::text in ('company_admin', 'delivery', 'external_worker')
  for update;

  if target_profile.id is null then
    raise exception using errcode = 'P0001', message = 'ACCESS_ACCOUNT_NOT_FOUND';
  end if;

  update public.profiles
  set active = is_active
  where id = target_profile.id
  returning * into target_profile;

  if target_profile.role::text = 'external_worker' then
    update public.diners
    set active = is_active
    where auth_user_id = target_profile.id
      and organization_id = actor_organization_id
      and type = 'external';

    if not found then
      raise exception using errcode = 'P0001', message = 'DINER_NOT_FOUND';
    end if;
  end if;

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

revoke all on function public.set_provider_access_active(uuid, boolean) from public, anon;
grant execute on function public.set_provider_access_active(uuid, boolean) to authenticated;
