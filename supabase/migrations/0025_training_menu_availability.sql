-- Mostrar a Securitas los cupos de capacitación realmente consumidos.
-- Los trabajadores siguen recibiendo sólo la disponibilidad de sus alternativas.

begin;

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
    and (
      menu_option.available_for_workers
      or (
        menu_option.available_for_training
        and (select private.current_user_has_role('company_admin'))
      )
    )
  group by menu_option.id, menu_option.capacity;
end;
$$;

comment on function public.get_menu_option_availability(uuid) is
  'Entrega cupos restantes de alternativas para trabajadores y también de capacitación sólo a Securitas.';

commit;
