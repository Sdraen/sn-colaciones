-- Solicitudes especiales creadas por Securitas hasta las 11:00.
-- Siempre requieren aprobación de la proveedora y no consumen cupos del menú normal.

begin;

alter table public.exception_requests
  add column request_kind text not null default 'late_extra',
  add column special_preparation text;

alter table public.exception_requests
  alter column menu_option_id drop not null;

alter table public.exception_requests
  add constraint exception_requests_kind_check
    check (request_kind in ('late_extra', 'special')),
  add constraint exception_requests_special_preparation_check check (
    (request_kind = 'late_extra' and menu_option_id is not null and special_preparation is null)
    or (
      request_kind = 'special'
      and char_length(btrim(coalesce(special_preparation, ''))) between 3 and 300
    )
  );

alter table public.exception_requests
  drop constraint if exists exception_requests_bread_or_tea_check;
alter table public.exception_requests
  add constraint exception_requests_bread_or_tea_check check (
    (request_kind = 'late_extra' and (bread or tea))
    or (request_kind = 'special' and side = 'ninguno' and not bread and not tea)
  );

alter table public.orders drop constraint order_beneficiary_check;
alter table public.orders add constraint order_beneficiary_check check (
  (kind = 'regular' and diner_id is not null and training_session_id is null and quantity = 1)
  or (kind = 'training' and training_session_id is not null and diner_id is null)
  or (kind in ('extra', 'exceptional', 'special') and beneficiary_label is not null and quantity between 1 and 500)
);

alter table public.orders drop constraint if exists orders_bread_or_tea_check;
alter table public.orders add constraint orders_bread_or_tea_check check (
  kind = 'special' or bread or tea
);

create index exception_requests_kind_status_index
  on public.exception_requests (request_kind, status, service_day_id);

create or replace function private.enforce_exception_request_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_day public.service_days%rowtype;
  target_week_published_at timestamptz;
  target_organization_id uuid;
begin
  select service_day.*
  into target_day
  from public.service_days as service_day
  where service_day.id = new.service_day_id;

  select menu_week.published_at, menu_week.organization_id
  into target_week_published_at, target_organization_id
  from public.menu_weeks as menu_week
  where menu_week.id = target_day.menu_week_id;

  if target_day.id is null or target_day.disabled then
    raise exception using errcode = 'P0001', message = 'SERVICE_DAY_DISABLED';
  end if;
  if target_week_published_at is null then
    raise exception using errcode = 'P0001', message = 'MENU_WEEK_NOT_PUBLISHED';
  end if;
  if exists (
    select 1 from public.service_calendar_blocks as calendar_block
    where calendar_block.organization_id = target_organization_id
      and target_day.service_date between calendar_block.starts_on and calendar_block.ends_on
      and calendar_block.kind in ('holiday', 'vacation', 'no_service')
  ) then
    raise exception using errcode = 'P0001', message = 'SERVICE_DAY_DISABLED';
  end if;

  if new.request_kind = 'special' then
    if now() >= target_day.same_day_closes_at then
      raise exception using errcode = 'P0001', message = 'SPECIAL_REQUEST_WINDOW_CLOSED';
    end if;
    return new;
  end if;

  if not (new.bread or new.tea) then
    raise exception using errcode = '22023', message = 'BREAD_OR_TEA_REQUIRED';
  end if;
  if new.side::text not in ('ensalada', 'fruta', 'postre') then
    raise exception using errcode = '22023', message = 'INVALID_SIDE_CHOICE';
  end if;
  if not (now() >= target_day.same_day_closes_at and now() < target_day.delivery_closes_at) then
    raise exception using errcode = 'P0001', message = 'EXTRA_APPROVAL_WINDOW_CLOSED';
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

  return new;
end;
$$;

do $migration$
declare
  original_definition text := pg_get_functiondef(
    'private.enforce_order_business_rules()'::regprocedure
  );
  updated_definition text;
