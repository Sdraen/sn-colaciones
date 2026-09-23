-- Securitas puede registrar varias colaciones de una misma alternativa.
-- El pedido confirmado consume todos sus cupos de manera atomica.

begin;

alter table public.orders drop constraint order_beneficiary_check;
alter table public.orders add constraint order_beneficiary_check check (
  (kind = 'regular' and diner_id is not null and training_session_id is null and quantity = 1)
  or (kind = 'training' and training_session_id is not null and diner_id is null)
  or (kind in ('extra', 'exceptional') and beneficiary_label is not null and quantity between 1 and 500)
);

alter table public.exception_requests
  add column quantity integer not null default 1;
alter table public.exception_requests
  add constraint exception_requests_quantity_check check (quantity between 1 and 500);

create or replace function public.create_extra_order_with_quantity(
  target_service_day_id uuid,
  target_menu_option_id uuid,
  beneficiary_name text,
  requested_quantity integer,
  selected_side public.side_choice,
  include_bread boolean,
  include_tea boolean
)
returns public.orders
language plpgsql
set search_path = ''
as $$
declare
  saved_order public.orders%rowtype;
begin
  if requested_quantity is null or requested_quantity not between 1 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_EXTRA_QUANTITY';
  end if;

  saved_order := public.create_extra_order(
    target_service_day_id, target_menu_option_id, beneficiary_name,
    selected_side, include_bread, include_tea
  );

  if requested_quantity > 1 then
    update public.orders
    set quantity = requested_quantity
    where id = saved_order.id
    returning * into saved_order;
  end if;

  return saved_order;
end;
$$;

create or replace function public.request_exceptional_order_with_quantity(
  target_service_day_id uuid,
  target_menu_option_id uuid,
  beneficiary_name text,
  request_reason text,
  requested_quantity integer,
  selected_side public.side_choice,
  include_bread boolean,
  include_tea boolean
)
returns public.exception_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_request public.exception_requests%rowtype;
  target_week_id uuid;
  remaining integer;
begin
  if requested_quantity is null or requested_quantity not between 1 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_EXTRA_QUANTITY';
  end if;
  if not exists (
    select 1
    from public.profiles as profile
    join public.menu_weeks as menu_week on menu_week.organization_id = profile.organization_id
    join public.service_days as service_day on service_day.menu_week_id = menu_week.id
    where profile.id = auth.uid()
      and profile.active
      and profile.role = 'company_admin'
      and service_day.id = target_service_day_id
  ) then
    raise exception using errcode = 'P0001', message = 'COMPANY_ROLE_REQUIRED';
  end if;

  saved_request := public.request_exceptional_order(
    target_service_day_id, target_menu_option_id, beneficiary_name,
    request_reason, selected_side, include_bread, include_tea
  );

  select service_day.menu_week_id into target_week_id
  from public.service_days as service_day
  where service_day.id = target_service_day_id;
  select availability.remaining_quantity into remaining
  from public.get_menu_option_availability(target_week_id) as availability
  where availability.menu_option_id = target_menu_option_id;
  if remaining is not null and requested_quantity > remaining then
    raise exception using errcode = 'P0001', message = 'MENU_OPTION_CAPACITY_EXCEEDED';
  end if;

  update public.exception_requests
  set quantity = requested_quantity
  where id = saved_request.id
  returning * into saved_request;
  return saved_request;
end;
$$;

