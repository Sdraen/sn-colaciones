-- Seguimiento diario del despacho: llegada, término de entrega y recepción
-- confirmada por Securitas. Requiere las migraciones 0001 a 0007.

begin;

create table public.service_delivery_tracking (
  service_day_id uuid primary key references public.service_days(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  arrived_at timestamptz,
  arrived_by uuid references public.profiles(id),
  delivered_at timestamptz,
  delivered_by uuid references public.profiles(id),
  receipt_confirmed_at timestamptz,
  receipt_confirmed_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  constraint delivery_arrival_actor_check check (
    (arrived_at is null) = (arrived_by is null)
  ),
  constraint delivery_completed_actor_check check (
    (delivered_at is null) = (delivered_by is null)
  ),
  constraint delivery_receipt_actor_check check (
    (receipt_confirmed_at is null) = (receipt_confirmed_by is null)
  ),
  constraint delivery_event_order_check check (
    (delivered_at is null or (arrived_at is not null and delivered_at >= arrived_at))
    and (
      receipt_confirmed_at is null
      or (delivered_at is not null and receipt_confirmed_at >= delivered_at)
    )
  )
);

create index service_delivery_tracking_organization_index
  on public.service_delivery_tracking (organization_id, updated_at desc);

create trigger service_delivery_tracking_set_updated_at
before update on public.service_delivery_tracking
for each row execute function public.set_updated_at();

alter table public.service_delivery_tracking enable row level security;

revoke all on table public.service_delivery_tracking from anon, authenticated;
grant select on table public.service_delivery_tracking to authenticated;

create policy "operations can read delivery tracking"
on public.service_delivery_tracking for select
to authenticated
using (
  organization_id = (select private.current_organization_id())
  and (
    (select private.current_user_has_role('provider_admin'))
    or (select private.current_user_has_role('company_admin'))
    or (select private.current_user_has_role('delivery'))
  )
);

create or replace function public.record_delivery_event(
  target_service_day_id uuid,
  event_name text
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
  saved_tracking public.service_delivery_tracking%rowtype;
  changed_rows integer := 0;
begin
  select profile.organization_id
  into actor_organization_id
  from public.profiles as profile
  where profile.id = actor_id
    and profile.active
    and profile.role::text = 'delivery';

  if actor_organization_id is null then
    raise exception using errcode = 'P0001', message = 'DELIVERY_ROLE_REQUIRED';
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

  if event_name not in ('arrived', 'delivered') then
    raise exception using errcode = 'P0001', message = 'INVALID_DELIVERY_EVENT';
  end if;

  insert into public.service_delivery_tracking (service_day_id, organization_id)
  values (target_service_day_id, target_organization_id)
  on conflict (service_day_id) do nothing;

  select tracking.*
  into saved_tracking
  from public.service_delivery_tracking as tracking
  where tracking.service_day_id = target_service_day_id
  for update;

  if event_name = 'arrived' then
    if saved_tracking.arrived_at is null then
      update public.service_delivery_tracking
      set arrived_at = now(), arrived_by = actor_id
      where service_day_id = target_service_day_id
      returning * into saved_tracking;
      get diagnostics changed_rows = row_count;
    end if;
  else
    if saved_tracking.arrived_at is null then
      raise exception using errcode = 'P0001', message = 'DELIVERY_ARRIVAL_REQUIRED';
    end if;
    if saved_tracking.delivered_at is null then
      update public.service_delivery_tracking
      set delivered_at = now(), delivered_by = actor_id
      where service_day_id = target_service_day_id
      returning * into saved_tracking;
      get diagnostics changed_rows = row_count;
    end if;
  end if;

  if changed_rows > 0 then
    insert into public.audit_events (
      organization_id,
      actor_id,
      entity_type,
      entity_id,
      action,
      metadata
    ) values (
      target_organization_id,
      actor_id,
      'service_delivery',
      target_service_day_id,
      case event_name
        when 'arrived' then 'delivery.arrived'
        else 'delivery.completed'
      end,
      jsonb_build_object('recorded_at', now())
    );
  end if;

  return saved_tracking;
end;
$$;

create or replace function public.confirm_service_receipt(
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
  saved_tracking public.service_delivery_tracking%rowtype;
begin
  select profile.organization_id
  into actor_organization_id
  from public.profiles as profile
  where profile.id = actor_id
    and profile.active
    and profile.role = 'company_admin';

  if actor_organization_id is null then
    raise exception using errcode = 'P0001', message = 'COMPANY_ROLE_REQUIRED';
  end if;

  select menu_week.organization_id
  into target_organization_id
  from public.service_days as service_day
  join public.menu_weeks as menu_week on menu_week.id = service_day.menu_week_id
  where service_day.id = target_service_day_id;

  if target_organization_id is null or target_organization_id <> actor_organization_id then
    raise exception using errcode = 'P0001', message = 'SERVICE_DAY_NOT_FOUND';
  end if;

  select tracking.*
  into saved_tracking
  from public.service_delivery_tracking as tracking
  where tracking.service_day_id = target_service_day_id
  for update;

  if saved_tracking.service_day_id is null or saved_tracking.delivered_at is null then
    raise exception using errcode = 'P0001', message = 'DELIVERY_COMPLETION_REQUIRED';
  end if;

  if saved_tracking.receipt_confirmed_at is null then
    update public.service_delivery_tracking
    set receipt_confirmed_at = now(), receipt_confirmed_by = actor_id
    where service_day_id = target_service_day_id
    returning * into saved_tracking;

    update public.orders
    set fulfilled_at = saved_tracking.receipt_confirmed_at
    where service_day_id = target_service_day_id
      and status = 'confirmed'
      and fulfilled_at is null;

    insert into public.audit_events (
      organization_id,
      actor_id,
      entity_type,
      entity_id,
      action,
      metadata
    ) values (
      target_organization_id,
      actor_id,
      'service_delivery',
      target_service_day_id,
      'delivery.receipt_confirmed',
      jsonb_build_object('confirmed_at', saved_tracking.receipt_confirmed_at)
    );
  end if;

  return saved_tracking;
end;
$$;

revoke all on function public.record_delivery_event(uuid, text) from public, anon;
revoke all on function public.confirm_service_receipt(uuid) from public, anon;
grant execute on function public.record_delivery_event(uuid, text) to authenticated;
grant execute on function public.confirm_service_receipt(uuid) to authenticated;

-- La recepción ahora se confirma por servicio completo. Se evita que la
-- proveedora marque pedidos individuales por fuera del flujo acordado.
revoke execute on function public.mark_order_fulfilled(uuid, boolean) from authenticated;

comment on table public.service_delivery_tracking is
  'Hitos diarios registrados por despacho y confirmación final de Securitas.';
comment on function public.record_delivery_event(uuid, text) is
  'Permite a despacho registrar, en orden, la llegada a Securitas y el término de la entrega.';
comment on function public.confirm_service_receipt(uuid) is
  'Permite a la administradora Securitas confirmar la recepción y contabilizar los pedidos como entregados.';

commit;
