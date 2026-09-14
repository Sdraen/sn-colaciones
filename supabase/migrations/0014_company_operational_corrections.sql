-- Correcciones operacionales de Securitas: editar o eliminar capacitaciones y
-- colaciones extra antes de que la entrega del día haya finalizado.

begin;

create or replace function private.enforce_exception_request_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_day public.service_days%rowtype;
  target_week_published_at timestamptz;
  target_organization_id uuid;
  target_timezone text;
  is_company_correction boolean := false;
begin
  select * into target_day
  from public.service_days as service_day
  where service_day.id = new.service_day_id;

  select menu_week.published_at, menu_week.organization_id, organization.timezone
  into target_week_published_at, target_organization_id, target_timezone
  from public.service_days as service_day
  join public.menu_weeks as menu_week on menu_week.id = service_day.menu_week_id
  join public.organizations as organization on organization.id = menu_week.organization_id
  where service_day.id = new.service_day_id;

  if target_day.id is null or target_day.disabled then
    raise exception using errcode = 'P0001', message = 'SERVICE_DAY_DISABLED';
  end if;
  if target_week_published_at is null then
    raise exception using errcode = 'P0001', message = 'MENU_WEEK_NOT_PUBLISHED';
  end if;
  if new.bread = new.tea then
    raise exception using errcode = '22023', message = 'BREAD_OR_TEA_REQUIRED';
  end if;
  if not exists (
    select 1 from public.menu_options as menu_option
    where menu_option.id = new.menu_option_id
      and menu_option.service_day_id = new.service_day_id
      and menu_option.visible
      and menu_option.available_for_workers
  ) then
    raise exception using errcode = 'P0001', message = 'MENU_OPTION_NOT_AVAILABLE';
  end if;

  if tg_op = 'UPDATE' then
    is_company_correction :=
      old.status = new.status
      and (select private.current_user_has_role('company_admin'));
  end if;

  if is_company_correction then
    if target_day.service_date < (now() at time zone target_timezone)::date then
      raise exception using errcode = 'P0001', message = 'OPERATION_HISTORY_LOCKED';
    end if;
    if exists (
      select 1 from public.service_delivery_tracking as tracking
      where tracking.service_day_id = new.service_day_id
        and tracking.delivered_at is not null
    ) then
      raise exception using errcode = 'P0001', message = 'DELIVERY_ALREADY_COMPLETED';
    end if;
  elsif not (now() >= target_day.same_day_closes_at and now() < target_day.delivery_closes_at) then
    raise exception using errcode = 'P0001', message = 'EXTRA_APPROVAL_WINDOW_CLOSED';
  end if;

  return new;
end;
$$;

create or replace function private.enforce_order_business_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_day public.service_days%rowtype;
  target_organization_id uuid;
  target_week_published_at timestamptz;
  organization_timezone text;
  organization_now timestamp;
  option_capacity integer;
  already_confirmed integer;
  is_company_correction boolean := false;