create or replace function public.update_company_operational_order_with_quantity(
  target_order_id uuid,
  target_menu_option_id uuid,
  record_name text,
  attendee_count integer,
  requested_quantity integer,
  selected_side public.side_choice,
  include_bread boolean,
  include_tea boolean
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_order public.orders%rowtype;
  target_organization_id uuid;
begin
  if requested_quantity is null or requested_quantity not between 1 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_EXTRA_QUANTITY';
  end if;

  -- La RPC anterior valida rol, organizacion, estado y cierre de entrega.
  saved_order := public.update_company_operational_order(
    target_order_id, target_menu_option_id, record_name, attendee_count,
    selected_side, include_bread, include_tea
  );

  if saved_order.kind = 'training' then
    if requested_quantity <> attendee_count then
      raise exception using errcode = '22023', message = 'INVALID_EXTRA_QUANTITY';
    end if;
    return saved_order;
  end if;

  if saved_order.exception_request_id is not null then
    update public.exception_requests
    set quantity = requested_quantity
    where id = saved_order.exception_request_id;
  end if;
  update public.orders
  set quantity = requested_quantity
  where id = saved_order.id
  returning * into saved_order;

  select menu_week.organization_id into target_organization_id
  from public.service_days as service_day
  join public.menu_weeks as menu_week on menu_week.id = service_day.menu_week_id
  where service_day.id = saved_order.service_day_id;
  insert into public.audit_events (
    organization_id, actor_id, entity_type, entity_id, action, metadata
  ) values (
    target_organization_id, auth.uid(), 'order', saved_order.id,
    'company.extra_quantity_corrected', jsonb_build_object('quantity', requested_quantity)
  );
  return saved_order;
end;
$$;

create or replace function public.update_company_extra_request_with_quantity(
  target_request_id uuid,
  target_menu_option_id uuid,
  beneficiary_name text,
  request_reason text,
  requested_quantity integer,
  selected_side public.side_choice,
  include_bread boolean,
  include_tea boolean
)
returns public.exception_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_request public.exception_requests%rowtype;
  target_week_id uuid;
  target_organization_id uuid;
  remaining integer;
begin
  if requested_quantity is null or requested_quantity not between 1 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_EXTRA_QUANTITY';
  end if;

  -- La RPC anterior valida rol, organizacion y que la solicitud siga pendiente.
  saved_request := public.update_company_extra_request(
    target_request_id, target_menu_option_id, beneficiary_name, request_reason,
    selected_side, include_bread, include_tea
  );

  select service_day.menu_week_id, menu_week.organization_id
  into target_week_id, target_organization_id
  from public.service_days as service_day
  join public.menu_weeks as menu_week on menu_week.id = service_day.menu_week_id
  where service_day.id = saved_request.service_day_id;
  select availability.remaining_quantity into remaining
  from public.get_menu_option_availability(target_week_id) as availability
  where availability.menu_option_id = target_menu_option_id;
  if remaining is not null and requested_quantity > remaining then
    raise exception using errcode = 'P0001', message = 'MENU_OPTION_CAPACITY_EXCEEDED';
  end if;

  update public.exception_requests
  set quantity = requested_quantity
  where id = saved_request.id
  returning * into saved_request;
  insert into public.audit_events (
    organization_id, actor_id, entity_type, entity_id, action, metadata
  ) values (
    target_organization_id, auth.uid(), 'exception_request', saved_request.id,
    'company.extra_quantity_corrected', jsonb_build_object('quantity', requested_quantity)
  );
  return saved_request;
end;
$$;

-- La aprobacion conserva cantidad; el guard de cupos de orders la valida
-- con bloqueo de fila. Si falla, toda la aprobacion vuelve a pendiente.
do $migration$
declare
  original_definition text := pg_get_functiondef(
    'public.resolve_exception_request(uuid,public.request_status,text)'::regprocedure
  );
  pattern text := 'saved_request\.beneficiary_label,[[:space:]]*1,[[:space:]]*saved_request\.side';
  matches_found integer;
begin
  select count(*) into matches_found from regexp_matches(original_definition, pattern, 'g');
  if matches_found <> 1 then
    raise exception 'No se encontro una unica cantidad fija en la aprobacion de extras';
  end if;
  execute regexp_replace(
    original_definition, pattern,
    'saved_request.beneficiary_label, saved_request.quantity, saved_request.side'
  );
end;
$migration$;

-- Un pedido aprobado y su solicitud deben conservar la misma cantidad.
create or replace function private.enforce_linked_extra_quantity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_request_id uuid;
  request_quantity integer;
  order_quantity integer;
begin
  if tg_table_name = 'orders' then
    if tg_op = 'DELETE' then
      linked_request_id := old.exception_request_id;
    elsif tg_op = 'INSERT' then
      linked_request_id := new.exception_request_id;
    else
      linked_request_id := coalesce(new.exception_request_id, old.exception_request_id);
    end if;
  elsif tg_op = 'DELETE' then
    linked_request_id := old.id;
  else
    linked_request_id := new.id;
  end if;

  if linked_request_id is null then return null; end if;
  select extra_request.quantity, order_record.quantity
  into request_quantity, order_quantity
  from public.exception_requests as extra_request
  left join public.orders as order_record
    on order_record.exception_request_id = extra_request.id
  where extra_request.id = linked_request_id
    and extra_request.status = 'approved';
  if found and (order_quantity is null or order_quantity <> request_quantity) then
    raise exception using errcode = 'P0001', message = 'EXTRA_QUANTITY_MISMATCH';
  end if;
  return null;
end;
$$;

create constraint trigger orders_extra_quantity_match
after insert or update or delete on public.orders
deferrable initially deferred
for each row execute function private.enforce_linked_extra_quantity();
create constraint trigger requests_extra_quantity_match
after insert or update or delete on public.exception_requests
deferrable initially deferred
for each row execute function private.enforce_linked_extra_quantity();

revoke all on function public.create_extra_order_with_quantity(uuid,uuid,text,integer,public.side_choice,boolean,boolean) from public, anon;
revoke all on function public.request_exceptional_order_with_quantity(uuid,uuid,text,text,integer,public.side_choice,boolean,boolean) from public, anon;
revoke all on function public.update_company_operational_order_with_quantity(uuid,uuid,text,integer,integer,public.side_choice,boolean,boolean) from public, anon;
revoke all on function public.update_company_extra_request_with_quantity(uuid,uuid,text,text,integer,public.side_choice,boolean,boolean) from public, anon;
revoke all on function private.enforce_linked_extra_quantity() from public, anon, authenticated;
grant execute on function public.create_extra_order_with_quantity(uuid,uuid,text,integer,public.side_choice,boolean,boolean) to authenticated;
grant execute on function public.request_exceptional_order_with_quantity(uuid,uuid,text,text,integer,public.side_choice,boolean,boolean) to authenticated;
grant execute on function public.update_company_operational_order_with_quantity(uuid,uuid,text,integer,integer,public.side_choice,boolean,boolean) to authenticated;
grant execute on function public.update_company_extra_request_with_quantity(uuid,uuid,text,text,integer,public.side_choice,boolean,boolean) to authenticated;

commit;
