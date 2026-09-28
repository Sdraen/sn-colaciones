-- Postre diario opcional para trabajadores, con nombre y cupo independiente.

begin;

alter table public.service_days
  add column dessert_name text,
  add column dessert_capacity integer,
  add column dessert_capacity_updated_at timestamptz,
  add constraint service_days_daily_dessert_check check (
    (dessert_name is null and dessert_capacity is null)
    or (
      nullif(btrim(dessert_name), '') is not null
      and char_length(btrim(dessert_name)) between 2 and 160
      and dessert_capacity between 0 and 10000
    )
  );

create or replace function public.save_menu_week_with_daily_desserts(
  target_starts_on date,
  week_days jsonb
)
returns public.menu_weeks
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_week public.menu_weeks%rowtype;
  day_payload jsonb;
  requested_name text;
  requested_capacity integer;
begin
  saved_week := public.save_menu_week_draft(target_starts_on, week_days);

  for day_payload in select value from jsonb_array_elements(week_days)
  loop
    requested_name := nullif(btrim(day_payload#>>'{dessert,name}'), '');
    requested_capacity := nullif(day_payload#>>'{dessert,capacity}', '')::integer;
    if (requested_name is null) <> (requested_capacity is null)
      or (requested_name is not null and (
        char_length(requested_name) not between 2 and 160
        or requested_capacity not between 0 and 10000
      )) then
      raise exception using errcode = '22023', message = 'INVALID_DAILY_DESSERT';
    end if;

    update public.service_days
    set dessert_name = requested_name,
        dessert_capacity = requested_capacity,
        dessert_capacity_updated_at = case when requested_name is null then null else now() end
    where menu_week_id = saved_week.id
      and service_date = (day_payload->>'service_date')::date;
  end loop;

  return saved_week;
end;
$$;

create or replace function public.update_published_menu_week_with_daily_desserts(
  target_menu_week_id uuid,
  week_days jsonb,
  confirm_impact boolean default false
)
returns public.menu_weeks
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_organization_id uuid;
  target_week public.menu_weeks%rowtype;
  target_timezone text;
  organization_today date;
  day_payload jsonb;
  target_day public.service_days%rowtype;
  requested_name text;
  requested_capacity integer;
  reserved_quantity integer;
  dessert_changed boolean;
begin
  select profile.organization_id
  into actor_organization_id
  from public.profiles as profile
  where profile.id = actor_id
    and profile.active
    and profile.role = 'provider_admin';

  if actor_organization_id is null then
    raise exception using errcode = 'P0001', message = 'PROVIDER_ROLE_REQUIRED';
  end if;

  select menu_week.*
  into target_week
  from public.menu_weeks as menu_week
  where menu_week.id = target_menu_week_id
    and menu_week.organization_id = actor_organization_id
  for update;

  if target_week.id is null then
    raise exception using errcode = 'P0001', message = 'MENU_WEEK_NOT_FOUND';
  end if;

  select organization.timezone
  into target_timezone
  from public.organizations as organization
  where organization.id = target_week.organization_id;

  organization_today := (now() at time zone target_timezone)::date;
  target_week := public.update_published_menu_week(
    target_menu_week_id,
    week_days,
    confirm_impact
  );

  for day_payload in select value from jsonb_array_elements(week_days)
  loop
    select service_day.*
    into target_day
    from public.service_days as service_day
    where service_day.menu_week_id = target_week.id
      and service_day.service_date = (day_payload->>'service_date')::date
    for update;

    requested_name := nullif(btrim(day_payload#>>'{dessert,name}'), '');
    requested_capacity := nullif(day_payload#>>'{dessert,capacity}', '')::integer;
    if (requested_name is null) <> (requested_capacity is null)
      or (requested_name is not null and (
        char_length(requested_name) not between 2 and 160
        or requested_capacity not between 0 and 10000
      )) then
      raise exception using errcode = '22023', message = 'INVALID_DAILY_DESSERT';
    end if;

    dessert_changed := target_day.dessert_name is distinct from requested_name
      or target_day.dessert_capacity is distinct from requested_capacity;
    if not dessert_changed then
      continue;
    end if;
    if target_day.service_date < organization_today then
      raise exception using errcode = 'P0001', message = 'OPERATION_HISTORY_LOCKED';
    end if;
    if exists (
      select 1 from public.service_delivery_tracking as tracking
      where tracking.service_day_id = target_day.id
        and (tracking.delivered_at is not null or tracking.receipt_confirmed_at is not null)
    ) then
      raise exception using errcode = 'P0001', message = 'DELIVERY_ALREADY_COMPLETED';
    end if;

    select coalesce(sum(order_record.quantity), 0)::integer
    into reserved_quantity
    from public.orders as order_record
    where order_record.service_day_id = target_day.id
      and order_record.kind = 'regular'
      and order_record.side = 'postre'
      and order_record.status = 'confirmed';

    if requested_name is null and reserved_quantity > 0 then
      raise exception using errcode = 'P0001', message = 'DAILY_DESSERT_HAS_RESERVATIONS';
    end if;
    if requested_capacity is not null and requested_capacity < reserved_quantity then
      raise exception using errcode = 'P0001', message = 'DAILY_DESSERT_CAPACITY_BELOW_RESERVATIONS';
    end if;
    if reserved_quantity > 0
      and target_day.dessert_name is distinct from requested_name
      and not confirm_impact then
      raise exception using errcode = 'P0001', message = 'MENU_EDIT_CONFIRMATION_REQUIRED';
    end if;

    if reserved_quantity > 0 and target_day.dessert_name is distinct from requested_name then
      insert into public.notifications (
        organization_id, recipient_profile_id, channel, event_type, title, body,
        related_entity_type, related_entity_id, delivered_at
      )
      select distinct
        target_week.organization_id,
        order_record.created_by,
        'in_app',
        'published_menu_changed',
        'Cambio en el postre reservado',
        'El postre del ' || to_char(target_day.service_date, 'DD/MM/YYYY') ||
          ' ahora es: ' || requested_name || '. Tu reserva y tu cupo se mantienen.',
        'service_day',
        target_day.id,
        now()
      from public.orders as order_record
      join public.profiles as recipient on recipient.id = order_record.created_by
      where order_record.service_day_id = target_day.id
        and order_record.kind = 'regular'
        and order_record.side = 'postre'
        and order_record.status = 'confirmed'
        and recipient.active;
    end if;

    update public.service_days
    set dessert_name = requested_name,
        dessert_capacity = requested_capacity,
        dessert_capacity_updated_at = case
          when requested_name is null then null
          when dessert_capacity is distinct from requested_capacity then now()
          else dessert_capacity_updated_at
        end
    where id = target_day.id;
  end loop;

  insert into public.audit_events (
    organization_id, actor_id, entity_type, entity_id, action, metadata
  ) values (
    target_week.organization_id,
    actor_id,
    'menu_week',
    target_week.id,
    'daily_desserts.saved',
    jsonb_build_object('impact_confirmed', confirm_impact)
  );

  return target_week;
end;
$$;

create or replace function public.get_daily_dessert_availability(target_menu_week_id uuid)
returns table (
  service_day_id uuid,
  reserved_quantity integer,
  remaining_quantity integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not (select private.menu_week_belongs_to_current_org(target_menu_week_id)) then
    raise exception using errcode = 'P0001', message = 'MENU_WEEK_NOT_FOUND';
  end if;
  if not (select private.current_user_has_role('provider_admin'))
    and not exists (
      select 1 from public.menu_weeks as menu_week
      where menu_week.id = target_menu_week_id and menu_week.published_at is not null
    ) then
    raise exception using errcode = 'P0001', message = 'MENU_WEEK_NOT_PUBLISHED';
  end if;

  return query
  select
    service_day.id,
    coalesce(sum(order_record.quantity) filter (
      where order_record.kind = 'regular'
        and order_record.side = 'postre'
        and order_record.status = 'confirmed'
    ), 0)::integer,
    case
      when service_day.dessert_capacity is null then null
      else greatest(
        service_day.dessert_capacity - coalesce(sum(order_record.quantity) filter (
          where order_record.kind = 'regular'
            and order_record.side = 'postre'
            and order_record.status = 'confirmed'
        ), 0)::integer,
        0
      )
    end
  from public.service_days as service_day
  left join public.orders as order_record on order_record.service_day_id = service_day.id
  where service_day.menu_week_id = target_menu_week_id
  group by service_day.id, service_day.dessert_capacity;
end;
$$;

do $migration$
declare
  original_definition text := pg_get_functiondef(
    'private.enforce_order_business_rules()'::regprocedure
  );
  updated_definition text;
begin
  updated_definition := replace(
    original_definition,
    'if new.side::text not in (''ensalada'', ''fruta'')',
    'if new.side::text not in (''ensalada'', ''fruta'', ''postre'')'
  );
  if updated_definition = original_definition then
    raise exception 'No se encontró la validación de acompañamientos del pedido';
  end if;
  execute updated_definition;
end;
$migration$;

create or replace function private.enforce_daily_dessert_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  offered_name text;
  offered_capacity integer;
  already_reserved integer;
begin
  if new.kind <> 'regular' or new.status <> 'confirmed' or new.side <> 'postre' then
    return new;
  end if;

  select service_day.dessert_name, service_day.dessert_capacity
  into offered_name, offered_capacity
  from public.service_days as service_day
  where service_day.id = new.service_day_id
  for update;

  if offered_name is null or offered_capacity is null then
    raise exception using errcode = 'P0001', message = 'DAILY_DESSERT_NOT_AVAILABLE';
  end if;

  select coalesce(sum(order_record.quantity), 0)::integer
  into already_reserved
  from public.orders as order_record
  where order_record.service_day_id = new.service_day_id
    and order_record.kind = 'regular'
    and order_record.side = 'postre'
    and order_record.status = 'confirmed'
    and order_record.id <> new.id;

  if already_reserved + new.quantity > offered_capacity then
    raise exception using errcode = 'P0001', message = 'DAILY_DESSERT_CAPACITY_EXCEEDED';
  end if;

  return new;
end;
$$;

create trigger orders_enforce_daily_dessert_capacity
before insert or update of service_day_id, kind, quantity, side, status
on public.orders
for each row execute function private.enforce_daily_dessert_capacity();

create or replace function public.save_regular_order(
  target_service_day_id uuid,
  target_menu_option_id uuid,
  selected_side public.side_choice,
  include_bread boolean,
  include_tea boolean
)
returns public.orders
language plpgsql
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_diner public.diners%rowtype;
  saved_order public.orders%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not (select private.current_user_has_role('worker')) then
    raise exception using errcode = 'P0001', message = 'WORKER_ROLE_REQUIRED';
  end if;
  if selected_side::text not in ('ensalada', 'fruta', 'postre') then
    raise exception using errcode = '22023', message = 'INVALID_WORKER_SIDE';
  end if;
  if not (include_bread or include_tea) then
    raise exception using errcode = '22023', message = 'BREAD_OR_TEA_REQUIRED';
  end if;

  select diner.*
  into target_diner
  from public.diners as diner
  where diner.auth_user_id = actor_id
    and diner.active
  limit 1;

  if target_diner.id is null then
    raise exception using errcode = 'P0001', message = 'DINER_NOT_FOUND';
  end if;

  insert into public.orders (
    service_day_id, menu_option_id, diner_id, created_by, kind,
    quantity, side, bread, tea
  ) values (
    target_service_day_id, target_menu_option_id, target_diner.id, actor_id,
    'regular', 1, selected_side, include_bread, include_tea
  )
  on conflict (service_day_id, diner_id)
    where diner_id is not null and status = 'confirmed'
  do update set
    menu_option_id = excluded.menu_option_id,
    side = excluded.side,
    bread = excluded.bread,
    tea = excluded.tea
  returning * into saved_order;

  return saved_order;
end;
$$;

revoke all on function public.save_menu_week_with_daily_desserts(date, jsonb) from public, anon;
revoke all on function public.update_published_menu_week_with_daily_desserts(uuid, jsonb, boolean) from public, anon;
revoke all on function public.get_daily_dessert_availability(uuid) from public, anon;
revoke all on function public.save_regular_order(uuid, uuid, public.side_choice, boolean, boolean) from public, anon;
revoke all on function private.enforce_daily_dessert_capacity() from public, anon, authenticated;

grant execute on function public.save_menu_week_with_daily_desserts(date, jsonb) to authenticated;
grant execute on function public.update_published_menu_week_with_daily_desserts(uuid, jsonb, boolean) to authenticated;
grant execute on function public.get_daily_dessert_availability(uuid) to authenticated;
grant execute on function public.save_regular_order(uuid, uuid, public.side_choice, boolean, boolean) to authenticated;

comment on column public.service_days.dessert_name is
  'Postre opcional ofrecido a trabajadores como alternativa diaria a ensalada o fruta.';
comment on column public.service_days.dessert_capacity is
  'Cupo independiente del postre diario para reservas de trabajadores.';
comment on function private.enforce_daily_dessert_capacity() is
  'Serializa reservas de postre por día y evita sobrecupos.';

commit;
