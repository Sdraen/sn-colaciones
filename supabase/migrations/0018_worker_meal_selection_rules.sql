-- Reglas acordadas para la selección de colaciones:
-- ensalada o fruta como acompañamiento, y pan, té o ambos como complementos.

begin;

alter table public.orders
  drop constraint if exists orders_bread_or_tea_check;
alter table public.orders
  add constraint orders_bread_or_tea_check check (bread or tea);

alter table public.exception_requests
  drop constraint if exists exception_requests_bread_or_tea_check;
alter table public.exception_requests
  add constraint exception_requests_bread_or_tea_check check (bread or tea);

-- Las funciones de protección fueron definidas en migraciones anteriores y
-- contienen todas las ventanas operacionales. Se conserva esa lógica y sólo
-- se reemplaza la validación de selección acordada.
do $migration$
declare
  function_name regprocedure;
  original_definition text;
  patched_definition text;
begin
  foreach function_name in array array[
    'private.enforce_order_business_rules()'::regprocedure,
    'private.enforce_exception_request_rules()'::regprocedure
  ] loop
    original_definition := pg_get_functiondef(function_name);
    patched_definition := regexp_replace(
      original_definition,
      'if new\.bread = new\.tea then\s+raise exception using errcode = ''22023'', message = ''BREAD_OR_TEA_REQUIRED'';\s+end if;',
      E'if not (new.bread or new.tea) then\n    raise exception using errcode = ''22023'', message = ''BREAD_OR_TEA_REQUIRED'';\n  end if;\n  if new.side::text not in (''ensalada'', ''fruta'')\n    and (tg_op = ''INSERT'' or new.side is distinct from old.side)\n  then\n    raise exception using errcode = ''22023'', message = ''INVALID_SIDE_CHOICE'';\n  end if;',
      'i'
    );
    if patched_definition = original_definition then
      raise exception 'No fue posible actualizar la validación en %', function_name;
    end if;
    execute patched_definition;
  end loop;

  foreach function_name in array array[
    'public.update_company_operational_order(uuid,uuid,text,integer,public.side_choice,boolean,boolean)'::regprocedure,
    'public.update_company_extra_request(uuid,uuid,text,text,public.side_choice,boolean,boolean)'::regprocedure
  ] loop
    original_definition := pg_get_functiondef(function_name);
    patched_definition := replace(
      original_definition,
      'include_bread = include_tea',
      'not (include_bread or include_tea)'
    );
    if patched_definition = original_definition then
      raise exception 'No fue posible actualizar la validación en %', function_name;
    end if;
    execute patched_definition;
  end loop;
end;
$migration$;

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
  if selected_side::text not in ('ensalada', 'fruta') then
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

revoke all on function public.save_regular_order(uuid, uuid, public.side_choice, boolean, boolean)
  from public, anon;
grant execute on function public.save_regular_order(uuid, uuid, public.side_choice, boolean, boolean)
  to authenticated;

comment on constraint orders_bread_or_tea_check on public.orders is
  'Cada colación debe incluir pan, té o ambos.';
comment on constraint exception_requests_bread_or_tea_check on public.exception_requests is
  'Cada solicitud extra debe incluir pan, té o ambos.';
comment on function public.save_regular_order(uuid, uuid, public.side_choice, boolean, boolean) is
  'Crea o actualiza la reserva con ensalada o fruta y permite seleccionar pan, té o ambos.';

commit;
