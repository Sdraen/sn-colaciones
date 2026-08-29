-- Operaciones atómicas y reglas defensivas utilizadas por la API Express.
-- Ejecutar después de 0003_confirmed_business_rules.sql.

begin;

-- La solicitud conserva la selección completa mientras espera la decisión de
-- la proveedora. Si se aprueba, estos valores se copian al pedido definitivo.
alter table public.exception_requests
  add column side public.side_choice not null default 'ninguno',
  add column bread boolean not null default false,
  add column tea boolean not null default false;

-- Resolver una excepcional debe pasar obligatoriamente por la RPC atómica:
-- se elimina la actualización directa que 0002 permitía a la proveedora.
drop policy "provider admins can resolve exceptions" on public.exception_requests;
revoke update on table public.exception_requests from authenticated;

create or replace function private.enforce_exception_request_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_day public.service_days%rowtype;
  target_week_published_at timestamptz;
begin
  select service_day.*
  into target_day
  from public.service_days as service_day
  where service_day.id = new.service_day_id;

  if target_day.id is null or target_day.disabled then
    raise exception using errcode = 'P0001', message = 'SERVICE_DAY_DISABLED';
  end if;

  select menu_week.published_at
  into target_week_published_at
  from public.menu_weeks as menu_week
  where menu_week.id = target_day.menu_week_id;

  if target_week_published_at is null then
    raise exception using errcode = 'P0001', message = 'MENU_WEEK_NOT_PUBLISHED';
  end if;

  if not (
    now() >= target_day.same_day_closes_at
    and now() < target_day.delivery_closes_at
  ) then
    raise exception using errcode = 'P0001', message = 'EXCEPTION_WINDOW_CLOSED';
  end if;

  if not exists (
    select 1
    from public.menu_options as menu_option
    where menu_option.id = new.menu_option_id
      and menu_option.service_day_id = new.service_day_id
      and menu_option.visible
  ) then
    raise exception using errcode = 'P0001', message = 'MENU_OPTION_NOT_AVAILABLE';
  end if;

  return new;
end;
$$;

create trigger exception_requests_enforce_business_rules
before insert on public.exception_requests
for each row execute function private.enforce_exception_request_rules();

create or replace function private.audit_exception_request_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization_id uuid;
begin
  select menu_week.organization_id
  into target_organization_id
  from public.service_days as service_day
  join public.menu_weeks as menu_week on menu_week.id = service_day.menu_week_id
  where service_day.id = new.service_day_id;

  insert into public.audit_events (
    organization_id,
    actor_id,
    entity_type,
    entity_id,
    action,
    metadata
  ) values (
    target_organization_id,
    auth.uid(),
    'exception_request',
    new.id,
    case when tg_op = 'INSERT' then 'exception.requested' else 'exception.resolved' end,
    jsonb_build_object(
      'status', new.status,
      'beneficiary_label', new.beneficiary_label,
      'resolution_note', new.resolution_note
    )
  );

  return new;
end;
$$;

create trigger exception_requests_write_audit_event
after insert or update of status on public.exception_requests
for each row execute function private.audit_exception_request_change();

create or replace function private.enforce_order_business_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_day public.service_days%rowtype;
  target_organization_id uuid;
  target_week_published_at timestamptz;
