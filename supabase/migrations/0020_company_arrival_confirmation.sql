-- Separa la llegada informada por despacho de la confirmación de llegada de Securitas.

begin;

alter table public.service_delivery_tracking
  add column company_arrival_confirmed_at timestamptz,
  add column company_arrival_confirmed_by uuid references public.profiles(id);

update public.service_delivery_tracking as tracking
set company_arrival_confirmed_at = tracking.arrived_at,
    company_arrival_confirmed_by = tracking.arrived_by
from public.profiles as profile
where profile.id = tracking.arrived_by
  and profile.role::text = 'company_admin'
  and tracking.company_arrival_confirmed_at is null;

update public.service_delivery_tracking as tracking
set company_arrival_confirmed_at = receipt.updated_at,
    company_arrival_confirmed_by = receipt.reported_by
from public.service_receipt_checks as receipt
where receipt.service_day_id = tracking.service_day_id
  and tracking.company_arrival_confirmed_at is null;

create or replace function public.confirm_company_delivery_arrival(
  target_service_day_id uuid
)
returns public.service_delivery_tracking
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_organization_id uuid;
  target_organization_id uuid;
  target_service_date date;
  target_timezone text;
  confirmed_at timestamptz := now();
  saved_tracking public.service_delivery_tracking%rowtype;
begin
  select profile.organization_id
  into actor_organization_id
  from public.profiles as profile
  where profile.id = actor_id
    and profile.active
    and profile.role::text = 'company_admin';

  if actor_organization_id is null then
    raise exception using errcode = 'P0001', message = 'COMPANY_ROLE_REQUIRED';
  end if;

  select menu_week.organization_id, service_day.service_date, organization.timezone
  into target_organization_id, target_service_date, target_timezone
  from public.service_days as service_day
  join public.menu_weeks as menu_week on menu_week.id = service_day.menu_week_id
  join public.organizations as organization on organization.id = menu_week.organization_id
  where service_day.id = target_service_day_id;

  if target_organization_id is null or target_organization_id <> actor_organization_id then
    raise exception using errcode = 'P0001', message = 'SERVICE_DAY_NOT_FOUND';
  end if;

  if target_service_date <> (now() at time zone target_timezone)::date then
    raise exception using errcode = 'P0001', message = 'DELIVERY_DAY_MISMATCH';
  end if;

  insert into public.service_delivery_tracking (service_day_id, organization_id)
  values (target_service_day_id, target_organization_id)
  on conflict (service_day_id) do nothing;

  select tracking.*
  into saved_tracking
  from public.service_delivery_tracking as tracking
  where tracking.service_day_id = target_service_day_id
  for update;

  if saved_tracking.company_arrival_confirmed_at is null then
    update public.service_delivery_tracking
    set company_arrival_confirmed_at = confirmed_at,
        company_arrival_confirmed_by = actor_id,
        arrived_at = coalesce(arrived_at, confirmed_at),
        arrived_by = case when arrived_at is null then actor_id else arrived_by end
    where service_day_id = target_service_day_id
    returning * into saved_tracking;

    insert into public.audit_events (
      organization_id, actor_id, entity_type, entity_id, action, metadata
    ) values (
      target_organization_id,
      actor_id,
      'service_delivery',
      target_service_day_id,
      'delivery.company_arrival_confirmed',
      jsonb_build_object('confirmed_at', confirmed_at)
    );
  end if;

  return saved_tracking;
end;
$$;

create or replace function private.require_company_arrival_for_receipt_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.service_delivery_tracking as tracking
    where tracking.service_day_id = new.service_day_id
      and tracking.company_arrival_confirmed_at is not null
  ) then
    raise exception using errcode = 'P0001', message = 'COMPANY_ARRIVAL_REQUIRED';
  end if;

  return new;
end;
$$;

create trigger service_receipt_checks_require_company_arrival
before insert or update on public.service_receipt_checks
for each row execute function private.require_company_arrival_for_receipt_check();

revoke all on function public.confirm_company_delivery_arrival(uuid) from public, anon;
grant execute on function public.confirm_company_delivery_arrival(uuid) to authenticated;

comment on column public.service_delivery_tracking.company_arrival_confirmed_at is
  'Hora en que administración Securitas confirmó que la comida llegó físicamente.';
comment on function public.confirm_company_delivery_arrival(uuid) is
  'Registra por separado la confirmación de llegada realizada por administración Securitas.';

commit;
