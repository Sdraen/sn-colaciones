-- Una capacitación nueva incluye ensalada, fruta, jugo y pan por alumno.
-- El té sigue siendo opcional. Los registros anteriores conservan su selección.

begin;

alter table public.orders
  add column training_package boolean not null default false;

alter table public.orders
  add constraint orders_training_package_check check (
    not training_package or (kind = 'training' and side = 'ensalada' and bread)
  );

create or replace function private.apply_training_package()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'training' then
    if tg_op = 'INSERT' then
      new.training_package := true;
    elsif old.training_package
      or new.menu_option_id is distinct from old.menu_option_id
      or new.beneficiary_label is distinct from old.beneficiary_label
      or new.quantity is distinct from old.quantity
      or new.side is distinct from old.side
      or new.bread is distinct from old.bread
      or new.tea is distinct from old.tea
      or new.training_package is distinct from old.training_package
    then
      new.training_package := true;
    end if;
    if new.training_package then
      new.side := 'ensalada';
      new.bread := true;
    end if;
  else
    new.training_package := false;
  end if;
  return new;
end;
$$;

create trigger orders_apply_training_package
before insert or update on public.orders
for each row execute function private.apply_training_package();

-- El control de recepción calcula sus líneas dentro de una RPC. Se actualiza
-- esa única sección sin alterar sus verificaciones de permisos y auditoría.
do $migration$
declare
  original_definition text := pg_get_functiondef(
    'public.save_service_receipt_check(uuid,jsonb,text)'::regprocedure
  );
  updated_definition text;
  side_marker text;
  bread_marker text;
  end_marker text;
  side_start integer;
  bread_start integer;
begin
  -- pg_get_functiondef conserva el cuerpo con los saltos de línea originales.
  -- No depender de una indentación concreta ni de LF frente a CRLF.
  side_marker := substring(original_definition from 'select[[:space:]]+''side:''[[:space:]]*[|][|]');
  bread_marker := substring(original_definition from 'select[[:space:]]+''complement:bread''');
  side_start := case when side_marker is null then 0 else strpos(original_definition, side_marker) end;
  bread_start := case when bread_marker is null then 0 else strpos(original_definition, bread_marker) end;
  if side_start = 0 or bread_start <= side_start then
    raise exception 'No se encontró el cálculo de acompañamientos en recepción';
  end if;

  updated_definition := substr(original_definition, 1, side_start - 1)
    || $side$    select
      'side:' || sides.side,
      'side',
      case sides.side
        when 'ensalada' then 'Ensaladas'
        when 'fruta' then 'Frutas'
        when 'postre' then 'Postres'
        else 'Sin acompañamiento'
      end,
      sum(sides.quantity)::integer,
      2,
      case sides.side when 'ensalada' then 1 when 'fruta' then 2 when 'postre' then 3 else 4 end
    from (
      select order_record.side::text as side, order_record.quantity
      from public.orders as order_record
      where order_record.service_day_id = target_service_day_id
        and order_record.status = 'confirmed'
        and order_record.side::text <> 'ninguno'
      union all
      select 'fruta' as side, order_record.quantity
      from public.orders as order_record
      where order_record.service_day_id = target_service_day_id
        and order_record.status = 'confirmed'
        and order_record.training_package
    ) as sides
    group by sides.side

    union all

$side$
    || substr(original_definition, bread_start);

  end_marker := substring(
    updated_definition from '[)][[:space:]]+as[[:space:]]+expected_line[[:space:]]*;'
  );
  if end_marker is null then
    raise exception 'No se encontró el final del conteo de recepción';
  end if;
  updated_definition := replace(
    updated_definition,
    end_marker,
    $juice$
    union all

    select
      'complement:juice', 'complement', 'Jugos de capacitación', sum(order_record.quantity)::integer, 3, 3
    from public.orders as order_record
    where order_record.service_day_id = target_service_day_id
      and order_record.status = 'confirmed'
      and order_record.training_package
    having sum(order_record.quantity) > 0
  ) as expected_line;$juice$
  );

  execute updated_definition;
end;
$migration$;

comment on column public.orders.training_package is
  'Paquete de capacitación: ensalada, fruta, jugo y pan por alumno; té opcional. Falso en registros históricos.';

commit;
