-- Correcciones acordadas con la proveedora el 29 de agosto de 2026.
-- Ejecutar después de 0004_backend_rpc_and_guards.sql.

begin;

-- Pan y té son alternativas excluyentes. Los registros antiguos incompletos
-- quedan normalizados a pan antes de agregar la protección.
update public.orders
set bread = true, tea = false
where bread = tea;

update public.exception_requests
set bread = true, tea = false
where bread = tea;

alter table public.orders
  add constraint orders_bread_or_tea_check check (bread <> tea);

alter table public.exception_requests
  add constraint exception_requests_bread_or_tea_check check (bread <> tea);

-- La proveedora define como máximo un menú común de capacitación por día.
alter table public.menu_options
  add column available_for_training boolean not null default false;

create unique index menu_options_one_training_menu_per_day
  on public.menu_options (service_day_id)
  where available_for_training;

-- La ventana excepcional termina a las 12:00, no a las 14:00.
update public.service_days as service_day
set delivery_closes_at = (
  service_day.service_date + time '12:00'
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

  if new.bread = new.tea then
    raise exception using errcode = '22023', message = 'BREAD_OR_TEA_REQUIRED';
  end if;

  if not (
    now() >= target_day.same_day_closes_at
    and now() <= target_day.delivery_closes_at
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
  select service_day.*
  into target_day
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

  -- Sólo el trabajador cancela pedidos regulares y debe hacerlo antes del corte.
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

  select menu_option.capacity
  into option_capacity
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
    when 'extra' then
      if not (
        now() >= target_day.same_day_opens_at
        and now() < target_day.same_day_closes_at
      ) then
        raise exception using errcode = 'P0001', message = 'EXTRA_WINDOW_CLOSED';
      end if;
    when 'exceptional' then
      if now() < target_day.same_day_closes_at or now() > target_day.delivery_closes_at then
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
      if organization_now::date <> target_day.service_date
        or organization_now::time < time '00:00'
        or organization_now::time > time '09:00' then
        raise exception using errcode = 'P0001', message = 'TRAINING_WINDOW_CLOSED';
      end if;
      if extract(isodow from target_day.service_date) not between 1 and 5 then
        raise exception using errcode = 'P0001', message = 'TRAINING_DATE_BLOCKED';
      end if;
      if not exists (
        select 1
        from public.menu_options as training_option
        where training_option.id = new.menu_option_id
          and training_option.service_day_id = new.service_day_id
          and training_option.visible
          and training_option.available_for_training
      ) then
        raise exception using errcode = 'P0001', message = 'TRAINING_MENU_REQUIRED';
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

  -- La disponibilidad publicada limita las altas del mismo día. Incluye los
  -- pedidos anticipados ya confirmados para no sobrepasar la producción.
  if new.kind in ('extra', 'exceptional') and option_capacity is not null then
    select coalesce(sum(order_record.quantity), 0)::integer
    into already_confirmed
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
  expected_next_monday date;
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
  if jsonb_typeof(week_days) is distinct from 'array'
    or jsonb_array_length(week_days) <> 7 then
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

  expected_next_monday :=
    date_trunc('week', now() at time zone organization_timezone)::date + 7;
  if target_starts_on <> expected_next_monday then
    raise exception using errcode = 'P0001', message = 'MENU_WEEK_MUST_BE_NEXT';
  end if;

  select menu_week.*
  into saved_week
  from public.menu_weeks as menu_week
  where menu_week.organization_id = target_organization_id
    and menu_week.starts_on = target_starts_on
  for update;

  if saved_week.id is null then
    insert into public.menu_weeks (organization_id, starts_on, created_by)
    values (target_organization_id, target_starts_on, actor_id)
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
          exists (select 1 from public.orders as order_record where order_record.service_day_id = service_day.id)
          or exists (select 1 from public.exception_requests as exception_request where exception_request.service_day_id = service_day.id)
        )
    ) then
      raise exception using errcode = 'P0001', message = 'MENU_WEEK_LOCKED';
    end if;

    delete from public.service_days where menu_week_id = saved_week.id;
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
      (day_input.service_date + time '12:00') at time zone organization_timezone,
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
        training_menu boolean,
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
        available_for_training,
        sort_order
      ) values (
        saved_day_id,
        option_input.category::public.menu_category,
        btrim(option_input.label),
        btrim(option_input.description),
        option_input.capacity,
        coalesce(option_input.visible, true),
        coalesce(option_input.training_menu, false),
        coalesce(option_input.sort_order, 0)
      );
    end loop;
  end loop;

  return saved_week;
end;
$$;

-- Cada evento importante genera un aviso dentro de la aplicación y otro
-- registro pendiente para el despachador de correo. El correo se marca como
-- entregado sólo cuando Resend confirma el envío.
create or replace function private.notify_exception_request()
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

  if tg_op = 'INSERT' then
    insert into public.notifications (
      organization_id,
      recipient_profile_id,
      channel,
      event_type,
      title,
      body,
      related_entity_type,
      related_entity_id,
      delivered_at
    )
    select
      target_organization_id,
      profile.id,
      delivery.channel,
      'exception_requested',
      'Nueva solicitud extraordinaria',
      new.beneficiary_label || ' requiere una decisión de la proveedora.',
      'exception_request',
      new.id,
      delivery.delivered_at
    from public.profiles as profile
    cross join (
      values
        ('in_app'::text, now()),
        ('email'::text, null::timestamptz)
    ) as delivery(channel, delivered_at)
    where profile.organization_id = target_organization_id
      and profile.role = 'provider_admin'
      and profile.active;
  elsif old.status = 'pending' and new.status in ('approved', 'rejected') then
    insert into public.notifications (
      organization_id,
      recipient_profile_id,
      channel,
      event_type,
      title,
      body,
      related_entity_type,
      related_entity_id,
      delivered_at
    )
    select
      target_organization_id,
      new.requested_by,
      delivery.channel,
      case when new.status = 'approved' then 'exception_approved' else 'exception_rejected' end,
      case when new.status = 'approved' then 'Solicitud extraordinaria aprobada' else 'Solicitud extraordinaria rechazada' end,
      case
        when new.status = 'approved' then new.beneficiary_label || ' fue incorporada a la producción.'
        else new.beneficiary_label || ': ' || new.resolution_note
      end,
      'exception_request',
      new.id,
      delivery.delivered_at
    from (
      values
        ('in_app'::text, now()),
        ('email'::text, null::timestamptz)
    ) as delivery(channel, delivered_at);
  end if;

  return new;
end;
$$;

revoke all on function private.notify_exception_request() from public;

comment on constraint orders_bread_or_tea_check on public.orders is
  'Cada colación debe elegir exactamente una alternativa: pan o té.';
comment on constraint exception_requests_bread_or_tea_check on public.exception_requests is
  'La solicitud conserva exactamente una alternativa: pan o té.';
comment on function public.save_menu_week_draft(date, jsonb) is
  'La proveedora crea o edita durante la semana actual únicamente el menú de la semana siguiente.';

commit;
