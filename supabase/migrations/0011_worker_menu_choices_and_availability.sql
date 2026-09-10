-- Nuevas elecciones de acompañamiento y disponibilidad visible para trabajadores.
alter type public.side_choice add value if not exists 'fruta';

create or replace function public.get_menu_option_availability(target_menu_week_id uuid)
returns table (
  menu_option_id uuid,
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
  if not exists (
    select 1
    from public.menu_weeks as menu_week
    where menu_week.id = target_menu_week_id
      and menu_week.published_at is not null
  ) then
    raise exception using errcode = 'P0001', message = 'MENU_WEEK_NOT_PUBLISHED';
  end if;

  return query
  select
    menu_option.id,
    coalesce(sum(order_record.quantity) filter (
      where order_record.status = 'confirmed'
    ), 0)::integer as reserved_quantity,
    case
      when menu_option.capacity is null then null
      else greatest(
        menu_option.capacity - coalesce(sum(order_record.quantity) filter (
          where order_record.status = 'confirmed'
        ), 0)::integer,
        0
      )
    end as remaining_quantity
  from public.menu_options as menu_option
  join public.service_days as service_day
    on service_day.id = menu_option.service_day_id
  left join public.orders as order_record
    on order_record.menu_option_id = menu_option.id
    and order_record.service_day_id = service_day.id
  where service_day.menu_week_id = target_menu_week_id
    and menu_option.visible
    and menu_option.available_for_workers
  group by menu_option.id, menu_option.capacity;
end;
$$;

revoke all on function public.get_menu_option_availability(uuid) from public, anon;
grant execute on function public.get_menu_option_availability(uuid) to authenticated;

comment on function public.get_menu_option_availability(uuid) is
  'Entrega totales reservados y cupos restantes sin exponer pedidos de otros trabajadores.';

create or replace function private.enforce_menu_option_capacity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  option_capacity integer;
  already_confirmed integer;
begin
  if new.status <> 'confirmed' then
    return new;
  end if;

  -- El bloqueo de la alternativa serializa reservas simultáneas del mismo plato.
  select menu_option.capacity
  into option_capacity
  from public.menu_options as menu_option
  where menu_option.id = new.menu_option_id
    and menu_option.service_day_id = new.service_day_id
  for no key update;

  if option_capacity is null then
    return new;
  end if;

  select coalesce(sum(order_record.quantity), 0)::integer
  into already_confirmed
  from public.orders as order_record
  where order_record.service_day_id = new.service_day_id
    and order_record.menu_option_id = new.menu_option_id
    and order_record.status = 'confirmed'
    and order_record.id <> new.id
    and not (
      new.kind = 'regular'
      and new.diner_id is not null
      and order_record.diner_id = new.diner_id
    );

  if already_confirmed + new.quantity > option_capacity then
    raise exception using errcode = 'P0001', message = 'MENU_OPTION_CAPACITY_EXCEEDED';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_enforce_capacity on public.orders;
create trigger orders_enforce_capacity
before insert or update of service_day_id, menu_option_id, quantity, status
on public.orders
for each row execute function private.enforce_menu_option_capacity();

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
  target_service_date date;
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

  select service_day.service_date
  into target_service_date
  from public.service_days as service_day
  where service_day.id = target_service_day_id;

  if selected_side::text = 'postre'
    and extract(isodow from target_service_date) <> 3 then
    raise exception using errcode = 'P0001', message = 'DESSERT_ONLY_WEDNESDAY';
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

revoke all on function public.save_regular_order(uuid, uuid, public.side_choice, boolean, boolean)
  from public, anon;
grant execute on function public.save_regular_order(uuid, uuid, public.side_choice, boolean, boolean)
  to authenticated;

comment on function public.save_regular_order(uuid, uuid, public.side_choice, boolean, boolean) is
  'Crea o actualiza la reserva del trabajador; fruta y ensalada son excluyentes y el postre sólo se ofrece los miércoles.';