begin
  -- Las cancelaciones deben seguir siendo posibles mientras se confirma su regla final.
  if new.status = 'cancelled' then
    if tg_op = 'INSERT' then
      raise exception using errcode = '22023', message = 'INVALID_ORDER_STATUS';
    end if;
    new.fulfilled_at = null;
    return new;
  end if;

  select service_day.*
  into target_day
  from public.service_days as service_day
  where service_day.id = new.service_day_id;

  if target_day.id is null or target_day.disabled then
    raise exception using errcode = 'P0001', message = 'SERVICE_DAY_DISABLED';
  end if;

  select menu_week.organization_id, menu_week.published_at
  into target_organization_id, target_week_published_at
  from public.menu_weeks as menu_week
  where menu_week.id = target_day.menu_week_id;

  if target_week_published_at is null then
    raise exception using errcode = 'P0001', message = 'MENU_WEEK_NOT_PUBLISHED';
  end if;

  if not exists (
    select 1
    from public.menu_options as menu_option
    where menu_option.id = new.menu_option_id
      and menu_option.service_day_id = new.service_day_id
      and menu_option.visible
  ) then
    raise exception using errcode = 'P0001', message = 'MENU_OPTION_NOT_AVAILABLE';
  end if;

  case new.kind
    when 'regular' then
      if not (
        now() <= target_day.preorder_deadline
        or (
          now() >= target_day.same_day_opens_at
          and now() < target_day.same_day_closes_at
        )
      ) then
        raise exception using errcode = 'P0001', message = 'ORDER_WINDOW_CLOSED';
      end if;
    when 'extra' then
      if not (
        now() >= target_day.same_day_opens_at
        and now() < target_day.same_day_closes_at
      ) then
        raise exception using errcode = 'P0001', message = 'EXTRA_WINDOW_CLOSED';
      end if;
    when 'exceptional' then
      if now() < target_day.same_day_closes_at or now() >= target_day.delivery_closes_at then
        raise exception using errcode = 'P0001', message = 'EXCEPTION_WINDOW_CLOSED';
      end if;
      if new.exception_request_id is null or not exists (
        select 1
        from public.exception_requests as exception_request
        where exception_request.id = new.exception_request_id
          and exception_request.service_day_id = new.service_day_id
          and exception_request.menu_option_id = new.menu_option_id
          and exception_request.status = 'approved'
          and exception_request.beneficiary_label = new.beneficiary_label
          and exception_request.side = new.side
          and exception_request.bread = new.bread
          and exception_request.tea = new.tea
      ) then
        raise exception using errcode = 'P0001', message = 'EXCEPTION_NOT_APPROVED';
      end if;
    when 'training' then
      if extract(isodow from target_day.service_date) not between 1 and 5 then
        raise exception using errcode = 'P0001', message = 'TRAINING_DATE_BLOCKED';
      end if;
      if exists (
        select 1
        from public.service_calendar_blocks as calendar_block
        where calendar_block.organization_id = target_organization_id
          and target_day.service_date between calendar_block.starts_on and calendar_block.ends_on
          and calendar_block.kind in ('holiday', 'vacation', 'no_service')
      ) then
        raise exception using errcode = 'P0001', message = 'TRAINING_DATE_BLOCKED';
      end if;
      if not exists (
        select 1
        from public.training_sessions as training_session
        where training_session.id = new.training_session_id
          and training_session.organization_id = target_organization_id
          and training_session.service_date = target_day.service_date
          and training_session.expected_attendees = new.quantity
      ) then
        raise exception using errcode = 'P0001', message = 'TRAINING_SESSION_MISMATCH';
      end if;
  end case;

  return new;
end;
$$;

create trigger orders_enforce_business_rules
before insert or update of service_day_id, menu_option_id, training_session_id,
  exception_request_id, kind, beneficiary_label, quantity, side, bread, tea, status
on public.orders
for each row execute function private.enforce_order_business_rules();

create or replace function private.audit_order_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization_id uuid;
  audit_action text;
begin
  select menu_week.organization_id
  into target_organization_id
  from public.service_days as service_day
  join public.menu_weeks as menu_week on menu_week.id = service_day.menu_week_id
  where service_day.id = new.service_day_id;

  audit_action := case
    when tg_op = 'INSERT' then 'order.created'
    when new.status = 'cancelled' and old.status is distinct from new.status then 'order.cancelled'
    when new.fulfilled_at is distinct from old.fulfilled_at then 'order.fulfillment_changed'
    else 'order.updated'
  end;

  insert into public.audit_events (
    organization_id,
    actor_id,
    entity_type,
    entity_id,
    action,
    metadata
  ) values (
    target_organization_id,
    auth.uid(),
    'order',
    new.id,
    audit_action,
    jsonb_build_object(
      'kind', new.kind,
      'status', new.status,
      'quantity', new.quantity,
      'fulfilled_at', new.fulfilled_at
    )
  );

  return new;
end;
$$;

