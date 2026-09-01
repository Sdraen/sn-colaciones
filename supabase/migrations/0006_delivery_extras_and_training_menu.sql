-- Operación diaria definitiva: extras unificados, cierre a las 13:00,
-- menú de capacitación separado y acceso de sólo lectura para despacho.
-- Ejecutar después de 0005_agreed_operational_corrections.sql.

alter type public.app_role add value if not exists 'delivery';

begin;

alter table public.menu_options
  add column if not exists available_for_workers boolean not null default true,
  add column if not exists dessert text,
  add column if not exists beverage text,
  add column if not exists notes text;

comment on column public.menu_options.available_for_workers is
  'Permite separar el menú semanal de trabajadores del menú opcional de capacitaciones.';

update public.service_days as service_day
set delivery_closes_at = (
  service_day.service_date + time '13:00'
) at time zone organization.timezone
from public.menu_weeks as menu_week
join public.organizations as organization on organization.id = menu_week.organization_id
where service_day.menu_week_id = menu_week.id;

create or replace function private.enforce_exception_request_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_day public.service_days%rowtype;
  target_week_published_at timestamptz;
begin
  select service_day.* into target_day
  from public.service_days as service_day where service_day.id = new.service_day_id;
  if target_day.id is null or target_day.disabled then
    raise exception using errcode = 'P0001', message = 'SERVICE_DAY_DISABLED';
  end if;
  select menu_week.published_at into target_week_published_at
  from public.menu_weeks as menu_week where menu_week.id = target_day.menu_week_id;
  if target_week_published_at is null then
    raise exception using errcode = 'P0001', message = 'MENU_WEEK_NOT_PUBLISHED';
  end if;
  if new.bread = new.tea then
    raise exception using errcode = '22023', message = 'BREAD_OR_TEA_REQUIRED';
  end if;
  if not (now() >= target_day.same_day_closes_at and now() < target_day.delivery_closes_at) then
    raise exception using errcode = 'P0001', message = 'EXTRA_APPROVAL_WINDOW_CLOSED';
  end if;
  if not exists (
    select 1 from public.menu_options as menu_option
    where menu_option.id = new.menu_option_id
      and menu_option.service_day_id = new.service_day_id
      and menu_option.visible and menu_option.available_for_workers
  ) then
    raise exception using errcode = 'P0001', message = 'MENU_OPTION_NOT_AVAILABLE';
  end if;
  return new;
end;
$$;

-- Un pedido de tipo extra puede ser inmediato (08:00-11:00) o provenir de
-- una solicitud aprobada (11:00-13:00). El tipo exceptional se conserva sólo
-- para poder leer historial creado por versiones anteriores.
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
      if organization_now::date <> target_day.service_date
        or organization_now::time > time '09:00' then
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

create or replace function public.resolve_exception_request(
  target_exception_id uuid,
  decision public.request_status,
  rejection_note text default null
)
returns public.exception_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_request public.exception_requests%rowtype;
  saved_request public.exception_requests%rowtype;
begin
  if actor_id is null then raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED'; end if;
  if not (select private.current_user_has_role('provider_admin')) then
    raise exception using errcode = 'P0001', message = 'PROVIDER_ROLE_REQUIRED';
  end if;
  if decision not in ('approved', 'rejected') then
    raise exception using errcode = '22023', message = 'INVALID_EXTRA_DECISION';
  end if;
  if decision = 'rejected' and nullif(btrim(rejection_note), '') is null then
    raise exception using errcode = '22023', message = 'REJECTION_NOTE_REQUIRED';
  end if;

  select extra_request.* into target_request
  from public.exception_requests as extra_request
  join public.service_days as service_day on service_day.id = extra_request.service_day_id
  join public.menu_weeks as menu_week on menu_week.id = service_day.menu_week_id
  join public.profiles as profile on profile.organization_id = menu_week.organization_id
  where extra_request.id = target_exception_id
    and profile.id = actor_id and profile.role = 'provider_admin' and profile.active
  for update of extra_request;

  if target_request.id is null then raise exception using errcode = 'P0001', message = 'EXTRA_REQUEST_NOT_FOUND'; end if;
  if target_request.status <> 'pending' then raise exception using errcode = 'P0001', message = 'EXTRA_ALREADY_RESOLVED'; end if;

  update public.exception_requests
  set status = decision, resolved_by = actor_id,
      resolution_note = nullif(btrim(rejection_note), ''), resolved_at = now()
  where id = target_exception_id
  returning * into saved_request;

  if decision = 'approved' then
    insert into public.orders (
      service_day_id, menu_option_id, exception_request_id, created_by, kind,
      beneficiary_label, quantity, side, bread, tea
    ) values (
      saved_request.service_day_id, saved_request.menu_option_id, saved_request.id,
      actor_id, 'extra', saved_request.beneficiary_label, 1, saved_request.side,
      saved_request.bread, saved_request.tea
    );
  end if;

  return saved_request;
