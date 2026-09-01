begin;

-- Las capacitaciones pueden registrarse para el día actual o fechas futuras
-- hasta las 09:00 y nuevamente desde las 14:00, siempre en la zona horaria de
-- la organización. Se conservan los bloqueos de calendario y días sin servicio.
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
        where extra_option.id = new.menu_option_id and extra_option.available_for_workers
      ) then
        raise exception using errcode = 'P0001', message = 'MENU_OPTION_NOT_AVAILABLE';
      end if;
      if new.exception_request_id is null then
        if not (now() >= target_day.same_day_opens_at and now() < target_day.same_day_closes_at) then
          raise exception using errcode = 'P0001', message = 'EXTRA_WINDOW_CLOSED';
        end if;
      else
        if now() < target_day.same_day_closes_at or now() > target_day.delivery_closes_at then
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
      if now() < target_day.same_day_closes_at or now() > target_day.delivery_closes_at then
        raise exception using errcode = 'P0001', message = 'EXTRA_APPROVAL_WINDOW_CLOSED';
      end if;
    when 'training' then
      if target_day.service_date < organization_now::date
        or (
          organization_now::time > time '09:00'
          and organization_now::time < time '14:00'
        ) then
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

comment on function private.enforce_order_business_rules() is
  'Valida menú, cupos y ventanas; capacitaciones actuales o futuras hasta 09:00 y desde 14:00.';

commit;
