-- Los trabajadores eligen pan o té, nunca ambos.
-- Los paquetes de capacitación conservan pan fijo y té opcional.
-- Ejecutar después de 0031_disable_fruit_when_dessert.sql.

begin;

create or replace function private.enforce_worker_bread_or_tea()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'regular'
    and new.status = 'confirmed'
    and new.bread = new.tea
  then
    raise exception using
      errcode = '22023',
      message = 'WORKER_BREAD_OR_TEA_REQUIRED';
  end if;

  return new;
end;
$$;

create trigger orders_check_worker_bread_or_tea
before insert or update of kind, bread, tea, status
on public.orders
for each row execute function private.enforce_worker_bread_or_tea();

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
  if include_bread = include_tea then
    raise exception using errcode = '22023', message = 'WORKER_BREAD_OR_TEA_REQUIRED';
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

comment on function public.save_regular_order(uuid, uuid, public.side_choice, boolean, boolean) is
  'Guarda el pedido regular del trabajador y exige elegir pan o té.';
comment on function private.enforce_worker_bread_or_tea() is
  'Exige pan o té, pero no ambos, en pedidos confirmados de trabajadores.';

revoke all on function private.enforce_worker_bread_or_tea()
from public, anon, authenticated;
revoke all on function public.save_regular_order(uuid, uuid, public.side_choice, boolean, boolean)
from public, anon;

grant execute on function public.save_regular_order(uuid, uuid, public.side_choice, boolean, boolean)
to authenticated;

commit;