begin
  updated_definition := replace(
    original_definition,
    'if not (new.bread or new.tea) then',
    'if new.kind <> ''special'' and not (new.bread or new.tea) then'
  );
  if updated_definition = original_definition then
    raise exception 'No se encontró la validación de pan y té en pedidos';
  end if;

  original_definition := updated_definition;
  updated_definition := replace(
    original_definition,
    'if new.side::text not in (''ensalada'', ''fruta'', ''postre'')',
    'if new.kind <> ''special'' and new.side::text not in (''ensalada'', ''fruta'', ''postre'')'
  );
  if updated_definition = original_definition then
    raise exception 'No se encontró la validación de acompañamiento en pedidos';
  end if;

  original_definition := updated_definition;
  updated_definition := replace(
    original_definition,
    '    when ''training'' then',
    $branch$    when 'special' then
      if tg_op = 'INSERT' and now() >= target_day.delivery_closes_at then
        raise exception using errcode = 'P0001', message = 'SPECIAL_APPROVAL_WINDOW_CLOSED';
      end if;
      if new.side <> 'ninguno' or new.bread or new.tea then
        raise exception using errcode = '22023', message = 'INVALID_SPECIAL_SELECTION';
      end if;
      if new.exception_request_id is null or not exists (
        select 1 from public.exception_requests as special_request
        join public.menu_options as special_option
          on special_option.id = special_request.menu_option_id
        where special_request.id = new.exception_request_id
          and special_request.request_kind = 'special'
          and special_request.service_day_id = new.service_day_id
          and special_request.menu_option_id = new.menu_option_id
          and special_request.status = 'approved'
          and special_request.beneficiary_label = new.beneficiary_label
          and special_request.quantity = new.quantity
          and special_option.description = special_request.special_preparation
      ) then
        raise exception using errcode = 'P0001', message = 'SPECIAL_REQUEST_NOT_APPROVED';
      end if;
    when 'training' then$branch$
  );
  if updated_definition = original_definition then
    raise exception 'No se encontró la rama de capacitación en pedidos';
  end if;

  original_definition := updated_definition;
  updated_definition := replace(
    original_definition,
    'if new.kind in (''training'', ''extra'', ''exceptional'') and option_capacity is not null then',
    'if new.kind in (''training'', ''extra'', ''exceptional'', ''special'') and option_capacity is not null then'
  );
  if updated_definition = original_definition then
    raise exception 'No se encontró la validación de cupos en pedidos';
  end if;

  execute updated_definition;
end;
$migration$;

create or replace function public.create_special_meal_request(
  target_service_day_id uuid,
  beneficiary_name text,
  requested_quantity integer,
  requested_preparation text,
  request_reason text
)
returns public.exception_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_organization_id uuid;
  target_day public.service_days%rowtype;
  target_organization_id uuid;
  target_published_at timestamptz;
  saved_request public.exception_requests%rowtype;
begin
  select profile.organization_id into actor_organization_id
  from public.profiles as profile
  where profile.id = actor_id and profile.active and profile.role = 'company_admin';
  if actor_organization_id is null then
    raise exception using errcode = 'P0001', message = 'COMPANY_ROLE_REQUIRED';
  end if;

  select service_day.*
  into target_day
  from public.service_days as service_day
  where service_day.id = target_service_day_id;

  select menu_week.organization_id, menu_week.published_at
  into target_organization_id, target_published_at
  from public.menu_weeks as menu_week
  where menu_week.id = target_day.menu_week_id;

  if target_day.id is null or target_organization_id <> actor_organization_id then
    raise exception using errcode = 'P0001', message = 'SERVICE_DAY_NOT_FOUND';
  end if;
  if target_day.disabled then
    raise exception using errcode = 'P0001', message = 'SERVICE_DAY_DISABLED';
  end if;
  if target_published_at is null then
    raise exception using errcode = 'P0001', message = 'MENU_WEEK_NOT_PUBLISHED';
  end if;
  if now() >= target_day.same_day_closes_at then
    raise exception using errcode = 'P0001', message = 'SPECIAL_REQUEST_WINDOW_CLOSED';
  end if;
  if requested_quantity not between 1 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_SPECIAL_QUANTITY';
  end if;
  if char_length(btrim(coalesce(beneficiary_name, ''))) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'INVALID_BENEFICIARY_NAME';
  end if;
  if char_length(btrim(coalesce(requested_preparation, ''))) not between 3 and 300 then
    raise exception using errcode = '22023', message = 'INVALID_SPECIAL_PREPARATION';
  end if;
  if char_length(btrim(coalesce(request_reason, ''))) not between 5 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_EXCEPTION_REASON';
  end if;

  insert into public.exception_requests (
    service_day_id, menu_option_id, beneficiary_label, reason, quantity,
    side, bread, tea, request_kind, special_preparation, requested_by
  ) values (
    target_service_day_id, null, btrim(beneficiary_name), btrim(request_reason),
    requested_quantity, 'ninguno', false, false, 'special',
    btrim(requested_preparation), actor_id
  ) returning * into saved_request;

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
  target_day public.service_days%rowtype;
  saved_request public.exception_requests%rowtype;
  special_option_id uuid;