end;
$$;

create or replace function public.save_menu_week_draft(target_starts_on date, week_days jsonb)
returns public.menu_weeks
language plpgsql
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_organization_id uuid;
  organization_timezone text;
  expected_next_monday date;
  saved_week public.menu_weeks%rowtype;
  saved_day_id uuid;
  day_input record;
  option_input record;
begin
  if actor_id is null then raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED'; end if;
  if not (select private.current_user_has_role('provider_admin')) then
    raise exception using errcode = 'P0001', message = 'PROVIDER_ROLE_REQUIRED';
  end if;
  if extract(isodow from target_starts_on) <> 1 then
    raise exception using errcode = '22023', message = 'WEEK_MUST_START_MONDAY';
  end if;
  if jsonb_typeof(week_days) is distinct from 'array' or jsonb_array_length(week_days) <> 7 then
    raise exception using errcode = '22023', message = 'INVALID_WEEK_DAYS';
  end if;

  select organization.id, organization.timezone into target_organization_id, organization_timezone
  from public.profiles as profile
  join public.organizations as organization on organization.id = profile.organization_id
  where profile.id = actor_id and profile.active and profile.role = 'provider_admin';

  expected_next_monday := date_trunc('week', now() at time zone organization_timezone)::date + 7;
  if target_starts_on <> expected_next_monday then
    raise exception using errcode = 'P0001', message = 'MENU_WEEK_MUST_BE_NEXT';
  end if;

  select menu_week.* into saved_week
  from public.menu_weeks as menu_week
  where menu_week.organization_id = target_organization_id and menu_week.starts_on = target_starts_on
  for update;

  if saved_week.id is null then
    insert into public.menu_weeks (organization_id, starts_on, created_by)
    values (target_organization_id, target_starts_on, actor_id) returning * into saved_week;
  else
    if saved_week.published_at is not null then raise exception using errcode = 'P0001', message = 'MENU_WEEK_PUBLISHED'; end if;
    if exists (
      select 1 from public.service_days as service_day
      where service_day.menu_week_id = saved_week.id and (
        exists (select 1 from public.orders as order_record where order_record.service_day_id = service_day.id)
        or exists (select 1 from public.exception_requests as extra_request where extra_request.service_day_id = service_day.id)
      )
    ) then raise exception using errcode = 'P0001', message = 'MENU_WEEK_LOCKED'; end if;
    delete from public.service_days where menu_week_id = saved_week.id;
  end if;

  for day_input in
    select * from jsonb_to_recordset(week_days) as day_record(service_date date, disabled boolean, options jsonb)
  loop
    if day_input.service_date < target_starts_on or day_input.service_date > target_starts_on + 6 then
      raise exception using errcode = '22023', message = 'INVALID_WEEK_DAYS';
    end if;
    if jsonb_typeof(day_input.options) is distinct from 'array' then
      raise exception using errcode = '22023', message = 'MENU_DAY_WITHOUT_OPTIONS';
    end if;
    if not coalesce(day_input.disabled, false) and not exists (
      select 1 from jsonb_array_elements(day_input.options) as option_value
      where coalesce((option_value->>'available_for_workers')::boolean, true)
    ) then raise exception using errcode = '22023', message = 'MENU_DAY_WITHOUT_OPTIONS'; end if;

    insert into public.service_days (
      menu_week_id, service_date, phase, preorder_deadline, same_day_opens_at,
      same_day_closes_at, delivery_closes_at, disabled
    ) values (
      saved_week.id, day_input.service_date, 'draft',
      ((day_input.service_date - 1) + time '22:00') at time zone organization_timezone,
      (day_input.service_date + time '08:00') at time zone organization_timezone,
      (day_input.service_date + time '11:00') at time zone organization_timezone,
      (day_input.service_date + time '13:00') at time zone organization_timezone,
      coalesce(day_input.disabled, false)
    ) returning id into saved_day_id;

    for option_input in
      select * from jsonb_to_recordset(day_input.options) as option_record(
        category text, label text, description text, dessert text, beverage text,
        notes text, capacity integer, visible boolean, training_menu boolean,
        available_for_workers boolean, sort_order integer
      )
    loop
      if nullif(btrim(option_input.label), '') is null
        or nullif(btrim(option_input.description), '') is null
        or option_input.capacity < 0 or option_input.capacity > 10000 then
        raise exception using errcode = '22023', message = 'INVALID_MENU_OPTION';
      end if;
      insert into public.menu_options (
        service_day_id, category, label, description, dessert, beverage, notes,
        capacity, visible, available_for_training, available_for_workers, sort_order
      ) values (
        saved_day_id, option_input.category::public.menu_category, btrim(option_input.label),
        btrim(option_input.description), nullif(btrim(option_input.dessert), ''),
        nullif(btrim(option_input.beverage), ''), nullif(btrim(option_input.notes), ''),
        option_input.capacity, coalesce(option_input.visible, true),
        coalesce(option_input.training_menu, false),
        coalesce(option_input.available_for_workers, true), coalesce(option_input.sort_order, 0)
      );
    end loop;
  end loop;
  return saved_week;