begin
  select service_day.* into target_day
  from public.service_days as service_day
  where service_day.id = new.service_day_id;

  if target_day.id is null or target_day.disabled then
    raise exception using errcode = 'P0001', message = 'SERVICE_DAY_DISABLED';
  end if;

  select menu_week.organization_id, menu_week.published_at, organization.timezone
  into target_organization_id, target_week_published_at, organization_timezone
  from public.menu_weeks as menu_week
  join public.organizations as organization on organization.id = menu_week.organization_id
  where menu_week.id = target_day.menu_week_id;

  organization_now := now() at time zone organization_timezone;

  if tg_op = 'UPDATE' then
    is_company_correction :=
      old.kind in ('training', 'extra', 'exceptional')
      and new.kind = old.kind
      and old.service_day_id = new.service_day_id
      and old.created_by = new.created_by
      and old.status = new.status
      and (select private.current_user_has_role('company_admin'));
  end if;

  if is_company_correction then
    if target_day.service_date < organization_now::date then
      raise exception using errcode = 'P0001', message = 'OPERATION_HISTORY_LOCKED';
    end if;
    if old.fulfilled_at is not null or exists (
      select 1 from public.service_delivery_tracking as tracking
      where tracking.service_day_id = new.service_day_id
        and tracking.delivered_at is not null
    ) then
      raise exception using errcode = 'P0001', message = 'DELIVERY_ALREADY_COMPLETED';
    end if;
  end if;

  if new.status = 'cancelled' then
    if tg_op = 'INSERT' then
      raise exception using errcode = '22023', message = 'INVALID_ORDER_STATUS';
    end if;
    if new.kind = 'regular' and now() > target_day.preorder_deadline then
      raise exception using errcode = 'P0001', message = 'ORDER_WINDOW_CLOSED';
    end if;
    new.fulfilled_at = null;
    return new;
  end if;

  if target_week_published_at is null then
    raise exception using errcode = 'P0001', message = 'MENU_WEEK_NOT_PUBLISHED';
  end if;
  if new.bread = new.tea then
    raise exception using errcode = '22023', message = 'BREAD_OR_TEA_REQUIRED';
  end if;

  select menu_option.capacity into option_capacity
  from public.menu_options as menu_option
  where menu_option.id = new.menu_option_id
    and menu_option.service_day_id = new.service_day_id
    and menu_option.visible;

  if not found then
    raise exception using errcode = 'P0001', message = 'MENU_OPTION_NOT_AVAILABLE';
  end if;

  case new.kind
    when 'regular' then
      if now() > target_day.preorder_deadline then
        raise exception using errcode = 'P0001', message = 'ORDER_WINDOW_CLOSED';
      end if;
      if not exists (
        select 1 from public.menu_options as worker_option
        where worker_option.id = new.menu_option_id
          and worker_option.available_for_workers
      ) then
        raise exception using errcode = 'P0001', message = 'MENU_OPTION_NOT_AVAILABLE';
      end if;
    when 'extra' then
      if not exists (
        select 1 from public.menu_options as extra_option
        where extra_option.id = new.menu_option_id
          and extra_option.available_for_workers
      ) then
        raise exception using errcode = 'P0001', message = 'MENU_OPTION_NOT_AVAILABLE';
      end if;
      if new.exception_request_id is null then
        if not is_company_correction
          and not (now() >= target_day.same_day_opens_at and now() < target_day.same_day_closes_at)
        then
          raise exception using errcode = 'P0001', message = 'EXTRA_WINDOW_CLOSED';
        end if;
      else
        if not is_company_correction
          and (now() < target_day.same_day_closes_at or now() > target_day.delivery_closes_at)
        then
          raise exception using errcode = 'P0001', message = 'EXTRA_APPROVAL_WINDOW_CLOSED';
        end if;
        if not exists (
          select 1 from public.exception_requests as extra_request
          where extra_request.id = new.exception_request_id
            and extra_request.service_day_id = new.service_day_id
            and extra_request.menu_option_id = new.menu_option_id
            and extra_request.status = 'approved'
            and extra_request.beneficiary_label = new.beneficiary_label
            and extra_request.side = new.side
            and extra_request.bread = new.bread
            and extra_request.tea = new.tea
        ) then
          raise exception using errcode = 'P0001', message = 'EXTRA_NOT_APPROVED';
        end if;
      end if;
    when 'exceptional' then
      if not is_company_correction
        and (now() < target_day.same_day_closes_at or now() > target_day.delivery_closes_at)
      then
        raise exception using errcode = 'P0001', message = 'EXTRA_APPROVAL_WINDOW_CLOSED';
      end if;
    when 'training' then
      if not is_company_correction
        and (
          target_day.service_date < organization_now::date
          or (
            organization_now::time > time '09:00'
            and organization_now::time < time '14:00'
          )
        )
      then
        raise exception using errcode = 'P0001', message = 'TRAINING_WINDOW_CLOSED';
      end if;
      if extract(isodow from target_day.service_date) not between 1 and 5 then
        raise exception using errcode = 'P0001', message = 'TRAINING_DATE_BLOCKED';
      end if;
      if not exists (
        select 1 from public.menu_options as training_option
        where training_option.id = new.menu_option_id
          and training_option.service_day_id = new.service_day_id
          and training_option.visible
          and training_option.available_for_training
      ) then
        raise exception using errcode = 'P0001', message = 'TRAINING_MENU_REQUIRED';
      end if;
      if exists (
        select 1 from public.service_calendar_blocks as calendar_block
        where calendar_block.organization_id = target_organization_id
          and target_day.service_date between calendar_block.starts_on and calendar_block.ends_on
          and calendar_block.kind in ('holiday', 'vacation', 'no_service')
      ) then
        raise exception using errcode = 'P0001', message = 'TRAINING_DATE_BLOCKED';
      end if;
      if not exists (
        select 1 from public.training_sessions as training_session
        where training_session.id = new.training_session_id
          and training_session.organization_id = target_organization_id
          and training_session.service_date = target_day.service_date
          and training_session.expected_attendees = new.quantity
      ) then
        raise exception using errcode = 'P0001', message = 'TRAINING_SESSION_MISMATCH';
      end if;
  end case;

  if new.kind in ('training', 'extra', 'exceptional') and option_capacity is not null then
    select coalesce(sum(order_record.quantity), 0)::integer into already_confirmed
    from public.orders as order_record
    where order_record.service_day_id = new.service_day_id
      and order_record.menu_option_id = new.menu_option_id
      and order_record.status = 'confirmed'
      and order_record.id <> new.id;

    if already_confirmed + new.quantity > option_capacity then
      raise exception using errcode = 'P0001', message = 'MENU_OPTION_CAPACITY_EXCEEDED';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.update_company_operational_order(
  target_order_id uuid,
  target_menu_option_id uuid,
  record_name text,
  attendee_count integer,
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
  actor_id uuid := auth.uid();
  actor_organization_id uuid;
  target_order public.orders%rowtype;
  target_organization_id uuid;
  target_service_date date;
  target_timezone text;
  saved_order public.orders%rowtype;
begin
  select profile.organization_id into actor_organization_id
  from public.profiles as profile
  where profile.id = actor_id and profile.active and profile.role = 'company_admin';

  if actor_organization_id is null then
    raise exception using errcode = 'P0001', message = 'COMPANY_ROLE_REQUIRED';
  end if;
  if nullif(btrim(record_name), '') is null or include_bread = include_tea then
    raise exception using errcode = '22023', message = 'INVALID_OPERATION_CORRECTION';
  end if;

  select * into target_order
  from public.orders as order_record
  where order_record.id = target_order_id
  for update;

  if target_order.id is null or target_order.kind not in ('training', 'extra', 'exceptional') then
    raise exception using errcode = 'P0001', message = 'OPERATION_NOT_FOUND';
  end if;

  select menu_week.organization_id, service_day.service_date, organization.timezone
  into target_organization_id, target_service_date, target_timezone
  from public.service_days as service_day
  join public.menu_weeks as menu_week on menu_week.id = service_day.menu_week_id
  join public.organizations as organization on organization.id = menu_week.organization_id
  where service_day.id = target_order.service_day_id;

  if target_organization_id <> actor_organization_id then
    raise exception using errcode = 'P0001', message = 'OPERATION_NOT_FOUND';
  end if;
  if target_service_date < (now() at time zone target_timezone)::date then
    raise exception using errcode = 'P0001', message = 'OPERATION_HISTORY_LOCKED';
  end if;
  if target_order.status <> 'confirmed'
    or target_order.fulfilled_at is not null
    or exists (
      select 1 from public.service_delivery_tracking as tracking
      where tracking.service_day_id = target_order.service_day_id
        and tracking.delivered_at is not null
    )
  then
    raise exception using errcode = 'P0001', message = 'DELIVERY_ALREADY_COMPLETED';
  end if;

  if target_order.kind = 'training' then
    if attendee_count is null or attendee_count < 1 or attendee_count > 500 then
      raise exception using errcode = '22023', message = 'INVALID_ATTENDEE_COUNT';
    end if;
    update public.training_sessions
    set name = btrim(record_name), expected_attendees = attendee_count
    where id = target_order.training_session_id;
  elsif attendee_count is not null then
    raise exception using errcode = '22023', message = 'INVALID_ATTENDEE_COUNT';
  end if;

  if target_order.exception_request_id is not null then
    update public.exception_requests
    set menu_option_id = target_menu_option_id,
        beneficiary_label = btrim(record_name),
        side = selected_side,
        bread = include_bread,
        tea = include_tea
    where id = target_order.exception_request_id;
  end if;

  update public.orders
  set menu_option_id = target_menu_option_id,
      beneficiary_label = btrim(record_name),
      quantity = case when target_order.kind = 'training' then attendee_count else 1 end,
      side = selected_side,
      bread = include_bread,
      tea = include_tea
  where id = target_order_id
  returning * into saved_order;

  insert into public.audit_events (
    organization_id, actor_id, entity_type, entity_id, action, metadata
  ) values (
    target_organization_id,
    actor_id,
    'order',
    target_order_id,
    'company.operation_corrected',
    jsonb_build_object('before', to_jsonb(target_order), 'after', to_jsonb(saved_order))
  );

  return saved_order;
end;
$$;

create or replace function public.delete_company_operational_order(target_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_organization_id uuid;
  target_order public.orders%rowtype;
  target_organization_id uuid;
  target_service_date date;
  target_timezone text;
begin
  select profile.organization_id into actor_organization_id
  from public.profiles as profile
  where profile.id = actor_id and profile.active and profile.role = 'company_admin';
  if actor_organization_id is null then
    raise exception using errcode = 'P0001', message = 'COMPANY_ROLE_REQUIRED';
  end if;

  select * into target_order
  from public.orders as order_record
  where order_record.id = target_order_id
  for update;
  if target_order.id is null or target_order.kind not in ('training', 'extra', 'exceptional') then
    raise exception using errcode = 'P0001', message = 'OPERATION_NOT_FOUND';
  end if;

  select menu_week.organization_id, service_day.service_date, organization.timezone
  into target_organization_id, target_service_date, target_timezone
  from public.service_days as service_day
  join public.menu_weeks as menu_week on menu_week.id = service_day.menu_week_id
  join public.organizations as organization on organization.id = menu_week.organization_id
  where service_day.id = target_order.service_day_id;

  if target_organization_id <> actor_organization_id then
    raise exception using errcode = 'P0001', message = 'OPERATION_NOT_FOUND';
  end if;
  if target_service_date < (now() at time zone target_timezone)::date then
    raise exception using errcode = 'P0001', message = 'OPERATION_HISTORY_LOCKED';
  end if;
  if target_order.fulfilled_at is not null or exists (
    select 1 from public.service_delivery_tracking as tracking
    where tracking.service_day_id = target_order.service_day_id
      and tracking.delivered_at is not null
  ) then
    raise exception using errcode = 'P0001', message = 'DELIVERY_ALREADY_COMPLETED';
  end if;

  delete from public.orders where id = target_order.id;
  if target_order.training_session_id is not null then
    delete from public.training_sessions where id = target_order.training_session_id;
  end if;
  if target_order.exception_request_id is not null then
    delete from public.exception_requests where id = target_order.exception_request_id;
  end if;

  insert into public.audit_events (
    organization_id, actor_id, entity_type, entity_id, action, metadata
  ) values (
    target_organization_id,
    actor_id,
    'order',
    target_order_id,
    'company.operation_deleted',
    jsonb_build_object('deleted', to_jsonb(target_order))
  );

  return jsonb_build_object(
    'orderId', target_order.id,
    'trainingSessionId', target_order.training_session_id,
    'extraRequestId', target_order.exception_request_id
  );
end;
$$;

create or replace function public.update_company_extra_request(
  target_request_id uuid,
  target_menu_option_id uuid,
  beneficiary_name text,
  request_reason text,
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
  actor_id uuid := auth.uid();
  actor_organization_id uuid;
  target_request public.exception_requests%rowtype;
  target_organization_id uuid;
  target_service_date date;
  target_timezone text;
  saved_request public.exception_requests%rowtype;
begin
  select profile.organization_id into actor_organization_id
  from public.profiles as profile
  where profile.id = actor_id and profile.active and profile.role = 'company_admin';
  if actor_organization_id is null then
    raise exception using errcode = 'P0001', message = 'COMPANY_ROLE_REQUIRED';
  end if;
  if nullif(btrim(beneficiary_name), '') is null
    or nullif(btrim(request_reason), '') is null
    or include_bread = include_tea
  then
    raise exception using errcode = '22023', message = 'INVALID_OPERATION_CORRECTION';
  end if;

  select * into target_request
  from public.exception_requests as extra_request
  where extra_request.id = target_request_id
  for update;
  if target_request.id is null or target_request.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'EXTRA_REQUEST_LOCKED';
  end if;

  select menu_week.organization_id, service_day.service_date, organization.timezone
  into target_organization_id, target_service_date, target_timezone
  from public.service_days as service_day
  join public.menu_weeks as menu_week on menu_week.id = service_day.menu_week_id
  join public.organizations as organization on organization.id = menu_week.organization_id
  where service_day.id = target_request.service_day_id;

  if target_organization_id <> actor_organization_id then
    raise exception using errcode = 'P0001', message = 'EXTRA_REQUEST_NOT_FOUND';
  end if;
  if target_service_date < (now() at time zone target_timezone)::date then
    raise exception using errcode = 'P0001', message = 'OPERATION_HISTORY_LOCKED';
  end if;
  if exists (
    select 1 from public.service_delivery_tracking as tracking
    where tracking.service_day_id = target_request.service_day_id
      and tracking.delivered_at is not null
  ) then
    raise exception using errcode = 'P0001', message = 'DELIVERY_ALREADY_COMPLETED';
  end if;

  update public.exception_requests
  set menu_option_id = target_menu_option_id,
      beneficiary_label = btrim(beneficiary_name),
      reason = btrim(request_reason),
      side = selected_side,
      bread = include_bread,
      tea = include_tea
  where id = target_request_id
  returning * into saved_request;

  insert into public.audit_events (
    organization_id, actor_id, entity_type, entity_id, action, metadata
  ) values (
    target_organization_id,
    actor_id,
    'exception_request',
    target_request_id,
    'company.extra_request_corrected',
    jsonb_build_object('before', to_jsonb(target_request), 'after', to_jsonb(saved_request))
  );

  return saved_request;
end;
$$;

create or replace function public.delete_company_extra_request(target_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_organization_id uuid;
  target_request public.exception_requests%rowtype;
  linked_order public.orders%rowtype;
  target_organization_id uuid;
  target_service_date date;
  target_timezone text;
begin
  select profile.organization_id into actor_organization_id
  from public.profiles as profile
  where profile.id = actor_id and profile.active and profile.role = 'company_admin';
  if actor_organization_id is null then
    raise exception using errcode = 'P0001', message = 'COMPANY_ROLE_REQUIRED';
  end if;

  select * into target_request
  from public.exception_requests as extra_request
  where extra_request.id = target_request_id
  for update;
  if target_request.id is null then
    raise exception using errcode = 'P0001', message = 'EXTRA_REQUEST_NOT_FOUND';
  end if;

  select menu_week.organization_id, service_day.service_date, organization.timezone
  into target_organization_id, target_service_date, target_timezone
  from public.service_days as service_day
  join public.menu_weeks as menu_week on menu_week.id = service_day.menu_week_id
  join public.organizations as organization on organization.id = menu_week.organization_id
  where service_day.id = target_request.service_day_id;

  if target_organization_id <> actor_organization_id then
    raise exception using errcode = 'P0001', message = 'EXTRA_REQUEST_NOT_FOUND';
  end if;
  if target_service_date < (now() at time zone target_timezone)::date then
    raise exception using errcode = 'P0001', message = 'OPERATION_HISTORY_LOCKED';
  end if;
  if exists (
    select 1 from public.service_delivery_tracking as tracking
    where tracking.service_day_id = target_request.service_day_id
      and tracking.delivered_at is not null
  ) then
    raise exception using errcode = 'P0001', message = 'DELIVERY_ALREADY_COMPLETED';
  end if;

  select * into linked_order
  from public.orders as order_record
  where order_record.exception_request_id = target_request_id
  for update;
  if linked_order.fulfilled_at is not null then
    raise exception using errcode = 'P0001', message = 'DELIVERY_ALREADY_COMPLETED';
  end if;

  delete from public.orders where exception_request_id = target_request_id;
  delete from public.exception_requests where id = target_request_id;

  insert into public.audit_events (
    organization_id, actor_id, entity_type, entity_id, action, metadata
  ) values (
    target_organization_id,
    actor_id,
    'exception_request',
    target_request_id,
    'company.extra_request_deleted',
    jsonb_build_object('deleted', to_jsonb(target_request), 'linked_order_id', linked_order.id)
  );

  return jsonb_build_object(
    'requestId', target_request.id,
    'orderId', linked_order.id
  );
end;
$$;

revoke all on function public.update_company_operational_order(uuid, uuid, text, integer, public.side_choice, boolean, boolean) from public, anon;
revoke all on function public.delete_company_operational_order(uuid) from public, anon;
revoke all on function public.update_company_extra_request(uuid, uuid, text, text, public.side_choice, boolean, boolean) from public, anon;
revoke all on function public.delete_company_extra_request(uuid) from public, anon;

grant execute on function public.update_company_operational_order(uuid, uuid, text, integer, public.side_choice, boolean, boolean) to authenticated;
grant execute on function public.delete_company_operational_order(uuid) to authenticated;
grant execute on function public.update_company_extra_request(uuid, uuid, text, text, public.side_choice, boolean, boolean) to authenticated;
grant execute on function public.delete_company_extra_request(uuid) to authenticated;

-- Las bajas operacionales deben pasar por las RPC para respetar el bloqueo de
-- historial y eliminar correctamente los registros relacionados.
revoke delete on table public.orders from authenticated;

comment on function public.update_company_operational_order(uuid, uuid, text, integer, public.side_choice, boolean, boolean) is
  'Permite a Securitas corregir una capacitación o colación extra antes de terminar la entrega.';
comment on function public.delete_company_operational_order(uuid) is
  'Elimina atómicamente una capacitación o colación extra y sus registros vinculados.';
comment on function public.update_company_extra_request(uuid, uuid, text, text, public.side_choice, boolean, boolean) is
  'Permite a Securitas corregir una solicitud tardía mientras siga pendiente.';
comment on function public.delete_company_extra_request(uuid) is
  'Elimina una solicitud tardía y, si existe, su pedido vinculado antes de la entrega.';

commit;
