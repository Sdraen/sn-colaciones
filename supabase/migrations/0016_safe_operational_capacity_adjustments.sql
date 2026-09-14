-- Convierte Producción en un ajuste operativo seguro del mismo cupo definido
-- inicialmente en Menús. Protege reservas, historial y entregas terminadas.

begin;

create or replace function public.set_menu_option_availability(
  target_menu_option_id uuid,
  informed_capacity integer,
  is_visible boolean default null
)
returns public.menu_options
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
  target_published_at timestamptz;
  saved_option public.menu_options%rowtype;
  reserved_quantity integer;
begin
  if actor_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select profile.organization_id
  into actor_organization_id
  from public.profiles as profile
  where profile.id = actor_id
    and profile.active
    and profile.role = 'provider_admin';

  if actor_organization_id is null then
    raise exception using errcode = 'P0001', message = 'PROVIDER_ROLE_REQUIRED';
  end if;
  if informed_capacity is null or informed_capacity < 0 then
    raise exception using errcode = '22023', message = 'INVALID_CAPACITY';
  end if;

  select menu_option.*
  into saved_option
  from public.menu_options as menu_option
  where menu_option.id = target_menu_option_id
  for update;

  if saved_option.id is null then
    raise exception using errcode = 'P0001', message = 'MENU_OPTION_NOT_FOUND';
  end if;

  select
    menu_week.organization_id,
    service_day.service_date,
    organization.timezone,
    menu_week.published_at
  into
    target_organization_id,
    target_service_date,
    target_timezone,
    target_published_at
  from public.service_days as service_day
  join public.menu_weeks as menu_week on menu_week.id = service_day.menu_week_id
  join public.organizations as organization on organization.id = menu_week.organization_id
  where service_day.id = saved_option.service_day_id;

  if target_organization_id is null
    or target_organization_id <> actor_organization_id
    or not saved_option.available_for_workers
  then
    raise exception using errcode = 'P0001', message = 'MENU_OPTION_NOT_FOUND';
  end if;
  if target_published_at is null then
    raise exception using errcode = 'P0001', message = 'MENU_WEEK_NOT_PUBLISHED';
  end if;
  if target_service_date < (now() at time zone target_timezone)::date then
    raise exception using errcode = 'P0001', message = 'OPERATION_HISTORY_LOCKED';
  end if;
  if exists (
    select 1
    from public.service_delivery_tracking as tracking
    where tracking.service_day_id = saved_option.service_day_id
      and (tracking.delivered_at is not null or tracking.receipt_confirmed_at is not null)
  ) then
    raise exception using errcode = 'P0001', message = 'DELIVERY_ALREADY_COMPLETED';
  end if;

  select coalesce(sum(order_record.quantity), 0)::integer
  into reserved_quantity
  from public.orders as order_record
  where order_record.menu_option_id = saved_option.id
    and order_record.status = 'confirmed';

  if informed_capacity < reserved_quantity then
    raise exception using errcode = 'P0001', message = 'MENU_CAPACITY_BELOW_RESERVATIONS';
  end if;
  if is_visible = false and reserved_quantity > 0 then
    raise exception using errcode = 'P0001', message = 'MENU_OPTION_HAS_RESERVATIONS';
  end if;

  update public.menu_options
  set capacity = informed_capacity,
      capacity_updated_at = now(),
      visible = coalesce(is_visible, visible)
  where id = saved_option.id
  returning * into saved_option;

  update public.service_days
  set availability_published_at = now()
  where id = saved_option.service_day_id;

  return saved_option;
end;
$$;

revoke all on function public.set_menu_option_availability(uuid, integer, boolean)
  from public, anon;
grant execute on function public.set_menu_option_availability(uuid, integer, boolean)
  to authenticated;

comment on function public.set_menu_option_availability(uuid, integer, boolean) is
  'Ajusta el cupo operativo sin bajar de las reservas confirmadas ni alterar días pasados o entregados.';

commit;