end;
$$;

create or replace function private.notify_exception_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization_id uuid;
begin
  select menu_week.organization_id into target_organization_id
  from public.service_days as service_day
  join public.menu_weeks as menu_week on menu_week.id = service_day.menu_week_id
  where service_day.id = new.service_day_id;

  if tg_op = 'INSERT' then
    insert into public.notifications (
      organization_id, recipient_profile_id, channel, event_type, title, body,
      related_entity_type, related_entity_id, delivered_at
    )
    select target_organization_id, profile.id, delivery.channel,
      'extra_requested', 'Nueva solicitud de colación extra',
      new.beneficiary_label || ' requiere una decisión de la proveedora.',
      'exception_request', new.id, delivery.delivered_at
    from public.profiles as profile
    cross join (values ('in_app'::text, now()), ('email'::text, null::timestamptz))
      as delivery(channel, delivered_at)
    where profile.organization_id = target_organization_id
      and profile.role = 'provider_admin' and profile.active;
  elsif old.status = 'pending' and new.status in ('approved', 'rejected') then
    insert into public.notifications (
      organization_id, recipient_profile_id, channel, event_type, title, body,
      related_entity_type, related_entity_id, delivered_at
    )
    select target_organization_id, new.requested_by, delivery.channel,
      case when new.status = 'approved' then 'extra_approved' else 'extra_rejected' end,
      case when new.status = 'approved' then 'Colación extra aprobada' else 'Colación extra rechazada' end,
      case when new.status = 'approved'
        then new.beneficiary_label || ' fue incorporada a la producción.'
        else new.beneficiary_label || ': ' || new.resolution_note end,
      'exception_request', new.id, delivery.delivered_at
    from (values ('in_app'::text, now()), ('email'::text, null::timestamptz))
      as delivery(channel, delivered_at);
  end if;
  return new;
end;
$$;

-- Despacho puede consultar toda la información necesaria para el manifiesto,
-- sin permisos de escritura sobre pedidos, menús ni personas. La comparación
-- se hace como texto para que el nuevo valor del enum sea seguro en esta misma
-- migración.
create or replace function private.current_user_is_delivery()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.active
      and profile.role::text = 'delivery'
  )
$$;

revoke all on function private.current_user_is_delivery() from public;
grant execute on function private.current_user_is_delivery() to authenticated;

create policy "delivery can read organization diners"
on public.diners for select to authenticated
using (
  organization_id = (select private.current_organization_id())
  and (select private.current_user_is_delivery())
);

create policy "delivery can read training sessions"
on public.training_sessions for select to authenticated
using (
  organization_id = (select private.current_organization_id())
  and (select private.current_user_is_delivery())
);

create policy "delivery can read organization orders"
on public.orders for select to authenticated
using (
  (select private.service_day_belongs_to_current_org(service_day_id))
  and (select private.current_user_is_delivery())
);

create policy "delivery can read extra requests"
on public.exception_requests for select to authenticated
using (
  (select private.service_day_belongs_to_current_org(service_day_id))
  and (select private.current_user_is_delivery())
);

comment on function public.resolve_exception_request(uuid, public.request_status, text) is
  'Resuelve una solicitud tardía de colación extra entre las 11:00 y las 13:00.';

commit;
