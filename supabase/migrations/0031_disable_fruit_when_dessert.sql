-- Un día con postre permite elegir ensalada o postre, pero no fruta.
-- Ejecutar después de 0030_daily_worker_dessert.sql.

begin;

create or replace function private.prevent_dessert_with_fruit_reservations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.dessert_name is not null and exists (
    select 1
    from public.orders as order_record
    where order_record.service_day_id = new.id
      and order_record.kind = 'regular'
      and order_record.side = 'fruta'
      and order_record.status = 'confirmed'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'DAILY_DESSERT_CONFLICTS_WITH_FRUIT_RESERVATIONS';
  end if;

  return new;
end;
$$;

create trigger service_days_prevent_dessert_with_fruit_reservations
before insert or update of dessert_name
on public.service_days
for each row execute function private.prevent_dessert_with_fruit_reservations();

do $migration$
declare
  original_definition text := pg_get_functiondef(
    'private.enforce_order_business_rules()'::regprocedure
  );
  validation_anchor text := E'raise exception using errcode = ''22023'', message = ''INVALID_SIDE_CHOICE'';\n  end if;';
  updated_definition text;
begin
  if strpos(original_definition, 'FRUIT_NOT_AVAILABLE_WITH_DESSERT') > 0 then
    return;
  end if;

  if strpos(original_definition, validation_anchor) = 0 then
    raise exception 'No se encontró la validación de acompañamientos en pedidos';
  end if;

  updated_definition := replace(
    original_definition,
    validation_anchor,
    validation_anchor || E'\n  if new.kind = ''regular''\n    and new.side = ''fruta''\n    and target_day.dessert_name is not null\n  then\n    raise exception using errcode = ''P0001'', message = ''FRUIT_NOT_AVAILABLE_WITH_DESSERT'';\n  end if;'
  );

  execute updated_definition;
end;
$migration$;

comment on function private.enforce_order_business_rules() is
  'Valida ventanas, disponibilidad y acompañamientos; bloquea fruta en días con postre.';
comment on function private.prevent_dessert_with_fruit_reservations() is
  'Impide ofrecer postre si el día ya tiene reservas de fruta.';

revoke all on function private.prevent_dessert_with_fruit_reservations()
from public, anon, authenticated;

commit;
