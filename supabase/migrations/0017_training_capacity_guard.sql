-- Las capacitaciones sólo pueden consumir un cupo diario informado por la
-- proveedora. El bloqueo de la alternativa mantiene seguras las inscripciones
-- simultáneas y las correcciones posteriores de Securitas.

begin;

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

  select menu_option.capacity
  into option_capacity
  from public.menu_options as menu_option
  where menu_option.id = new.menu_option_id
    and menu_option.service_day_id = new.service_day_id
  for no key update;

  if new.kind = 'training' and option_capacity is null then
    raise exception using
      errcode = 'P0001',
      message = 'TRAINING_CAPACITY_REQUIRED';
  end if;

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
    if new.kind = 'training' then
      raise exception using
        errcode = 'P0001',
        message = 'TRAINING_CAPACITY_EXCEEDED';
    end if;
    raise exception using
      errcode = 'P0001',
      message = 'MENU_OPTION_CAPACITY_EXCEEDED';
  end if;

  return new;
end;
$$;

comment on function private.enforce_menu_option_capacity() is
  'Impide sobrecupos atómicamente y exige disponibilidad informada para pedidos de capacitación.';

commit;