create trigger orders_write_audit_event
after insert or update on public.orders
for each row execute function private.audit_order_change();

create or replace function private.audit_menu_option_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization_id uuid;
begin
  select menu_week.organization_id
  into target_organization_id
  from public.service_days as service_day
  join public.menu_weeks as menu_week on menu_week.id = service_day.menu_week_id
  where service_day.id = new.service_day_id;

  insert into public.audit_events (
    organization_id,
    actor_id,
    entity_type,
    entity_id,
    action,
    metadata
  ) values (
    target_organization_id,
    auth.uid(),
    'menu_option',
    new.id,
    'menu_option.availability_changed',
    jsonb_build_object(
      'capacity', new.capacity,
      'visible', new.visible,
      'capacity_updated_at', new.capacity_updated_at
    )
  );

  return new;
end;
$$;

create trigger menu_options_write_availability_audit
after update of capacity, visible on public.menu_options
for each row
when (old.capacity is distinct from new.capacity or old.visible is distinct from new.visible)
execute function private.audit_menu_option_change();

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
    service_day_id,
    menu_option_id,
    diner_id,
    created_by,
    kind,
    quantity,
    side,
    bread,
    tea
  ) values (
    target_service_day_id,
    target_menu_option_id,
    target_diner.id,
    actor_id,
    'regular',
    1,
    selected_side,
    include_bread,
    include_tea
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

create or replace function public.cancel_regular_order(target_order_id uuid)
returns public.orders
language plpgsql
set search_path = ''
as $$
declare
  cancelled_order public.orders%rowtype;
begin
  update public.orders as order_record
  set status = 'cancelled', fulfilled_at = null
  from public.diners as diner
  where order_record.id = target_order_id
    and order_record.kind = 'regular'
    and order_record.diner_id = diner.id
    and diner.auth_user_id = auth.uid()
  returning order_record.* into cancelled_order;

  if cancelled_order.id is null then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  end if;

  return cancelled_order;
end;
$$;

create or replace function public.create_training_order(
  target_service_day_id uuid,
  target_menu_option_id uuid,
  training_name text,
  attendee_count integer,
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
  target_organization_id uuid;
  target_service_date date;
  saved_training public.training_sessions%rowtype;
  saved_order public.orders%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not (select private.current_user_has_role('company_admin')) then
    raise exception using errcode = 'P0001', message = 'COMPANY_ROLE_REQUIRED';
  end if;
  if attendee_count < 1 or attendee_count > 500 then
    raise exception using errcode = '22023', message = 'INVALID_ATTENDEE_COUNT';
  end if;
  if nullif(btrim(training_name), '') is null then
    raise exception using errcode = '22023', message = 'INVALID_TRAINING_NAME';
  end if;

  select menu_week.organization_id, service_day.service_date
  into target_organization_id, target_service_date
  from public.service_days as service_day
  join public.menu_weeks as menu_week on menu_week.id = service_day.menu_week_id
  where service_day.id = target_service_day_id;

  if target_organization_id is null
    or target_organization_id <> (select private.current_organization_id()) then
    raise exception using errcode = 'P0001', message = 'SERVICE_DAY_DISABLED';
  end if;

  insert into public.training_sessions (
    organization_id,
    name,
    service_date,
    expected_attendees,
    created_by
  ) values (
    target_organization_id,
    btrim(training_name),
    target_service_date,
    attendee_count,
    actor_id
  )
  returning * into saved_training;

  insert into public.orders (
    service_day_id,
    menu_option_id,
    training_session_id,
    created_by,
    kind,
    beneficiary_label,
    quantity,
    side,
    bread,
    tea
  ) values (
    target_service_day_id,
    target_menu_option_id,
    saved_training.id,
    actor_id,
    'training',
    btrim(training_name),
    attendee_count,
    selected_side,
    include_bread,
    include_tea
  )
  returning * into saved_order;

  return saved_order;
end;
$$;

create or replace function public.create_extra_order(
  target_service_day_id uuid,
  target_menu_option_id uuid,
  beneficiary_name text,
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
  saved_order public.orders%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not (select private.current_user_has_role('company_admin')) then
    raise exception using errcode = 'P0001', message = 'COMPANY_ROLE_REQUIRED';
  end if;
  if nullif(btrim(beneficiary_name), '') is null then
    raise exception using errcode = '22023', message = 'INVALID_BENEFICIARY_NAME';
  end if;

  insert into public.orders (
    service_day_id,
    menu_option_id,
    created_by,
    kind,
    beneficiary_label,
    quantity,
    side,
    bread,
    tea
  ) values (
    target_service_day_id,
    target_menu_option_id,
    actor_id,
    'extra',
    btrim(beneficiary_name),
    1,
    selected_side,
    include_bread,
    include_tea
  )
  returning * into saved_order;

  return saved_order;
end;
$$;

create or replace function public.request_exceptional_order(
  target_service_day_id uuid,
  target_menu_option_id uuid,
  beneficiary_name text,
  request_reason text,
  selected_side public.side_choice,
  include_bread boolean,
  include_tea boolean
)
returns public.exception_requests
language plpgsql
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  saved_request public.exception_requests%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not (select private.current_user_has_role('company_admin')) then
    raise exception using errcode = 'P0001', message = 'COMPANY_ROLE_REQUIRED';
  end if;
  if nullif(btrim(beneficiary_name), '') is null then
    raise exception using errcode = '22023', message = 'INVALID_BENEFICIARY_NAME';
  end if;
  if nullif(btrim(request_reason), '') is null then
    raise exception using errcode = '22023', message = 'INVALID_EXCEPTION_REASON';
  end if;

  insert into public.exception_requests (
    service_day_id,
    menu_option_id,
    beneficiary_label,
    reason,
    side,
    bread,
    tea,
    requested_by
  ) values (
    target_service_day_id,
    target_menu_option_id,
    btrim(beneficiary_name),
    btrim(request_reason),
    selected_side,
    include_bread,
    include_tea,
    actor_id
  )
  returning * into saved_request;

  return saved_request;
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
  if actor_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not (select private.current_user_has_role('provider_admin')) then
    raise exception using errcode = 'P0001', message = 'PROVIDER_ROLE_REQUIRED';
  end if;
  if decision not in ('approved', 'rejected') then
    raise exception using errcode = '22023', message = 'INVALID_EXCEPTION_DECISION';
  end if;
  if decision = 'rejected' and nullif(btrim(rejection_note), '') is null then
    raise exception using errcode = '22023', message = 'REJECTION_NOTE_REQUIRED';
  end if;

  select exception_request.*
  into target_request
  from public.exception_requests as exception_request
  join public.service_days as service_day on service_day.id = exception_request.service_day_id
  join public.menu_weeks as menu_week on menu_week.id = service_day.menu_week_id
  join public.profiles as profile on profile.organization_id = menu_week.organization_id
  where exception_request.id = target_exception_id
    and profile.id = actor_id
    and profile.role = 'provider_admin'
    and profile.active
  for update of exception_request;

  if target_request.id is null then
    raise exception using errcode = 'P0001', message = 'EXCEPTION_NOT_FOUND';
  end if;
  if target_request.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'EXCEPTION_ALREADY_RESOLVED';
  end if;

  update public.exception_requests
  set status = decision,
      resolved_by = actor_id,
      resolution_note = nullif(btrim(rejection_note), ''),
      resolved_at = now()
  where id = target_exception_id
  returning * into saved_request;

  if decision = 'approved' then
    insert into public.orders (
      service_day_id,
      menu_option_id,
      exception_request_id,
      created_by,
      kind,
      beneficiary_label,
      quantity,
      side,
      bread,
      tea
    ) values (
      saved_request.service_day_id,
      saved_request.menu_option_id,
      saved_request.id,
      actor_id,
      'exceptional',
      saved_request.beneficiary_label,
      1,
      saved_request.side,
      saved_request.bread,
      saved_request.tea
    );
  end if;

  return saved_request;
end;
$$;

create or replace function public.set_menu_option_availability(
  target_menu_option_id uuid,
  informed_capacity integer,
  is_visible boolean default null
)
returns public.menu_options
language plpgsql
set search_path = ''
as $$
declare
  saved_option public.menu_options%rowtype;
begin
  if not (select private.current_user_has_role('provider_admin')) then
    raise exception using errcode = 'P0001', message = 'PROVIDER_ROLE_REQUIRED';
  end if;
  if informed_capacity is not null and informed_capacity < 0 then
    raise exception using errcode = '22023', message = 'INVALID_CAPACITY';
  end if;

  update public.menu_options
  set capacity = informed_capacity,
      capacity_updated_at = now(),
      visible = coalesce(is_visible, visible)
  where id = target_menu_option_id
  returning * into saved_option;

  if saved_option.id is null then
    raise exception using errcode = 'P0001', message = 'MENU_OPTION_NOT_FOUND';
  end if;

  update public.service_days
  set availability_published_at = now()
  where id = saved_option.service_day_id;

  return saved_option;
end;
$$;

create or replace function public.save_menu_week_draft(
  target_starts_on date,
  week_days jsonb
)
returns public.menu_weeks
language plpgsql
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_organization_id uuid;
  organization_timezone text;
  saved_week public.menu_weeks%rowtype;
  saved_day_id uuid;
  day_input record;
  option_input record;
begin
  if actor_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not (select private.current_user_has_role('provider_admin')) then
    raise exception using errcode = 'P0001', message = 'PROVIDER_ROLE_REQUIRED';
  end if;
  if extract(isodow from target_starts_on) <> 1 then
    raise exception using errcode = '22023', message = 'WEEK_MUST_START_MONDAY';
  end if;
  if jsonb_typeof(week_days) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'INVALID_WEEK_DAYS';
  end if;
  if jsonb_array_length(week_days) <> 7 then
    raise exception using errcode = '22023', message = 'INVALID_WEEK_DAYS';
  end if;
  if (
    select count(distinct day_value->>'service_date')
    from jsonb_array_elements(week_days) as day_value
  ) <> 7 then
    raise exception using errcode = '22023', message = 'INVALID_WEEK_DAYS';
  end if;

  select organization.id, organization.timezone
  into target_organization_id, organization_timezone
  from public.profiles as profile
  join public.organizations as organization on organization.id = profile.organization_id
  where profile.id = actor_id
    and profile.active
    and profile.role = 'provider_admin';

  select menu_week.*
  into saved_week
  from public.menu_weeks as menu_week
  where menu_week.organization_id = target_organization_id
    and menu_week.starts_on = target_starts_on
  for update;

  if saved_week.id is null then
    insert into public.menu_weeks (
      organization_id,
      starts_on,
      created_by
    ) values (
      target_organization_id,
      target_starts_on,
      actor_id
    )
    returning * into saved_week;
  else
    if saved_week.published_at is not null then
      raise exception using errcode = 'P0001', message = 'MENU_WEEK_PUBLISHED';
    end if;
    if exists (
      select 1
      from public.service_days as service_day
      where service_day.menu_week_id = saved_week.id
        and (
          exists (
            select 1 from public.orders as order_record
            where order_record.service_day_id = service_day.id
          )
          or exists (
            select 1 from public.exception_requests as exception_request
            where exception_request.service_day_id = service_day.id
          )
        )
    ) then
      raise exception using errcode = 'P0001', message = 'MENU_WEEK_LOCKED';
    end if;

    delete from public.service_days
    where menu_week_id = saved_week.id;
  end if;

  for day_input in
    select *
    from jsonb_to_recordset(week_days) as day_record(
      service_date date,
      disabled boolean,
      options jsonb
    )
  loop
    if day_input.service_date < target_starts_on
      or day_input.service_date > target_starts_on + 6 then
      raise exception using errcode = '22023', message = 'INVALID_WEEK_DAYS';
    end if;
    if jsonb_typeof(day_input.options) is distinct from 'array' then
      raise exception using errcode = '22023', message = 'MENU_DAY_WITHOUT_OPTIONS';
    end if;
    if not coalesce(day_input.disabled, false) and jsonb_array_length(day_input.options) < 1 then
      raise exception using errcode = '22023', message = 'MENU_DAY_WITHOUT_OPTIONS';
    end if;

    insert into public.service_days (
      menu_week_id,
      service_date,
      phase,
      preorder_deadline,
      same_day_opens_at,
      same_day_closes_at,
      delivery_closes_at,
      disabled
    ) values (
      saved_week.id,
      day_input.service_date,
      'draft',
      ((day_input.service_date - 1) + time '22:00') at time zone organization_timezone,
      (day_input.service_date + time '08:00') at time zone organization_timezone,
      (day_input.service_date + time '11:00') at time zone organization_timezone,
      (day_input.service_date + time '14:00') at time zone organization_timezone,
      coalesce(day_input.disabled, false)
    )
    returning id into saved_day_id;

    for option_input in
      select *
      from jsonb_to_recordset(day_input.options) as option_record(
        category text,
        label text,
        description text,
        capacity integer,
        visible boolean,
        sort_order integer
      )
    loop
      if nullif(btrim(option_input.label), '') is null
        or nullif(btrim(option_input.description), '') is null
        or option_input.capacity < 0
        or option_input.capacity > 10000 then
        raise exception using errcode = '22023', message = 'INVALID_MENU_OPTION';
      end if;

      insert into public.menu_options (
        service_day_id,
        category,
        label,
        description,
        capacity,
        visible,
        sort_order
      ) values (
        saved_day_id,
        option_input.category::public.menu_category,
        btrim(option_input.label),
        btrim(option_input.description),
        option_input.capacity,
        coalesce(option_input.visible, true),
        coalesce(option_input.sort_order, 0)
      );
    end loop;
  end loop;

  return saved_week;
end;
$$;

create or replace function public.publish_menu_week(target_menu_week_id uuid)
returns public.menu_weeks
language plpgsql
set search_path = ''
as $$
declare
  saved_week public.menu_weeks%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not (select private.current_user_has_role('provider_admin')) then
    raise exception using errcode = 'P0001', message = 'PROVIDER_ROLE_REQUIRED';
  end if;

  select menu_week.*
  into saved_week
  from public.menu_weeks as menu_week
  where menu_week.id = target_menu_week_id
    and menu_week.organization_id = (select private.current_organization_id())
  for update;

  if saved_week.id is null then
    raise exception using errcode = 'P0001', message = 'MENU_WEEK_NOT_FOUND';
  end if;
  if saved_week.published_at is not null then
    return saved_week;
  end if;
  if (
    select count(*)
    from public.service_days as service_day
    where service_day.menu_week_id = saved_week.id
  ) <> 7 then
    raise exception using errcode = 'P0001', message = 'INVALID_WEEK_DAYS';
  end if;
  if exists (
    select 1
    from public.service_days as service_day
    where service_day.menu_week_id = saved_week.id
      and not service_day.disabled
      and not exists (
        select 1
        from public.menu_options as menu_option
        where menu_option.service_day_id = service_day.id
          and menu_option.visible
      )
  ) then
    raise exception using errcode = 'P0001', message = 'MENU_DAY_WITHOUT_OPTIONS';
  end if;

  update public.menu_weeks
  set published_at = now()
  where id = target_menu_week_id
  returning * into saved_week;

  update public.service_days
  set phase = case
    when disabled then 'closed'::public.service_phase
    when now() <= preorder_deadline then 'preorder_open'::public.service_phase
    when now() < same_day_opens_at then 'preorder_closed'::public.service_phase
    when now() < same_day_closes_at then 'same_day_open'::public.service_phase
    else 'closed'::public.service_phase
  end
  where menu_week_id = target_menu_week_id;

  return saved_week;
end;
$$;

create or replace function public.mark_order_fulfilled(
  target_order_id uuid,
  delivered boolean
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_order public.orders%rowtype;
begin
  if not exists (
    select 1
    from public.orders as order_record
    join public.service_days as service_day on service_day.id = order_record.service_day_id
    join public.menu_weeks as menu_week on menu_week.id = service_day.menu_week_id
    join public.profiles as profile on profile.organization_id = menu_week.organization_id
    where order_record.id = target_order_id
      and profile.id = auth.uid()
      and profile.role = 'provider_admin'
      and profile.active
  ) then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  end if;

  update public.orders
  set fulfilled_at = case when delivered then now() else null end
  where id = target_order_id
    and status = 'confirmed'
  returning * into saved_order;

  if saved_order.id is null then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  end if;

  return saved_order;
end;
$$;

revoke all on function private.enforce_exception_request_rules() from public;
revoke all on function private.audit_exception_request_change() from public;
revoke all on function private.enforce_order_business_rules() from public;
revoke all on function private.audit_order_change() from public;
revoke all on function private.audit_menu_option_change() from public;

revoke all on function public.save_regular_order(uuid, uuid, public.side_choice, boolean, boolean) from public, anon;
revoke all on function public.cancel_regular_order(uuid) from public, anon;
revoke all on function public.create_training_order(uuid, uuid, text, integer, public.side_choice, boolean, boolean) from public, anon;
revoke all on function public.create_extra_order(uuid, uuid, text, public.side_choice, boolean, boolean) from public, anon;
revoke all on function public.request_exceptional_order(uuid, uuid, text, text, public.side_choice, boolean, boolean) from public, anon;
revoke all on function public.resolve_exception_request(uuid, public.request_status, text) from public, anon;
revoke all on function public.save_menu_week_draft(date, jsonb) from public, anon;
revoke all on function public.publish_menu_week(uuid) from public, anon;
revoke all on function public.set_menu_option_availability(uuid, integer, boolean) from public, anon;
revoke all on function public.mark_order_fulfilled(uuid, boolean) from public, anon;

grant execute on function public.save_regular_order(uuid, uuid, public.side_choice, boolean, boolean) to authenticated;
grant execute on function public.cancel_regular_order(uuid) to authenticated;
grant execute on function public.create_training_order(uuid, uuid, text, integer, public.side_choice, boolean, boolean) to authenticated;
grant execute on function public.create_extra_order(uuid, uuid, text, public.side_choice, boolean, boolean) to authenticated;
grant execute on function public.request_exceptional_order(uuid, uuid, text, text, public.side_choice, boolean, boolean) to authenticated;
grant execute on function public.resolve_exception_request(uuid, public.request_status, text) to authenticated;
grant execute on function public.save_menu_week_draft(date, jsonb) to authenticated;
grant execute on function public.publish_menu_week(uuid) to authenticated;
grant execute on function public.set_menu_option_availability(uuid, integer, boolean) to authenticated;
grant execute on function public.mark_order_fulfilled(uuid, boolean) to authenticated;

comment on function public.save_regular_order(uuid, uuid, public.side_choice, boolean, boolean) is
  'Crea o modifica atómicamente la reserva regular del trabajador para un día.';
comment on function public.cancel_regular_order(uuid) is
  'Cancela únicamente un pedido regular perteneciente al trabajador autenticado.';
comment on function public.create_training_order(uuid, uuid, text, integer, public.side_choice, boolean, boolean) is
  'Crea atómicamente una capacitación y su pedido grupal para Securitas.';
comment on function public.create_extra_order(uuid, uuid, text, public.side_choice, boolean, boolean) is
  'Registra una colación extra durante la ventana de 08:00 a 11:00.';
comment on function public.request_exceptional_order(uuid, uuid, text, text, public.side_choice, boolean, boolean) is
  'Crea una solicitud extraordinaria pendiente durante la ventana de 11:00 a 14:00.';
comment on function public.resolve_exception_request(uuid, public.request_status, text) is
  'Aprueba o rechaza una solicitud; al aprobar crea el pedido extraordinario en la misma transacción.';
comment on function public.save_menu_week_draft(date, jsonb) is
  'Crea o reemplaza atómicamente un borrador semanal y calcula sus ventanas en la zona de la organización.';
comment on function public.publish_menu_week(uuid) is
  'Publica un borrador semanal completo para que sea visible a los trabajadores.';
comment on function public.set_menu_option_availability(uuid, integer, boolean) is
  'Permite a la proveedora informar disponibilidad y visibilidad con auditoría.';
comment on function public.mark_order_fulfilled(uuid, boolean) is
  'Permite a la proveedora marcar una colación confirmada como entregada.';

commit;
