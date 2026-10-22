-- Habilita a los trabajadores externos para crear y modificar su reserva
-- mediante el mismo flujo atomico utilizado por trabajadores Securitas.

begin;

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
  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = actor_id
      and profile.active
      and profile.role in ('worker', 'external_worker')
  ) then
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
    and diner.type in ('worker', 'external')
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
  'Guarda la reserva regular de trabajadores Securitas y externos, exigiendo elegir pan o te.';

commit;