begin
  if actor_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not (select private.current_user_has_role('provider_admin')) then
    raise exception using errcode = 'P0001', message = 'PROVIDER_ROLE_REQUIRED';
  end if;
  if decision not in ('approved', 'rejected') then
    raise exception using errcode = '22023', message = 'INVALID_EXTRA_DECISION';
  end if;
  if decision = 'rejected' and nullif(btrim(rejection_note), '') is null then
    raise exception using errcode = '22023', message = 'REJECTION_NOTE_REQUIRED';
  end if;

  select extra_request.*
  into target_request
  from public.exception_requests as extra_request
  join public.service_days as service_day on service_day.id = extra_request.service_day_id
  join public.menu_weeks as menu_week on menu_week.id = service_day.menu_week_id
  join public.profiles as profile on profile.organization_id = menu_week.organization_id
  where extra_request.id = target_exception_id
    and profile.id = actor_id and profile.role = 'provider_admin' and profile.active
  for update of extra_request;

  if target_request.id is null then
    raise exception using errcode = 'P0001', message = 'EXTRA_REQUEST_NOT_FOUND';
  end if;
  if target_request.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'EXTRA_ALREADY_RESOLVED';
  end if;

  select service_day.*
  into target_day
  from public.service_days as service_day
  where service_day.id = target_request.service_day_id;

  if target_request.request_kind = 'special'
    and decision = 'approved'
    and now() >= target_day.delivery_closes_at
  then
    raise exception using errcode = 'P0001', message = 'SPECIAL_APPROVAL_WINDOW_CLOSED';
  end if;

  if target_request.request_kind = 'special' and decision = 'approved' then
    insert into public.menu_options (
      service_day_id, category, label, description, capacity,
      capacity_updated_at, available_for_training, available_for_workers,
      visible, sort_order, notes
    ) values (
      target_request.service_day_id, 'especial', 'Colación especial',
      target_request.special_preparation, target_request.quantity, now(),
      false, false, true, 950, 'Solicitud especial aprobada por la proveedora'
    ) returning id into special_option_id;
  end if;

  update public.exception_requests
  set status = decision,
      menu_option_id = coalesce(special_option_id, menu_option_id),
      resolved_by = actor_id,
      resolution_note = nullif(btrim(rejection_note), ''),
      resolved_at = now()
  where id = target_exception_id
  returning * into saved_request;

  if decision = 'approved' then
    insert into public.orders (
      service_day_id, menu_option_id, exception_request_id, created_by, kind,
      beneficiary_label, quantity, side, bread, tea
    ) values (
      saved_request.service_day_id, saved_request.menu_option_id, saved_request.id,
      actor_id,
      case when saved_request.request_kind = 'special' then 'special'::public.order_kind else 'extra'::public.order_kind end,
      saved_request.beneficiary_label, saved_request.quantity, saved_request.side,
      saved_request.bread, saved_request.tea
    );
  end if;

  return saved_request;
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
  is_special boolean := new.request_kind = 'special';
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
      case when is_special then 'special_meal_requested' else 'extra_requested' end,
      case when is_special then 'Nueva solicitud de colación especial' else 'Nueva solicitud de colación extra' end,
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
      case
        when is_special and new.status = 'approved' then 'special_meal_approved'
        when is_special then 'special_meal_rejected'
        when new.status = 'approved' then 'extra_approved'
        else 'extra_rejected'
      end,
      case
        when is_special and new.status = 'approved' then 'Colación especial aprobada'
        when is_special then 'Colación especial rechazada'
        when new.status = 'approved' then 'Colación extra aprobada'
        else 'Colación extra rechazada'
      end,
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

revoke all on function public.create_special_meal_request(uuid,text,integer,text,text)
from public, anon;
grant execute on function public.create_special_meal_request(uuid,text,integer,text,text)
to authenticated;

comment on function public.create_special_meal_request(uuid,text,integer,text,text) is
  'Crea una solicitud especial hasta las 11:00 del día de servicio.';

commit;
